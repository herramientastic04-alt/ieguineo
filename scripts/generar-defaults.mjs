// Genera public/assets/js/defaults.js a partir de netlify/lib/defaults.mjs.
// Ejecuta: npm run defaults (solo hace falta si cambias el contenido inicial).
import { writeFileSync } from "node:fs";
import { DEFAULT_SITE, mergeDefaults } from "../netlify/lib/defaults.mjs";

const out = `/* Archivo generado por scripts/generar-defaults.mjs. No lo edites a mano. */
window.GuineoDefaults = {
  sitio: ${JSON.stringify(DEFAULT_SITE, null, 2)},
  merge: ${mergeDefaults.toString()}
};
`;
writeFileSync(new URL("../public/assets/js/defaults.js", import.meta.url), out);
console.log("defaults.js generado");
