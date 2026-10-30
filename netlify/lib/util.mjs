import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

export function errorResponse(err) {
  if (err instanceof HttpError) return json({ error: err.message }, err.status);
  console.error(err);
  return json({ error: "Ocurrió un error en el servidor. Intenta de nuevo en unos segundos." }, 500);
}

export async function readJson(req, maxBytes = 600_000) {
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "El contenido es demasiado grande.");
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, "La solicitud no tiene un formato válido.");
  }
}

// Almacenes de Netlify Blobs. Se usa consistencia fuerte para que lo que
// publica el administrador se vea de inmediato.
export const stores = {
  config: () => getStore({ name: "guineo-config", consistency: "strong" }),
  contenido: () => getStore({ name: "guineo-contenido", consistency: "strong" }),
  archivos: () => getStore({ name: "guineo-archivos", consistency: "strong" }),
};

export function newId(bytes = 9) {
  return randomBytes(bytes).toString("base64url");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Actualiza un documento JSON con escritura condicional (ETag), reintentando
// si otra petición lo modificó al mismo tiempo. "verify" confirma, leyendo de
// nuevo, que el cambio quedó guardado; si no, se vuelve a aplicar.
export async function updateJson(store, key, fallback, mutate, verify) {
  for (let intento = 0; intento < 8; intento++) {
    let entry = await store.getWithMetadata(key, { type: "json" });
    let etag = entry && entry.etag;
    if (entry && !etag) {
      // Algunos entornos (como el servidor local) no envían la ETag al leer:
      // se toma del listado ANTES de volver a leer los datos, para que una
      // escritura intermedia haga fallar la condición en lugar de perderse.
      const { blobs } = await store.list({ prefix: key });
      etag = (blobs.find((b) => b.key === key) || {}).etag;
      entry = await store.getWithMetadata(key, { type: "json" });
    }
    const current = entry ? entry.data : fallback();
    const next = await mutate(structuredClone(current));
    const res = !entry
      ? await store.setJSON(key, next, { onlyIfNew: true })
      : etag
      ? await store.setJSON(key, next, { onlyIfMatch: etag })
      : await store.setJSON(key, next);
    if (res === undefined || res.modified) {
      if (!verify) return next;
      const check = await store.get(key, { type: "json" });
      if (check && verify(check)) return check;
    }
    await sleep(60 * (intento + 1) + Math.random() * 80);
  }
  throw new HttpError(409, "Otra persona está guardando cambios al mismo tiempo. Intenta de nuevo.");
}

export async function readList(store, key) {
  const data = await store.get(key, { type: "json" });
  return Array.isArray(data) ? data : [];
}

export function str(value, max, { required = false, field = "campo" } = {}) {
  const s = typeof value === "string" ? value.trim() : "";
  if (required && !s) throw new HttpError(400, `Falta el ${field}.`);
  if (s.length > max) throw new HttpError(400, `El ${field} es demasiado largo (máximo ${max} caracteres).`);
  return s;
}

export function slugify(text, max = 60) {
  return (
    String(text || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, max) || "archivo"
  );
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
