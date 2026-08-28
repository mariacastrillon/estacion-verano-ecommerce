import { createServer as crearServidorVite } from "vite";
import process from "node:process";
import { iniciarServidorGestor } from "./servidor.js";

const api = iniciarServidorGestor();
const vite = await crearServidorVite();
await vite.listen();
vite.printUrls();

async function cerrar() {
  await vite.close();
  api.close();
}

process.once("SIGINT", cerrar);
process.once("SIGTERM", cerrar);
