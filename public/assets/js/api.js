/* Cliente de datos del sitio I.E. El Guineo.
   En Netlify habla con /api (Netlify Functions + Blobs).
   Si no hay servidor (vista previa local), funciona en "modo demostración"
   y guarda los cambios solo en este navegador. */
(function () {
  "use strict";

  const TOKEN_KEY = "guineo.sesion";
  const DEMO_KEY = "guineo.demo.v1";
  const PART_RETRIES = 3;

  let modo = null; // "servidor" | "demo"
  let detectando = null;

  const safe = {
    get(store, key) {
      try {
        return window[store].getItem(key);
      } catch {
        return null;
      }
    },
    set(store, key, value) {
      try {
        window[store].setItem(key, value);
        return true;
      } catch {
        return false;
      }
    },
    remove(store, key) {
      try {
        window[store].removeItem(key);
      } catch {}
    },
  };

  class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  }

  function detectar() {
    if (modo) return Promise.resolve(modo);
    if (detectando) return detectando;
    detectando = fetch("/api/estado", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (modo = d && d.ok ? "servidor" : "demo"))
      .catch(() => (modo = "demo"));
    return detectando;
  }

  /* ---------------------------- Sesión ---------------------------- */
  function sesion() {
    const raw = safe.get("localStorage", TOKEN_KEY);
    if (!raw) return null;
    try {
      const s = JSON.parse(raw);
      if (!s.expira || s.expira < Date.now()) {
        safe.remove("localStorage", TOKEN_KEY);
        return null;
      }
      return s;
    } catch {
      return null;
    }
  }

  function guardarSesion(s) {
    safe.set("localStorage", TOKEN_KEY, JSON.stringify(s));
  }

  /* ------------------------- Modo servidor ------------------------- */
  async function pedir(method, path, body, opts = {}) {
    const headers = {};
    const s = sesion();
    if (s && s.token) headers.authorization = "Bearer " + s.token;
    let payload;
    if (body instanceof ArrayBuffer || body instanceof Blob) {
      headers["content-type"] = "application/octet-stream";
      payload = body;
    } else if (body !== undefined) {
      headers["content-type"] = "application/json";
      payload = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch(path, { method, headers, body: payload, cache: "no-store" });
    } catch {
      throw new ApiError("No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.", 0);
    }
    let data = null;
    try {
      data = await res.json();
    } catch {}
    if (!res.ok) {
      if (res.status === 401 && !opts.login) {
        safe.remove("localStorage", TOKEN_KEY);
        window.dispatchEvent(new CustomEvent("guineo:sesion-cerrada"));
      }
      throw new ApiError((data && data.error) || `El servidor respondió con un error (${res.status}).`, res.status);
    }
    return data;
  }

  const servidor = {
    sitio: () => pedir("GET", "/api/sitio"),
    guardarSitio: (s) => pedir("PUT", "/api/sitio", s),
    noticias: (todas) => pedir("GET", "/api/noticias" + (todas ? "?todas=1" : "")),
    noticia: (id) => pedir("GET", "/api/noticias/" + encodeURIComponent(id)),
    crearNoticia: (n) => pedir("POST", "/api/noticias", n),
    actualizarNoticia: (id, n) => pedir("PUT", "/api/noticias/" + encodeURIComponent(id), n),
    eliminarNoticia: (id) => pedir("DELETE", "/api/noticias/" + encodeURIComponent(id)),
    archivos: (todos) => pedir("GET", "/api/archivos" + (todos ? "?todos=1" : "")),
    actualizarArchivo: (id, d) => pedir("PATCH", "/api/archivos/" + encodeURIComponent(id), d),
    eliminarArchivo: (id) => pedir("DELETE", "/api/archivos/" + encodeURIComponent(id)),
    async subirArchivo(file, datos = {}, onProgress = () => {}) {
      const inicio = await pedir("POST", "/api/archivos", {
        nombre: file.name,
        tamano: file.size,
        titulo: datos.titulo,
        descripcion: datos.descripcion,
        categoria: datos.categoria,
        clase: datos.clase,
        visible: datos.visible,
      });
      const { id, partes, tamanoParte } = inicio;
      for (let i = 0; i < partes; i++) {
        const trozo = file.slice(i * tamanoParte, Math.min(file.size, (i + 1) * tamanoParte));
        let ultimoError;
        for (let intento = 0; intento < PART_RETRIES; intento++) {
          try {
            await pedir("PUT", `/api/archivos/${encodeURIComponent(id)}/partes/${i}`, await trozo.arrayBuffer());
            ultimoError = null;
            break;
          } catch (e) {
            ultimoError = e;
            if (e.status && e.status < 500 && e.status !== 0) break;
            await new Promise((r) => setTimeout(r, 700 * (intento + 1)));
          }
        }
        if (ultimoError) throw ultimoError;
        onProgress((i + 1) / partes);
      }
      return pedir("POST", `/api/archivos/${encodeURIComponent(id)}/completar`);
    },
    async login(usuario, clave) {
      const s = await pedir("POST", "/api/login", { usuario, clave }, { login: true });
      guardarSesion(s);
      return s;
    },
    async verificarSesion() {
      const d = await pedir("GET", "/api/sesion");
      const s = sesion();
      if (s) guardarSesion({ ...s, claveInicial: d.claveInicial, usuario: d.usuario });
      return d;
    },
    async cambiarCredenciales(datos) {
      const s = await pedir("POST", "/api/credenciales", datos);
      guardarSesion(s);
      return s;
    },
    enlaceCompartir: (id) => location.origin + "/n/" + encodeURIComponent(id),
  };

  /* -------------------------- Modo demostración -------------------------- */
  const EJEMPLOS = () => {
    const hoy = new Date();
    const dia = (n) => {
      const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - n);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const ahora = new Date().toISOString();
    return [
      {
        id: "ejemplo-1",
        titulo: "Ejemplo: jornada de siembra en la huerta escolar",
        resumen: "Noticia de ejemplo. Los estudiantes de básica primaria sembraron plántulas de ají y cilantro como parte del Proyecto Ambiental Escolar.",
        cuerpo: "<p>Esta es una <strong>noticia de ejemplo</strong> para mostrar cómo se ve una publicación. Puedes editarla o eliminarla desde el panel de administración.</p><h2>Una mañana en la huerta</h2><p>Los grupos de tercero y cuarto trabajaron con sus docentes en la preparación de las eras, la siembra y el riego.</p><blockquote>La huerta es un aula al aire libre.</blockquote><ul><li>Preparación del terreno</li><li>Siembra de plántulas</li><li>Turnos de riego por grado</li></ul>",
        categoria: "Eventos",
        fecha: dia(1),
        estado: "publicada",
        destacada: true,
        portada: null,
        galeria: [],
        adjuntos: [],
        autor: "admin",
        creada: ahora,
        actualizada: ahora,
      },
      {
        id: "ejemplo-2",
        titulo: "Ejemplo: reunión de padres de familia del cuarto periodo",
        resumen: "Comunicado de ejemplo. Se invita a los acudientes a la entrega de informes académicos en la sede principal.",
        cuerpo: "<p>Comunicado de ejemplo. Los acudientes recibirán el informe del periodo y podrán conversar con los directores de grupo.</p>",
        categoria: "Comunicados",
        fecha: dia(6),
        estado: "publicada",
        destacada: false,
        portada: null,
        galeria: [],
        adjuntos: [],
        autor: "admin",
        creada: ahora,
        actualizada: ahora,
      },
      {
        id: "ejemplo-3",
        titulo: "Ejemplo: el grupo de pitos y tambores se presenta en Canalete",
        resumen: "Logro de ejemplo. El proyecto de pitos y tambores representó a la institución en el encuentro cultural municipal.",
        cuerpo: "<p>Publicación de ejemplo sobre un logro institucional.</p>",
        categoria: "Logros",
        fecha: dia(12),
        estado: "publicada",
        destacada: false,
        portada: null,
        galeria: [],
        adjuntos: [],
        autor: "admin",
        creada: ahora,
        actualizada: ahora,
      },
    ];
  };

  function demoLeer() {
    const raw = safe.get("localStorage", DEMO_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {}
    }
    return { sitio: null, noticias: EJEMPLOS(), archivos: [], auth: null };
  }

  function demoGuardar(db) {
    if (!safe.set("localStorage", DEMO_KEY, JSON.stringify(db))) {
      throw new ApiError("La vista previa no tiene más espacio en este navegador. En el sitio publicado no existe este límite.", 507);
    }
  }

  const demoId = () => Math.random().toString(36).slice(2, 10);
  const pausa = () => new Promise((r) => setTimeout(r, 120));

  function demoRequiereSesion() {
    if (!sesion()) {
      window.dispatchEvent(new CustomEvent("guineo:sesion-cerrada"));
      throw new ApiError("Inicia sesión para continuar.", 401);
    }
  }

  const hoyColombia = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);

  const demo = {
    async sitio() {
      await pausa();
      const db = demoLeer();
      return window.GuineoDefaults.merge(window.GuineoDefaults.sitio, db.sitio || {});
    },
    async guardarSitio(s) {
      demoRequiereSesion();
      const db = demoLeer();
      db.sitio = { ...s, actualizado: new Date().toISOString() };
      demoGuardar(db);
      return db.sitio;
    },
    async noticias(todas) {
      await pausa();
      const list = demoLeer().noticias.slice().sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
      return todas ? list : list.filter((n) => n.estado === "publicada" && n.fecha <= hoyColombia());
    },
    async noticia(id) {
      await pausa();
      const n = demoLeer().noticias.find((x) => x.id === id);
      if (!n) throw new ApiError("No encontramos esta noticia. Puede que la hayan retirado.", 404);
      return n;
    },
    async crearNoticia(n) {
      demoRequiereSesion();
      const db = demoLeer();
      const ahora = new Date().toISOString();
      const item = { ...n, id: demoId(), autor: sesion().usuario, creada: ahora, actualizada: ahora };
      db.noticias.unshift(item);
      demoGuardar(db);
      return item;
    },
    async actualizarNoticia(id, n) {
      demoRequiereSesion();
      const db = demoLeer();
      const i = db.noticias.findIndex((x) => x.id === id);
      if (i < 0) throw new ApiError("Esta noticia ya no existe.", 404);
      db.noticias[i] = { ...db.noticias[i], ...n, id, actualizada: new Date().toISOString() };
      demoGuardar(db);
      return db.noticias[i];
    },
    async eliminarNoticia(id) {
      demoRequiereSesion();
      const db = demoLeer();
      db.noticias = db.noticias.filter((x) => x.id !== id);
      demoGuardar(db);
      return { ok: true };
    },
    async archivos(todos) {
      await pausa();
      const list = demoLeer().archivos;
      return todos ? list : list.filter((f) => f.clase === "documento" && f.visible !== false);
    },
    async actualizarArchivo(id, d) {
      demoRequiereSesion();
      const db = demoLeer();
      const f = db.archivos.find((x) => x.id === id);
      if (!f) throw new ApiError("Este archivo ya no existe.", 404);
      Object.assign(f, d, { actualizado: new Date().toISOString() });
      demoGuardar(db);
      return f;
    },
    async eliminarArchivo(id) {
      demoRequiereSesion();
      const db = demoLeer();
      db.archivos = db.archivos.filter((x) => x.id !== id);
      demoGuardar(db);
      return { ok: true };
    },
    async subirArchivo(file, datos = {}, onProgress = () => {}) {
      demoRequiereSesion();
      if (file.size > 1.5 * 1024 * 1024) {
        throw new ApiError("En la vista previa solo se pueden subir archivos de hasta 1,5 MB. En el sitio publicado el límite es 18 MB.", 413);
      }
      const url = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(new ApiError("No se pudo leer el archivo.", 400));
        r.readAsDataURL(file);
      });
      onProgress(1);
      const ext = (/\.([a-z0-9]{1,5})$/i.exec(file.name) || [, ""])[1].toLowerCase();
      const rec = {
        id: demoId(),
        nombre: file.name,
        titulo: datos.titulo || file.name.replace(/\.[^.]+$/, ""),
        descripcion: datos.descripcion || "",
        categoria: datos.categoria || "Documentos institucionales",
        tipo: file.type || "application/octet-stream",
        ext,
        tamano: file.size,
        partes: 1,
        clase: datos.clase || "documento",
        visible: datos.visible !== false,
        url,
        creado: new Date().toISOString(),
      };
      const db = demoLeer();
      db.archivos.unshift(rec);
      demoGuardar(db);
      return rec;
    },
    async login(usuario, clave) {
      await pausa();
      const db = demoLeer();
      const u = db.auth ? db.auth.usuario : "admin";
      const c = db.auth ? db.auth.clave : "adminguineo";
      if (usuario.trim().toLowerCase() !== u.toLowerCase() || clave !== c) {
        throw new ApiError("El usuario o la contraseña no son correctos.", 401);
      }
      const s = { token: "demo", usuario: u, claveInicial: !db.auth, expira: Date.now() + 12 * 3600000 };
      guardarSesion(s);
      return s;
    },
    async verificarSesion() {
      demoRequiereSesion();
      const s = sesion();
      return { usuario: s.usuario, claveInicial: s.claveInicial };
    },
    async cambiarCredenciales({ claveActual, usuarioNuevo, claveNueva }) {
      demoRequiereSesion();
      const db = demoLeer();
      const c = db.auth ? db.auth.clave : "adminguineo";
      if (claveActual !== c) throw new ApiError("La contraseña actual no es correcta.", 400);
      if (!claveNueva || claveNueva.length < 8) throw new ApiError("La nueva contraseña debe tener al menos 8 caracteres.", 400);
      db.auth = { usuario: usuarioNuevo || sesion().usuario, clave: claveNueva };
      demoGuardar(db);
      const s = { token: "demo", usuario: db.auth.usuario, claveInicial: false, expira: Date.now() + 12 * 3600000 };
      guardarSesion(s);
      return s;
    },
    enlaceCompartir: (id) => location.href.split("#")[0] + "#noticia-" + encodeURIComponent(id),
  };

  /* ------------------------------ Utilidades ------------------------------ */
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  function fecha(iso, corta) {
    if (!iso) return "";
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    if (!y || !m || !d) return "";
    return corta ? `${d} ${MESES[m - 1].slice(0, 3)}. ${y}` : `${d} de ${MESES[m - 1]} de ${y}`;
  }

  function tamano(bytes) {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return Math.round(bytes / 1024) + " KB";
    return (bytes / 1048576).toFixed(1).replace(".", ",") + " MB";
  }

  function familia(ext) {
    ext = (ext || "").toLowerCase();
    if (ext === "pdf") return "pdf";
    if (["doc", "docx", "odt", "rtf", "txt"].includes(ext)) return "texto";
    if (["xls", "xlsx", "ods", "csv"].includes(ext)) return "hoja";
    if (["ppt", "pptx", "odp"].includes(ext)) return "presentacion";
    if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return "imagen";
    if (["mp3", "m4a", "ogg", "wav", "mp4"].includes(ext)) return "medio";
    return "otro";
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  function limpiarHtml(html) {
    if (!window.DOMPurify) return esc(html);
    return window.DOMPurify.sanitize(html || "", {
      ADD_TAGS: ["iframe"],
      ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "target", "data-list"],
    });
  }

  if (window.DOMPurify && !window.__guineoPurify) {
    window.__guineoPurify = true;
    window.DOMPurify.addHook("uponSanitizeElement", (node, data) => {
      if (data.tagName === "iframe") {
        const src = node.getAttribute("src") || "";
        if (!/^https:\/\/(www\.youtube(-nocookie)?\.com\/embed\/|player\.vimeo\.com\/video\/|drive\.google\.com\/file\/)/.test(src)) {
          node.parentNode && node.parentNode.removeChild(node);
        }
      }
    });
    window.DOMPurify.addHook("afterSanitizeAttributes", (node) => {
      if (node.tagName === "A" && node.getAttribute("href") && /^https?:/i.test(node.getAttribute("href"))) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener");
      }
    });
  }

  function toast(mensaje, tipo) {
    let zona = document.querySelector(".toasts");
    if (!zona) {
      zona = document.createElement("div");
      zona.className = "toasts";
      zona.setAttribute("role", "status");
      zona.setAttribute("aria-live", "polite");
      document.body.appendChild(zona);
    }
    const t = document.createElement("div");
    t.className = "toast" + (tipo === "error" ? " error" : "");
    t.textContent = mensaje;
    zona.appendChild(t);
    setTimeout(() => t.remove(), tipo === "error" ? 6500 : 3500);
  }

  // Reduce imágenes grandes antes de subirlas (máximo 1600 px, JPEG).
  async function prepararImagen(file, maximo = 1600) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
    try {
      const bitmap = await createImageBitmap(file);
      const escala = Math.min(1, maximo / Math.max(bitmap.width, bitmap.height));
      if (escala === 1 && file.size < 700 * 1024) return file;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * escala);
      canvas.height = Math.round(bitmap.height * escala);
      const ctx = canvas.getContext("2d");
      const conTransparencia = file.type === "image/png" && file.size < 900 * 1024;
      if (!conTransparencia) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const tipo = conTransparencia ? "image/png" : "image/jpeg";
      const blob = await new Promise((r) => canvas.toBlob(r, tipo, 0.85));
      if (!blob || blob.size >= file.size) return file;
      const nombre = file.name.replace(/\.[^.]+$/, "") + (tipo === "image/png" ? ".png" : ".jpg");
      return new File([blob], nombre, { type: tipo });
    } catch {
      return file;
    }
  }

  async function llamar(nombre, ...args) {
    await detectar();
    return (modo === "servidor" ? servidor : demo)[nombre](...args);
  }

  const metodos = [
    "sitio",
    "guardarSitio",
    "noticias",
    "noticia",
    "crearNoticia",
    "actualizarNoticia",
    "eliminarNoticia",
    "archivos",
    "actualizarArchivo",
    "eliminarArchivo",
    "subirArchivo",
    "login",
    "verificarSesion",
    "cambiarCredenciales",
  ];

  const Guineo = {
    detectar,
    get modo() {
      return modo;
    },
    sesion,
    cerrarSesion() {
      safe.remove("localStorage", TOKEN_KEY);
    },
    enlaceCompartir: (id) => (modo === "servidor" ? servidor : demo).enlaceCompartir(id),
    fecha,
    tamano,
    familia,
    esc,
    limpiarHtml,
    toast,
    prepararImagen,
    ApiError,
  };
  metodos.forEach((m) => (Guineo[m] = (...a) => llamar(m, ...a)));
  window.Guineo = Guineo;
})();
