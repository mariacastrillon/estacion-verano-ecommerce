const variablesPublicas = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"];

export function verificarEntornoBuild(entorno, bundle) {
  const codigo = Object.values(bundle)
    .filter((archivo) => archivo.type === "chunk")
    .map((archivo) => archivo.code)
    .join("\n");

  for (const nombre of variablesPublicas) {
    const valor = entorno[nombre];
    if (!valor?.trim()) {
      throw new Error(`Falta ${nombre} en el entorno del build. Revisa el contexto de despliegue.`);
    }
    const esperado = nombre === "VITE_SUPABASE_URL" ? valor.replace(/\/$/, "") : valor;
    if (!codigo.includes(esperado)) {
      throw new Error(`El bundle de produccion no contiene el valor de ${nombre}.`);
    }
  }
}

export function verificarSupabaseEnBundle() {
  let entorno;
  return {
    name: "verificar-supabase-en-bundle",
    apply: "build",
    configResolved(config) {
      entorno = config.env;
    },
    generateBundle(_opciones, bundle) {
      verificarEntornoBuild(entorno, bundle);
    },
  };
}
