// La misma politica estricta que antes estaba en netlify.toml. Solo se emite
// para artefactos de build; Netlify Dev sirve public/, no dist/_headers.
export const CSP_PRODUCCION = "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self'; style-src-elem 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://rymnnyzpsngnmnoeilne.supabase.co; frame-src 'none'; manifest-src 'self'; upgrade-insecure-requests";

export function cspNetlifyBuild() {
  return {
    name: 'csp-netlify-solo-build',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: '_headers', source: `/*\n  Content-Security-Policy: ${CSP_PRODUCCION}\n` });
    },
  };
}
