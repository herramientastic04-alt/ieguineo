// API del sitio de la I.E. El Guineo (Netlify Functions + Netlify Blobs).
import { DEFAULT_SITE, mergeDefaults } from "../lib/defaults.mjs";
import { changeCredentials, login, requireAdmin } from "../lib/auth.mjs";
import {
  HttpError,
  errorResponse,
  escapeHtml,
  json,
  newId,
  readJson,
  readList,
  slugify,
  stores,
  str,
  updateJson,
} from "../lib/util.mjs";

const PART_SIZE = 3 * 1024 * 1024; // 3 MB por parte (el límite de Netlify es 4,5 MB por petición)
const MAX_FILE = 18 * 1024 * 1024; // 18 MB por archivo

// Tipos de archivo permitidos (por extensión) y su tipo MIME.
const TIPOS = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  rtf: "application/rtf",
  zip: "application/zip",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  wav: "audio/wav",
  mp4: "video/mp4",
};
const INLINE = /^(application\/pdf|image\/|audio\/|video\/|text\/plain)/;

const NEWS_KEY = "noticias";
const FILES_KEY = "archivos";
const SITE_KEY = "sitio";

export default async (req, context) => {
  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const method = req.method.toUpperCase();
    const parts = path.split("/").filter(Boolean).map(decodeURIComponent);

    if (parts[0] === "archivos") return await serveFile(req, parts[1], url);
    if (parts[0] === "n") return await sharePage(url, parts[1]);
    if (parts[0] !== "api") throw new HttpError(404, "Ruta no encontrada.");

    const [, recurso, id, sub, n] = parts;

    switch (recurso) {
      case "estado":
        return json({ ok: true, servicio: "I.E. El Guineo", hora: new Date().toISOString() });

      case "login":
        if (method !== "POST") break;
        return json(await login(req, context, await readJson(req, 5000)));

      case "sesion":
        return json(await requireAdmin(req));

      case "credenciales": {
        if (method !== "POST") break;
        const admin = await requireAdmin(req);
        return json(await changeCredentials(admin, await readJson(req, 5000)));
      }

      case "sitio":
        if (method === "GET") return json(await getSite());
        if (method === "PUT") {
          await requireAdmin(req);
          return json(await saveSite(await readJson(req, 800_000)));
        }
        break;

      case "noticias":
        return await newsRoutes(req, method, id, url);

      case "archivos":
        return await fileRoutes(req, method, id, sub, n, url);
    }
    throw new HttpError(404, "Ruta no encontrada.");
  } catch (err) {
    return errorResponse(err);
  }
};

export const config = {
  path: ["/api/*", "/archivos/*", "/n/*"],
};

/* ---------------------------- Contenido del sitio ---------------------------- */

async function getSite() {
  const saved = await stores.contenido().get(SITE_KEY, { type: "json" });
  return mergeDefaults(DEFAULT_SITE, saved || {});
}

async function saveSite(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "El contenido enviado no es válido.");
  }
  const merged = mergeDefaults(DEFAULT_SITE, body);
  merged.actualizado = new Date().toISOString();
  await stores.contenido().setJSON(SITE_KEY, merged);
  return merged;
}

/* --------------------------------- Noticias --------------------------------- */

function cleanNews(input, previous = {}) {
  const fecha = str(input.fecha, 10) || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new HttpError(400, "La fecha debe tener el formato AAAA-MM-DD.");
  const urlOk = (u) => typeof u === "string" && /^\/archivos\/[A-Za-z0-9_-]+\//.test(u);
  const galeria = (Array.isArray(input.galeria) ? input.galeria : [])
    .filter((g) => g && urlOk(g.url))
    .slice(0, 40)
    .map((g) => ({ url: g.url, id: String(g.id || "").slice(0, 40), pie: str(g.pie, 200) }));
  const adjuntos = (Array.isArray(input.adjuntos) ? input.adjuntos : [])
    .filter((a) => a && urlOk(a.url))
    .slice(0, 20)
    .map((a) => ({
      id: String(a.id || "").slice(0, 40),
      url: a.url,
      titulo: str(a.titulo, 160) || "Documento",
      tipo: str(a.tipo, 120),
      tamano: Number(a.tamano) || 0,
    }));
  const cuerpo = typeof input.cuerpo === "string" ? input.cuerpo : "";
  if (cuerpo.length > 300_000) throw new HttpError(400, "El texto de la noticia es demasiado largo.");
  return {
    ...previous,
    titulo: str(input.titulo, 200, { required: true, field: "título" }),
    resumen: str(input.resumen, 600),
    cuerpo,
    categoria: str(input.categoria, 60) || "Noticias",
    fecha,
    estado: input.estado === "borrador" ? "borrador" : "publicada",
    destacada: Boolean(input.destacada),
    portada: input.portada && urlOk(input.portada.url) ? { url: input.portada.url, id: String(input.portada.id || "").slice(0, 40) } : null,
    galeria,
    adjuntos,
  };
}

const byDateDesc = (a, b) => (b.fecha || "").localeCompare(a.fecha || "") || (b.creada || "").localeCompare(a.creada || "");

function isPublic(item) {
  const today = new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10); // hora de Colombia
  return item.estado === "publicada" && item.fecha <= today;
}

async function newsRoutes(req, method, id, url) {
  const store = stores.contenido();

  if (method === "GET" && !id) {
    const all = url.searchParams.get("todas") === "1";
    if (all) await requireAdmin(req);
    const list = (await readList(store, NEWS_KEY)).sort(byDateDesc);
    return json(all ? list : list.filter(isPublic));
  }

  if (method === "GET" && id) {
    const list = await readList(store, NEWS_KEY);
    const item = list.find((x) => x.id === id);
    if (!item) throw new HttpError(404, "No encontramos esta noticia. Puede que la hayan retirado.");
    if (!isPublic(item)) await requireAdmin(req);
    return json(item);
  }

  const admin = await requireAdmin(req);

  if (method === "POST" && !id) {
    const body = await readJson(req);
    const now = new Date().toISOString();
    const item = { id: newId(6), ...cleanNews(body), autor: admin.usuario, creada: now, actualizada: now };
    await updateJson(store, NEWS_KEY, () => [], (list) => (list.some((x) => x.id === item.id) ? list : [item, ...list]), (list) =>
      list.some((x) => x.id === item.id)
    );
    return json(item, 201);
  }

  if (method === "PUT" && id) {
    const body = await readJson(req);
    let saved;
    await updateJson(store, NEWS_KEY, () => [], (list) => {
      const i = list.findIndex((x) => x.id === id);
      if (i < 0) throw new HttpError(404, "Esta noticia ya no existe.");
      saved = { ...cleanNews(body, list[i]), id, actualizada: new Date().toISOString() };
      list[i] = saved;
      return list;
    }, (list) => list.some((x) => x.id === id && x.actualizada === saved.actualizada));
    return json(saved);
  }

  if (method === "DELETE" && id) {
    let removed;
    const list = await updateJson(store, NEWS_KEY, () => [], (list) => {
      const found = list.find((x) => x.id === id);
      if (!found && !removed) throw new HttpError(404, "Esta noticia ya no existe.");
      removed = removed || found;
      return list.filter((x) => x.id !== id);
    }, (list) => !list.some((x) => x.id === id));
    // Borra las imágenes que solo usaba esta noticia.
    const stillUsed = new Set(
      list.flatMap((n) => [n.portada?.url, ...(n.galeria || []).map((g) => g.url), ...(n.adjuntos || []).map((a) => a.url)])
    );
    const media = [removed.portada, ...(removed.galeria || [])].filter((m) => m && m.url && !stillUsed.has(m.url));
    const files = await readList(stores.contenido(), FILES_KEY);
    for (const m of media) {
      const f = files.find((x) => x.url === m.url);
      if (f && f.clase === "imagen") await deleteFile(f.id).catch(() => {});
    }
    return json({ ok: true });
  }

  throw new HttpError(405, "Método no permitido.");
}

/* --------------------------------- Archivos --------------------------------- */

function extOf(name) {
  const m = /\.([a-z0-9]{1,5})$/i.exec(name || "");
  return m ? m[1].toLowerCase() : "";
}

async function fileRoutes(req, method, id, sub, n, url) {
  const meta = stores.contenido();
  const blobs = stores.archivos();

  if (method === "GET" && !id) {
    const all = url.searchParams.get("todos") === "1";
    if (all) await requireAdmin(req);
    const list = (await readList(meta, FILES_KEY)).sort((a, b) => (b.creado || "").localeCompare(a.creado || ""));
    return json(all ? list : list.filter((f) => f.clase === "documento" && f.visible !== false));
  }

  await requireAdmin(req);

  // 1) Crear la subida: el navegador envía los datos del archivo.
  if (method === "POST" && !id) {
    const body = await readJson(req, 10_000);
    const nombre = str(body.nombre, 180, { required: true, field: "nombre del archivo" });
    const ext = extOf(nombre);
    const tipo = TIPOS[ext];
    if (!tipo) throw new HttpError(400, `No se permiten archivos .${ext || "sin extensión"}. Usa PDF, Word, Excel, PowerPoint, imágenes, audio o video MP4.`);
    const tamano = Number(body.tamano);
    if (!Number.isFinite(tamano) || tamano <= 0) throw new HttpError(400, "El archivo está vacío.");
    if (tamano > MAX_FILE) throw new HttpError(400, `El archivo pesa más de ${MAX_FILE / 1048576} MB. Comprímelo o divídelo antes de subirlo.`);
    const fileId = newId(9);
    const partes = Math.ceil(tamano / PART_SIZE);
    const clase = ["documento", "imagen", "medio"].includes(body.clase) ? body.clase : "documento";
    const record = {
      id: fileId,
      nombre,
      titulo: str(body.titulo, 160) || nombre.replace(/\.[^.]+$/, ""),
      descripcion: str(body.descripcion, 500),
      categoria: str(body.categoria, 60) || "Documentos institucionales",
      tipo,
      ext,
      tamano,
      partes,
      clase,
      visible: body.visible !== false,
      url: `/archivos/${fileId}/${slugify(nombre)}`,
    };
    await blobs.setJSON(`pendiente/${fileId}`, record);
    return json({ id: fileId, partes, tamanoParte: PART_SIZE }, 201);
  }

  // 2) Recibir cada parte del archivo.
  if (method === "PUT" && id && sub === "partes") {
    const pending = await blobs.get(`pendiente/${id}`, { type: "json" });
    if (!pending) throw new HttpError(404, "Esta subida ya no existe. Vuelve a intentarlo.");
    const index = Number(n);
    if (!Number.isInteger(index) || index < 0 || index >= pending.partes) throw new HttpError(400, "Parte del archivo no válida.");
    const data = await req.arrayBuffer();
    const expected = index === pending.partes - 1 ? pending.tamano - PART_SIZE * index : PART_SIZE;
    if (data.byteLength !== expected) throw new HttpError(400, "Una parte del archivo llegó incompleta. Vuelve a intentarlo.");
    await blobs.set(`partes/${id}/${index}`, data);
    return json({ ok: true, parte: index });
  }

  // 3) Terminar la subida y publicar el archivo.
  if (method === "POST" && id && sub === "completar") {
    const pending = await blobs.get(`pendiente/${id}`, { type: "json" });
    if (!pending) throw new HttpError(404, "Esta subida ya no existe. Vuelve a intentarlo.");
    const { blobs: stored } = await blobs.list({ prefix: `partes/${id}/` });
    if (stored.length !== pending.partes) throw new HttpError(400, "Faltan partes del archivo. Vuelve a subirlo.");
    const record = { ...pending, creado: new Date().toISOString() };
    await updateJson(meta, FILES_KEY, () => [], (list) => [record, ...list.filter((f) => f.id !== id)], (list) => list.some((f) => f.id === id));
    await blobs.delete(`pendiente/${id}`);
    return json(record, 201);
  }

  if (method === "PATCH" && id) {
    const body = await readJson(req, 10_000);
    let saved;
    await updateJson(meta, FILES_KEY, () => [], (list) => {
      const i = list.findIndex((f) => f.id === id);
      if (i < 0) throw new HttpError(404, "Este archivo ya no existe.");
      const f = list[i];
      saved = {
        ...f,
        titulo: body.titulo !== undefined ? str(body.titulo, 160) || f.titulo : f.titulo,
        descripcion: body.descripcion !== undefined ? str(body.descripcion, 500) : f.descripcion,
        categoria: body.categoria !== undefined ? str(body.categoria, 60) || f.categoria : f.categoria,
        visible: body.visible !== undefined ? Boolean(body.visible) : f.visible,
        actualizado: new Date().toISOString(),
      };
      list[i] = saved;
      return list;
    }, (list) => list.some((f) => f.id === id && f.actualizado === saved.actualizado));
    return json(saved);
  }

  if (method === "DELETE" && id) {
    await deleteFile(id);
    return json({ ok: true });
  }

  throw new HttpError(405, "Método no permitido.");
}

async function deleteFile(id) {
  const blobs = stores.archivos();
  let found = false;
  await updateJson(stores.contenido(), FILES_KEY, () => [], (list) => {
    found = found || list.some((f) => f.id === id);
    return list.filter((f) => f.id !== id);
  }, (list) => !list.some((f) => f.id === id));
  const { blobs: stored } = await blobs.list({ prefix: `partes/${id}/` });
  await Promise.all(stored.map((b) => blobs.delete(b.key)));
  await blobs.delete(`pendiente/${id}`);
  if (!found && !stored.length) throw new HttpError(404, "Este archivo ya no existe.");
}

async function serveFile(req, id, url) {
  if (!id) throw new HttpError(404, "Archivo no encontrado.");
  const list = await readList(stores.contenido(), FILES_KEY);
  const file = list.find((f) => f.id === id);
  if (!file) {
    return new Response("Este archivo ya no está disponible.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }
  const blobs = stores.archivos();
  const download = url.searchParams.has("descargar") || !INLINE.test(file.tipo);
  const safeName = file.nombre.replace(/["\\\r\n]/g, "");
  const headers = {
    "content-type": file.tipo,
    "content-length": String(file.tamano),
    "content-disposition": `${download ? "attachment" : "inline"}; filename="${slugify(safeName, 120)}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
    "cache-control": "public, max-age=86400",
    "x-content-type-options": "nosniff",
  };
  if (file.partes === 1) {
    const data = await blobs.get(`partes/${id}/0`, { type: "arrayBuffer" });
    if (!data) throw new HttpError(404, "Archivo no encontrado.");
    return new Response(data, { headers });
  }
  let i = 0;
  const stream = new ReadableStream({
    async pull(controller) {
      if (i >= file.partes) return controller.close();
      const chunk = await blobs.get(`partes/${id}/${i}`, { type: "arrayBuffer" });
      if (!chunk) return controller.error(new Error("parte faltante"));
      controller.enqueue(new Uint8Array(chunk));
      i++;
    },
  });
  return new Response(stream, { headers });
}

/* ------------------------- Página para compartir noticias ------------------------- */

async function sharePage(url, id) {
  const list = await readList(stores.contenido(), NEWS_KEY);
  const item = list.find((x) => x.id === id && isPublic(x));
  const site = await getSite();
  const origin = url.origin;
  const target = item ? `/#noticia-${encodeURIComponent(item.id)}` : "/#noticias";
  const title = item ? item.titulo : site.identidad.nombre;
  const desc = item ? item.resumen || site.identidad.nombre : site.identidad.presentacion;
  const image = origin + (item?.portada?.url || "/assets/img/og-image.jpg");
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${escapeHtml(site.identidad.nombre)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:url" content="${escapeHtml(url.href)}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=${escapeHtml(target)}">
</head><body><p><a href="${escapeHtml(target)}">Ir a la noticia</a></p>
<script>location.replace(${JSON.stringify(target)})</script></body></html>`;
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
  });
}
