import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';

const run = promisify(execFile);

// Cluster desechable propio: nunca usa DATABASE_URL, .env ni Supabase.
export async function startLocalPostgres() {
  const platform = process.platform === 'win32' ? 'windows' : process.platform;
  const { initdb, pg_ctl: pgCtl } = await import(`@embedded-postgres/${platform}-${process.arch}`);
  const root = resolve('.temp');
  await mkdir(root, { recursive: true });
  const folder = await mkdtemp(join(root, 'orders-pg-'));
  const data = join(folder, 'data');
  const password = randomUUID();
  const pwfile = join(folder, 'password');
  await writeFile(pwfile, password, { mode: 0o600 });
  const socket = createServer();
  await new Promise((ok, fail) => { socket.once('error', fail); socket.listen(0, '127.0.0.1', ok); });
  const port = socket.address().port;
  await new Promise((ok) => socket.close(ok));
  const options = { windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 };
  let started = false;
  const clients = new Set();
  const close = async () => {
    await Promise.all([...clients].map((client) => client.end()));
    if (started) await run(pgCtl, ['-D', data, '-m', 'fast', '-w', 'stop'], options);
    // Validar destino absoluto antes de borrar recursivamente, tambien Windows.
    const actual = await realpath(folder);
    if (dirname(actual) !== await realpath(root) || !basename(actual).startsWith('orders-pg-')) {
      throw new Error('Directorio temporal fuera de la carpeta de pruebas');
    }
    await rm(actual, { recursive: true, force: true });
  };
  try {
    await run(initdb, ['-D', data, '-U', 'postgres', '-A', 'scram-sha-256', `--pwfile=${pwfile}`, '--encoding=UTF8', '--locale=C'], options);
    await rm(pwfile);
    await run(pgCtl, ['-D', data, '-l', join(folder, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start'], options);
    started = true;
    const connect = async () => {
      const client = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', password,
        database: 'postgres', connectionTimeoutMillis: 5000, statement_timeout: 10000 });
      await client.connect(); clients.add(client);
      client.exec = (sql) => client.query(sql);
      return client;
    };
    return { connect, close };
  } catch (error) {
    await close();
    throw error;
  }
}
