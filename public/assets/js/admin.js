/* Panel de administración de la I.E. El Guineo */
(function () {
  "use strict";
  const G = window.Guineo;
  const { esc, fecha, tamano, familia } = G;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const vista = $("#vista-admin");

  const st = {
    sitio: null,
    sitioOriginal: "",
    noticias: [],
    archivos: [],
    usuario: "",
    claveInicial: false,
    cargado: false,
  };
  let guardia = null; // protege el editor de noticias contra cambios sin guardar

  const ICONO = {
    arriba: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
    abajo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
    quitar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    subir: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></svg>',
  };

  const hoy = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);

  /* ============================== Sesión ============================== */
  async function iniciar() {
    await G.detectar();
    if (G.modo === "demo") {
      $("#login-demo").hidden = false;
      $("#aviso-demo").hidden = false;
    }
    if (G.sesion()) {
      try {
        const d = await G.verificarSesion();
        return entrar(d);
      } catch {}
    }
    mostrarLogin();
  }

  function mostrarLogin(mensaje) {
    $("#panel").hidden = true;
    $("#pantalla-login").hidden = false;
    document.title = "Panel El Guineo";
    const err = $("#login-error");
    err.hidden = !mensaje;
    err.textContent = mensaje || "";
    setTimeout(() => $("#login-usuario").focus(), 30);
  }

  $("#form-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const usuario = $("#login-usuario").value.trim();
    const clave = $("#login-clave").value;
    const err = $("#login-error");
    if (!usuario || !clave) {
      err.hidden = false;
      err.textContent = "Escribe el usuario y la contraseña.";
      return;
    }
    const boton = $("#login-enviar");
    boton.disabled = true;
    boton.textContent = "Ingresando…";
    try {
      const s = await G.login(usuario, clave);
      $("#login-clave").value = "";
      await entrar(s);
    } catch (ex) {
      err.hidden = false;
      err.textContent = ex.message;
    } finally {
      boton.disabled = false;
      boton.textContent = "Ingresar";
    }
  });

  $("#ver-clave").addEventListener("click", (e) => {
    const input = $("#login-clave");
    const ver = input.type === "password";
    input.type = ver ? "text" : "password";
    e.currentTarget.textContent = ver ? "Ocultar" : "Mostrar";
    e.currentTarget.setAttribute("aria-pressed", String(ver));
  });

  window.addEventListener("guineo:sesion-cerrada", () => {
    if (!$("#panel").hidden) {
      guardia = null;
      st.cargado = false;
      mostrarLogin("Tu sesión terminó. Inicia sesión de nuevo para continuar.");
    }
  });

  $("#cerrar-sesion").addEventListener("click", async () => {
    if (hayCambios() && !(await confirmar("Tienes cambios sin guardar", "Si cierras la sesión ahora, perderás los cambios.", "Cerrar sesión"))) return;
    G.cerrarSesion();
    guardia = null;
    st.cargado = false;
    st.sitioOriginal = JSON.stringify(st.sitio);
    mostrarLogin();
  });

  async function entrar(s) {
    st.usuario = s.usuario;
    st.claveInicial = Boolean(s.claveInicial);
    $("#pantalla-login").hidden = true;
    $("#panel").hidden = false;
    $("#area-usuario").textContent = "Sesión: " + st.usuario;
    $("#aviso-clave").hidden = !st.claveInicial;
    vista.innerHTML = '<p class="cargando-panel">Cargando contenido…</p>';
    try {
      const [sitio, noticias, archivos] = await Promise.all([G.sitio(), G.noticias(true), G.archivos(true)]);
      st.sitio = sitio;
      st.sitioOriginal = JSON.stringify(sitio);
      st.noticias = noticias;
      st.archivos = archivos;
      st.cargado = true;
      enrutar();
    } catch (e) {
      vista.innerHTML = `<div class="vacio-panel"><strong>No se pudo cargar el contenido</strong>${esc(e.message)}<br><button class="boton" type="button" id="reintentar">Intentar de nuevo</button></div>`;
      $("#reintentar").addEventListener("click", () => entrar(s));
    }
  }

  /* ============================== Rutas ============================== */
  const vistas = {
    resumen: vResumen,
    noticias: vNoticias,
    documentos: vDocumentos,
    institucion: () => vFormulario("institucion"),
    simbolos: () => vFormulario("simbolos"),
    contacto: () => vFormulario("contacto"),
    ajustes: vAjustes,
  };

  async function enrutar() {
    if (!st.cargado) return;
    const h = decodeURIComponent(location.hash.slice(1)) || "resumen";
    if (guardia && h !== guardia.ruta && guardia.sucio()) {
      const ok = await confirmar("Tienes cambios sin guardar", "Si sales ahora, perderás los cambios de esta noticia.", "Salir sin guardar");
      if (!ok) {
        history.replaceState(null, "", "#" + guardia.ruta);
        return;
      }
    }
    guardia = null;
    const clave = h === "nueva" || h.startsWith("editar-") ? "noticias" : vistas[h] ? h : "resumen";
    $$(".barra-nav a").forEach((a) => (a.dataset.v === clave ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
    cerrarMenu();
    if (h === "nueva") editorNoticia(null);
    else if (h.startsWith("editar-")) editorNoticia(h.slice(7));
    else (vistas[h] || vResumen)();
    window.scrollTo(0, 0);
    vista.focus({ preventScroll: true });
  }
  window.addEventListener("hashchange", enrutar);

  function hayCambios() {
    return (guardia && guardia.sucio()) || (st.sitio && JSON.stringify(st.sitio) !== st.sitioOriginal);
  }

  window.addEventListener("beforeunload", (e) => {
    if (st.cargado && hayCambios()) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  /* Menú en pantallas pequeñas */
  const barra = $("#barra");
  const menuBtn = $("#menu-admin");
  function cerrarMenu() {
    barra.classList.remove("abierta");
    menuBtn.setAttribute("aria-expanded", "false");
  }
  menuBtn.addEventListener("click", () => {
    const abierta = barra.classList.toggle("abierta");
    menuBtn.setAttribute("aria-expanded", String(abierta));
  });

  /* ============================ Confirmación ============================ */
  function confirmar(titulo, texto, accion = "Eliminar", peligro = true) {
    return new Promise((resolve) => {
      const modal = $("#modal");
      $("#modal-titulo").textContent = titulo;
      $("#modal-texto").textContent = texto;
      const ok = $("#modal-aceptar");
      const no = $("#modal-cancelar");
      ok.textContent = accion;
      ok.className = "boton " + (peligro ? "peligro" : "");
      const previo = document.activeElement;
      modal.hidden = false;
      no.focus();
      const fin = (valor) => {
        modal.hidden = true;
        ok.removeEventListener("click", si);
        no.removeEventListener("click", cancelar);
        document.removeEventListener("keydown", tecla);
        previo && previo.focus && previo.focus();
        resolve(valor);
      };
      const si = () => fin(true);
      const cancelar = () => fin(false);
      const tecla = (e) => {
        if (e.key === "Escape") fin(false);
      };
      ok.addEventListener("click", si);
      no.addEventListener("click", cancelar);
      document.addEventListener("keydown", tecla);
    });
  }

  /* ============================ Utilidades ============================ */
  function estadoNoticia(n) {
    if (n.estado === "borrador") return ["borrador", "Borrador"];
    if (n.fecha > hoy()) return ["programada", "Programada"];
    return ["publicada", "Publicada"];
  }

  function categoriasNoticias() {
    const base = (st.sitio.noticias && st.sitio.noticias.categorias) || [];
    return Array.from(new Set([...base, ...st.noticias.map((n) => n.categoria).filter(Boolean)]));
  }

  function categoriasDocumentos() {
    const base = (st.sitio.documentos && st.sitio.documentos.categorias) || [];
    return Array.from(
      new Set([...base, ...st.archivos.filter((f) => f.clase === "documento").map((f) => f.categoria).filter(Boolean)])
    );
  }

  function elegirArchivos({ accept = "", multiple = false } = {}) {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = accept;
      input.multiple = multiple;
      input.addEventListener("change", () => resolve(Array.from(input.files || [])));
      input.click();
    });
  }

  async function subirUno(file, datos, onProgress) {
    let f = file;
    if (datos.clase === "imagen") f = await G.prepararImagen(file);
    const rec = await G.subirArchivo(f, datos, onProgress);
    st.archivos.unshift(rec);
    return rec;
  }

  // Sube varios archivos uno por uno, mostrando el progreso en "cont".
  async function subirVarios(files, datos, cont) {
    const hechos = [];
    for (const file of files) {
      const item = document.createElement("div");
      item.className = "cola-item";
      item.innerHTML = `<strong>${esc(file.name)}</strong><span class="estado-texto">Preparando…</span><div class="barra-progreso"><span></span></div>`;
      cont && cont.prepend(item);
      const barraP = $(".barra-progreso span", item);
      const estadoT = $(".estado-texto", item);
      try {
        const rec = await subirUno(file, { ...datos, titulo: datos.titulo || undefined }, (p) => {
          barraP.style.width = Math.round(p * 100) + "%";
          estadoT.textContent = `Subiendo ${Math.round(p * 100)} %`;
        });
        item.classList.add("ok");
        barraP.style.width = "100%";
        estadoT.textContent = "Subido, " + tamano(rec.tamano);
        hechos.push(rec);
        setTimeout(() => item.remove(), 4000);
      } catch (e) {
        item.classList.add("error");
        estadoT.textContent = e.message;
        if (!cont) G.toast(`${file.name}: ${e.message}`, "error");
      }
    }
    return hechos;
  }

  function prepararZona(zona, alSoltar) {
    zona.addEventListener("dragover", (e) => {
      e.preventDefault();
      zona.classList.add("encima");
    });
    zona.addEventListener("dragleave", () => zona.classList.remove("encima"));
    zona.addEventListener("drop", (e) => {
      e.preventDefault();
      zona.classList.remove("encima");
      const files = Array.from(e.dataTransfer.files || []);
      if (files.length) alSoltar(files);
    });
  }

  function enlaceAbsoluto(url) {
    if (!url || url.startsWith("data:")) return url;
    return new URL(url, location.href).href;
  }

  async function copiar(texto) {
    try {
      await navigator.clipboard.writeText(texto);
      G.toast("Enlace copiado");
    } catch {
      G.toast("No se pudo copiar automáticamente. Enlace: " + texto, "error");
    }
  }

  function usosDeArchivo(url) {
    return st.noticias.filter(
      (n) => (n.portada && n.portada.url === url) || (n.galeria || []).some((g) => g.url === url) || (n.adjuntos || []).some((a) => a.url === url)
    );
  }

  /* ============================== Resumen ============================== */
  function vResumen() {
    document.title = "Resumen, Panel El Guineo";
    const pub = st.noticias.filter((n) => estadoNoticia(n)[0] === "publicada").length;
    const bor = st.noticias.filter((n) => n.estado === "borrador").length;
    const docs = st.archivos.filter((f) => f.clase === "documento").length;
    vista.innerHTML = `
      <div class="vista-cabeza"><div><h1>Hola, ${esc(st.usuario)}</h1><p>Desde aquí publicas noticias, subes documentos y actualizas la información de la ${esc(st.sitio.identidad.nombre)}.</p></div></div>
      <dl class="cifras">
        <div><dt>Noticias publicadas</dt><dd>${pub}</dd></div>
        <div><dt>Borradores</dt><dd>${bor}</dd></div>
        <div><dt>Documentos</dt><dd>${docs}</dd></div>
      </dl>
      <div class="accesos">
        <a class="acceso" href="#nueva"><strong>Nueva noticia</strong><span>Con fotos, galería y documentos adjuntos</span></a>
        <a class="acceso" href="#documentos"><strong>Subir documentos</strong><span>PDF, Word, Excel, imágenes, hasta 18 MB</span></a>
        <a class="acceso" href="#institucion"><strong>Editar la institución</strong><span>Misión, visión, valores, historia y más</span></a>
      </div>
      <h2 class="subtitulo">Últimas noticias</h2>
      ${tablaNoticias(st.noticias.slice(0, 5))}`;
    enlazarTabla();
  }

  /* ============================== Noticias ============================== */
  const filtroN = { texto: "", estado: "" };

  function vNoticias() {
    document.title = "Noticias, Panel El Guineo";
    vista.innerHTML = `
      <div class="vista-cabeza">
        <div><h1>Noticias</h1><p>Publica eventos, comunicados y logros. Las noticias con fecha futura se publican solas ese día.</p></div>
        <a class="boton rojo" href="#nueva">Nueva noticia</a>
      </div>
      <div class="herramientas">
        <label class="visualmente-oculto" for="buscar-n">Buscar noticias</label>
        <input type="search" id="buscar-n" placeholder="Buscar por título" value="${esc(filtroN.texto)}">
        <label class="visualmente-oculto" for="estado-n">Estado</label>
        <select id="estado-n">
          <option value="">Todos los estados</option>
          <option value="publicada">Publicadas</option>
          <option value="programada">Programadas</option>
          <option value="borrador">Borradores</option>
        </select>
      </div>
      <div id="tabla-n"></div>`;
    $("#estado-n").value = filtroN.estado;
    const pintar = () => {
      const q = filtroN.texto.trim().toLowerCase();
      const lista = st.noticias.filter((n) => (!q || n.titulo.toLowerCase().includes(q)) && (!filtroN.estado || estadoNoticia(n)[0] === filtroN.estado));
      $("#tabla-n").innerHTML = tablaNoticias(lista, true);
      enlazarTabla();
    };
    $("#buscar-n").addEventListener("input", (e) => {
      filtroN.texto = e.target.value;
      pintar();
    });
    $("#estado-n").addEventListener("change", (e) => {
      filtroN.estado = e.target.value;
      pintar();
    });
    pintar();
  }

  function tablaNoticias(lista, conFiltro) {
    if (!lista.length) {
      return `<div class="tabla-contenedor"><div class="vacio-panel"><strong>${
        conFiltro && st.noticias.length ? "Ninguna noticia coincide" : "Aún no hay noticias"
      }</strong>${conFiltro && st.noticias.length ? "Prueba con otra búsqueda o estado." : "Publica la primera para que aparezca en la portada del sitio."}${
        !st.noticias.length ? '<br><a class="boton" href="#nueva">Escribir la primera noticia</a>' : ""
      }</div></div>`;
    }
    return `<div class="tabla-contenedor"><table class="tabla">
      <thead><tr><th scope="col">Título</th><th scope="col">Fecha</th><th scope="col">Estado</th><th scope="col"><span class="visualmente-oculto">Acciones</span></th></tr></thead>
      <tbody>${lista
        .map((n) => {
          const [clase, texto] = estadoNoticia(n);
          return `<tr>
          <td class="titulo-celda"><a href="#editar-${esc(n.id)}">${esc(n.titulo)}</a><small>${esc(n.categoria)}${n.destacada ? ", destacada en el inicio" : ""}</small></td>
          <td class="fecha-celda">${esc(fecha(n.fecha, true))}</td>
          <td><span class="estado ${clase}">${texto}</span></td>
          <td class="acciones-celda">
            <a class="boton discreto" href="#editar-${esc(n.id)}">Editar</a>
            <a class="boton discreto" href="./#noticia-${esc(n.id)}" target="_blank" rel="noopener">Ver</a>
            <button class="boton discreto" type="button" data-borrar-noticia="${esc(n.id)}">Eliminar</button>
          </td></tr>`;
        })
        .join("")}</tbody></table></div>`;
  }

  function enlazarTabla() {
    $$("[data-borrar-noticia]", vista).forEach((b) =>
      b.addEventListener("click", async () => {
        const n = st.noticias.find((x) => x.id === b.dataset.borrarNoticia);
        if (!n) return;
        const ok = await confirmar("¿Eliminar esta noticia?", `Se borrará «${n.titulo}» junto con sus fotos. Esta acción no se puede deshacer.`, "Eliminar noticia");
        if (!ok) return;
        try {
          await G.eliminarNoticia(n.id);
          st.noticias = st.noticias.filter((x) => x.id !== n.id);
          st.archivos = await G.archivos(true).catch(() => st.archivos);
          G.toast("Noticia eliminada");
          enrutar();
        } catch (e) {
          G.toast(e.message, "error");
        }
      })
    );
  }

  /* ========================== Editor de noticias ========================== */
  let quillListo = false;
  function prepararQuill() {
    if (quillListo || !window.Quill) return;
    quillListo = true;
    const Video = window.Quill.import("formats/video");
    class VideoSeguro extends Video {
      static sanitize(url) {
        const u = String(url || "").trim();
        let m = u.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
        if (m) return "https://www.youtube-nocookie.com/embed/" + m[1];
        m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
        if (m) return "https://player.vimeo.com/video/" + m[1];
        m = u.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
        if (m) return "https://drive.google.com/file/d/" + m[1] + "/preview";
        return "about:blank";
      }
    }
    window.Quill.register(VideoSeguro, true);
  }

  function editorNoticia(id) {
    const original = id ? st.noticias.find((n) => n.id === id) : null;
    if (id && !original) {
      vista.innerHTML = `<a class="volver" href="#noticias">Volver a noticias</a><div class="vacio-panel"><strong>Esta noticia ya no existe</strong>Puede que la hayan eliminado.</div>`;
      return;
    }
    const cats = categoriasNoticias();
    const n = original
      ? structuredClone(original)
      : { titulo: "", resumen: "", cuerpo: "", categoria: cats[0] || "Noticias", fecha: hoy(), estado: "publicada", destacada: false, portada: null, galeria: [], adjuntos: [] };
    document.title = (original ? "Editar noticia" : "Nueva noticia") + ", Panel El Guineo";

    vista.innerHTML = `
      <a class="volver" href="#noticias">Volver a noticias</a>
      <div class="vista-cabeza"><div><h1>${original ? "Editar noticia" : "Nueva noticia"}</h1></div>
        ${original && estadoNoticia(original)[0] === "publicada" ? `<a class="boton secundario" href="./#noticia-${esc(original.id)}" target="_blank" rel="noopener">Ver en el sitio</a>` : ""}
      </div>
      <div class="editor">
        <div class="editor-principal">
          <div class="campo">
            <label for="n-titulo">Título</label>
            <input type="text" id="n-titulo" class="input-titulo" maxlength="200" value="${esc(n.titulo)}" placeholder="Escribe un título claro">
          </div>
          <div class="campo">
            <label for="n-resumen">Resumen</label>
            <textarea id="n-resumen" rows="3" maxlength="600" placeholder="Una o dos frases que cuenten lo esencial">${esc(n.resumen)}</textarea>
            <span class="ayuda">Aparece en la lista de noticias y cuando alguien comparte la noticia por WhatsApp o Facebook.</span>
          </div>
          <div class="campo">
            <span class="etiqueta" id="n-cuerpo-etiqueta">Contenido</span>
            <div class="editor-texto"><div id="n-cuerpo" aria-labelledby="n-cuerpo-etiqueta"></div></div>
            <span class="ayuda">Usa el botón de imagen para poner fotos dentro del texto, o el de video para insertar un video de YouTube.</span>
          </div>
          <div class="caja">
            <h2>Galería de fotos</h2>
            <div class="zona-subida" id="zona-galeria" tabindex="0" role="button" aria-label="Agregar fotos a la galería">
              ${ICONO.subir.replace("<svg", "<svg")}
              <strong>Arrastra fotos aquí o haz clic para elegirlas</strong>
              <span>Se reducen automáticamente para que carguen rápido.</span>
            </div>
            <div class="cola" id="cola-galeria"></div>
            <div class="galeria-editor" id="galeria-editor"></div>
          </div>
        </div>
        <aside class="editor-lateral">
          <div class="caja">
            <h2>Publicación</h2>
            <div class="opciones-estado" role="radiogroup" aria-label="Estado">
              <label class="opcion"><input type="radio" name="n-estado" value="publicada" ${n.estado !== "borrador" ? "checked" : ""}><span>Publicada<small>Visible en el sitio desde la fecha indicada</small></span></label>
              <label class="opcion"><input type="radio" name="n-estado" value="borrador" ${n.estado === "borrador" ? "checked" : ""}><span>Borrador<small>Solo la ves tú en el panel</small></span></label>
            </div>
            <div class="campo"><label for="n-fecha">Fecha</label><input type="date" id="n-fecha" value="${esc(n.fecha)}"></div>
            <div class="campo">
              <label for="n-categoria">Categoría</label>
              <select id="n-categoria">${cats.map((c) => `<option ${c === n.categoria ? "selected" : ""}>${esc(c)}</option>`).join("")}${
      cats.includes(n.categoria) ? "" : `<option selected>${esc(n.categoria)}</option>`
    }<option value="__otra">Otra categoría…</option></select>
              <input type="text" id="n-categoria-otra" placeholder="Nombre de la categoría" maxlength="60" hidden>
            </div>
            <label class="casilla"><input type="checkbox" id="n-destacada" ${n.destacada ? "checked" : ""}><span>Destacar en el inicio del sitio</span></label>
            <div class="fila-botones"><button class="boton" type="button" id="n-guardar"></button></div>
          </div>
          <div class="caja">
            <h2>Foto de portada</h2>
            <button class="portada-previa" type="button" id="n-portada-previa" aria-label="Elegir foto de portada"></button>
            <div class="fila-botones">
              <button class="boton secundario" type="button" id="n-portada-elegir">Elegir foto</button>
              <button class="boton discreto" type="button" id="n-portada-quitar">Quitar</button>
            </div>
          </div>
          <div class="caja">
            <h2>Documentos adjuntos</h2>
            <div class="adjuntos-editor" id="n-adjuntos"></div>
            <button class="boton secundario" type="button" id="n-adjunto-subir">Subir archivo</button>
            <div class="campo">
              <label for="n-adjunto-existente">O elegir de Documentos</label>
              <select id="n-adjunto-existente"><option value="">Selecciona un documento</option>${st.archivos
                .filter((f) => f.clase === "documento")
                .map((f) => `<option value="${esc(f.id)}">${esc(f.titulo)}</option>`)
                .join("")}</select>
            </div>
          </div>
        </aside>
      </div>`;

    // Editor de texto
    prepararQuill();
    const quill = new window.Quill("#n-cuerpo", {
      theme: "snow",
      placeholder: "Escribe aquí el contenido de la noticia…",
      modules: {
        toolbar: {
          container: [[{ header: [2, 3, false] }], ["bold", "italic", "underline"], [{ list: "ordered" }, { list: "bullet" }], ["blockquote", "link"], [{ align: [] }], ["image", "video"], ["clean"]],
          handlers: {
            image: async () => {
              const [file] = await elegirArchivos({ accept: "image/*" });
              if (!file) return;
              G.toast("Subiendo imagen…");
              try {
                const rec = await subirUno(file, { clase: "imagen", visible: false, categoria: "Imágenes de noticias", titulo: "Imagen de noticia" });
                const r = quill.getSelection(true);
                quill.insertEmbed(r ? r.index : quill.getLength(), "image", rec.url, "user");
              } catch (e) {
                G.toast(e.message, "error");
              }
            },
          },
        },
      },
    });
    const tb = quill.getModule("toolbar").container;
    [
      [".ql-bold", "Negrita"],
      [".ql-italic", "Cursiva"],
      [".ql-underline", "Subrayado"],
      ['.ql-list[value="ordered"]', "Lista numerada"],
      ['.ql-list[value="bullet"]', "Lista con viñetas"],
      [".ql-blockquote", "Cita"],
      [".ql-link", "Enlace"],
      [".ql-image", "Insertar imagen"],
      [".ql-video", "Insertar video"],
      [".ql-clean", "Quitar formato"],
    ].forEach(([sel, t]) => {
      const b = $(sel, tb);
      if (b) {
        b.title = t;
        b.setAttribute("aria-label", t);
      }
    });
    if (n.cuerpo) quill.clipboard.dangerouslyPasteHTML(n.cuerpo, "silent");

    // Recoger datos del formulario
    const recoger = () => {
      const sel = $("#n-categoria").value;
      const categoria = sel === "__otra" ? $("#n-categoria-otra").value.trim() || "Noticias" : sel;
      const cuerpo = quill.getLength() > 1 || quill.root.querySelector("img,iframe") ? quill.getSemanticHTML() : "";
      return {
        titulo: $("#n-titulo").value.trim(),
        resumen: $("#n-resumen").value.trim(),
        cuerpo,
        categoria,
        fecha: $("#n-fecha").value || hoy(),
        estado: ($('input[name="n-estado"]:checked') || {}).value || "publicada",
        destacada: $("#n-destacada").checked,
        portada: n.portada,
        galeria: n.galeria,
        adjuntos: n.adjuntos,
      };
    };
    let base = JSON.stringify(recoger());
    guardia = { ruta: location.hash.slice(1), sucio: () => JSON.stringify(recoger()) !== base };

    // Botón de guardar
    const botonGuardar = $("#n-guardar");
    const etiquetaBoton = () => {
      const estado = ($('input[name="n-estado"]:checked') || {}).value;
      botonGuardar.textContent = estado === "borrador" ? "Guardar borrador" : original ? "Guardar cambios" : "Publicar noticia";
    };
    etiquetaBoton();
    $$('input[name="n-estado"]').forEach((r) => r.addEventListener("change", etiquetaBoton));

    $("#n-categoria").addEventListener("change", (e) => {
      const otra = $("#n-categoria-otra");
      otra.hidden = e.target.value !== "__otra";
      if (!otra.hidden) otra.focus();
    });

    botonGuardar.addEventListener("click", async () => {
      const datos = recoger();
      if (!datos.titulo) {
        G.toast("Escribe un título para la noticia.", "error");
        $("#n-titulo").focus();
        return;
      }
      botonGuardar.disabled = true;
      const texto = botonGuardar.textContent;
      botonGuardar.textContent = "Guardando…";
      try {
        if (datos.destacada) {
          // Solo una noticia destacada a la vez
          for (const otra of st.noticias.filter((x) => x.destacada && x.id !== (original && original.id))) {
            const r = await G.actualizarNoticia(otra.id, { ...otra, destacada: false });
            Object.assign(otra, r);
          }
        }
        const guardada = original ? await G.actualizarNoticia(original.id, datos) : await G.crearNoticia(datos);
        const i = st.noticias.findIndex((x) => x.id === guardada.id);
        if (i >= 0) st.noticias[i] = guardada;
        else st.noticias.unshift(guardada);
        st.noticias.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
        base = JSON.stringify(recoger());
        G.toast(datos.estado === "borrador" ? "Borrador guardado" : original ? "Cambios guardados" : "Noticia publicada");
        guardia = null;
        if (!original) location.hash = "#editar-" + guardada.id;
        else enrutar();
      } catch (e) {
        G.toast(e.message, "error");
        botonGuardar.disabled = false;
        botonGuardar.textContent = texto;
      }
    });

    // Portada
    const pintarPortada = () => {
      const p = $("#n-portada-previa");
      p.innerHTML = n.portada ? `<img src="${esc(n.portada.url)}" alt="Foto de portada">` : "Sin foto de portada.<br>Haz clic para elegir una.";
      $("#n-portada-quitar").hidden = !n.portada;
    };
    const elegirPortada = async () => {
      const [file] = await elegirArchivos({ accept: "image/*" });
      if (!file) return;
      const p = $("#n-portada-previa");
      p.textContent = "Subiendo foto…";
      try {
        const rec = await subirUno(file, { clase: "imagen", visible: false, categoria: "Imágenes de noticias", titulo: "Portada de noticia" });
        n.portada = { url: rec.url, id: rec.id };
      } catch (e) {
        G.toast(e.message, "error");
      }
      pintarPortada();
    };
    $("#n-portada-previa").addEventListener("click", elegirPortada);
    $("#n-portada-elegir").addEventListener("click", elegirPortada);
    $("#n-portada-quitar").addEventListener("click", () => {
      n.portada = null;
      pintarPortada();
    });
    pintarPortada();

    // Galería
    const pintarGaleria = () => {
      $("#galeria-editor").innerHTML = n.galeria
        .map(
          (g, i) => `<div class="foto-editor">
          <img src="${esc(g.url)}" alt="">
          <label class="visualmente-oculto" for="pie-${i}">Pie de foto ${i + 1}</label>
          <input type="text" id="pie-${i}" data-pie="${i}" placeholder="Pie de foto (opcional)" value="${esc(g.pie || "")}" maxlength="200">
          <div class="acciones-fila">
            <button class="boton secundario" type="button" data-mover-foto="${i}" data-dir="-1" ${i === 0 ? "disabled" : ""} aria-label="Mover antes">Antes</button>
            <button class="boton secundario" type="button" data-mover-foto="${i}" data-dir="1" ${i === n.galeria.length - 1 ? "disabled" : ""} aria-label="Mover después">Después</button>
            <button class="boton peligro" type="button" data-quitar-foto="${i}" aria-label="Quitar foto ${i + 1}">Quitar</button>
          </div></div>`
        )
        .join("");
    };
    $("#galeria-editor").addEventListener("input", (e) => {
      const i = e.target.dataset.pie;
      if (i !== undefined) n.galeria[Number(i)].pie = e.target.value;
    });
    $("#galeria-editor").addEventListener("click", (e) => {
      const mover = e.target.closest("[data-mover-foto]");
      const quitar = e.target.closest("[data-quitar-foto]");
      if (mover) {
        const i = Number(mover.dataset.moverFoto);
        const j = i + Number(mover.dataset.dir);
        [n.galeria[i], n.galeria[j]] = [n.galeria[j], n.galeria[i]];
        pintarGaleria();
      }
      if (quitar) {
        n.galeria.splice(Number(quitar.dataset.quitarFoto), 1);
        pintarGaleria();
      }
    });
    const agregarFotos = async (files) => {
      const imagenes = files.filter((f) => /^image\//.test(f.type));
      if (imagenes.length < files.length) G.toast("Solo se agregan imágenes a la galería.", "error");
      const recs = await subirVarios(imagenes, { clase: "imagen", visible: false, categoria: "Imágenes de noticias", titulo: "Foto de galería" }, $("#cola-galeria"));
      recs.forEach((r) => n.galeria.push({ url: r.url, id: r.id, pie: "" }));
      pintarGaleria();
    };
    const zona = $("#zona-galeria");
    zona.addEventListener("click", async () => agregarFotos(await elegirArchivos({ accept: "image/*", multiple: true })));
    zona.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        zona.click();
      }
    });
    prepararZona(zona, agregarFotos);
    pintarGaleria();

    // Adjuntos
    const pintarAdjuntos = () => {
      $("#n-adjuntos").innerHTML = n.adjuntos.length
        ? n.adjuntos
            .map((a, i) => {
              const ext = (a.url.match(/\.([a-z0-9]{1,5})$/i) || [, ""])[1] || "doc";
              return `<div class="archivo-fila" style="padding:.4rem 0"><span class="tipo-archivo" data-familia="${familia(ext)}" style="width:2.25rem;height:2.6rem;font-size:.6875rem">${esc(ext.slice(0, 4))}</span><div><h3>${esc(a.titulo)}</h3><p>${esc(tamano(a.tamano))}</p></div><button class="mini quitar" type="button" data-quitar-adjunto="${i}" aria-label="Quitar ${esc(a.titulo)}">${ICONO.quitar}</button></div>`;
            })
            .join("")
        : '<p class="ayuda" style="color:var(--gris);font-size:var(--t-xs)">Sin documentos adjuntos.</p>';
    };
    $("#n-adjuntos").addEventListener("click", (e) => {
      const b = e.target.closest("[data-quitar-adjunto]");
      if (b) {
        n.adjuntos.splice(Number(b.dataset.quitarAdjunto), 1);
        pintarAdjuntos();
      }
    });
    $("#n-adjunto-subir").addEventListener("click", async () => {
      const files = await elegirArchivos({ multiple: true });
      if (!files.length) return;
      G.toast("Subiendo archivos…");
      const recs = await subirVarios(files, { clase: "medio", visible: false, categoria: "Adjuntos de noticias" }, null);
      recs.forEach((r) => n.adjuntos.push({ id: r.id, url: r.url, titulo: r.titulo, tipo: r.tipo, tamano: r.tamano }));
      pintarAdjuntos();
    });
    $("#n-adjunto-existente").addEventListener("change", (e) => {
      const f = st.archivos.find((x) => x.id === e.target.value);
      if (f && !n.adjuntos.some((a) => a.url === f.url)) n.adjuntos.push({ id: f.id, url: f.url, titulo: f.titulo, tipo: f.tipo, tamano: f.tamano });
      e.target.value = "";
      pintarAdjuntos();
    });
    pintarAdjuntos();

    if (!original) $("#n-titulo").focus();
  }

  /* ============================== Documentos ============================== */
  const filtroD = { pestana: "documento", texto: "" };
  let editandoArchivo = null;

  function vDocumentos() {
    document.title = "Documentos, Panel El Guineo";
    const cats = categoriasDocumentos();
    vista.innerHTML = `
      <div class="vista-cabeza"><div><h1>Documentos</h1><p>Lo que subas aquí aparece en la página Documentos del sitio, agrupado por categoría. Puedes subir varios archivos a la vez, de hasta 18 MB cada uno.</p></div></div>
      <div class="caja" style="margin-bottom:2rem">
        <div class="subida-opciones">
          <div class="campo">
            <label for="d-categoria">Categoría de los archivos que vas a subir</label>
            <select id="d-categoria">${cats.map((c) => `<option>${esc(c)}</option>`).join("")}</select>
          </div>
          <label class="casilla" style="margin-bottom:.6rem"><input type="checkbox" id="d-visible" checked><span>Visible en el sitio</span></label>
        </div>
        <div class="zona-subida" id="zona-docs" tabindex="0" role="button" aria-label="Subir documentos">
          ${ICONO.subir}
          <strong>Arrastra archivos aquí o haz clic para elegirlos</strong>
          <span>PDF, Word, Excel, PowerPoint, imágenes, audio o video MP4</span>
        </div>
        <div class="cola" id="cola-docs"></div>
      </div>
      <div class="pestanas" role="tablist">
        <button type="button" role="tab" data-pestana="documento" aria-selected="${filtroD.pestana === "documento"}">Documentos del sitio</button>
        <button type="button" role="tab" data-pestana="medios" aria-selected="${filtroD.pestana === "medios"}">Fotos y archivos de noticias</button>
      </div>
      <div class="herramientas">
        <label class="visualmente-oculto" for="buscar-d">Buscar archivos</label>
        <input type="search" id="buscar-d" placeholder="Buscar por nombre" value="${esc(filtroD.texto)}">
      </div>
      <div id="lista-d"></div>`;

    const zona = $("#zona-docs");
    const subir = async (files) => {
      const recs = await subirVarios(files, { clase: "documento", visible: $("#d-visible").checked, categoria: $("#d-categoria").value }, $("#cola-docs"));
      if (recs.length) {
        G.toast(recs.length === 1 ? "Archivo subido" : `${recs.length} archivos subidos`);
        filtroD.pestana = "documento";
        pintarListaArchivos();
      }
    };
    zona.addEventListener("click", async () => subir(await elegirArchivos({ multiple: true })));
    zona.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        zona.click();
      }
    });
    prepararZona(zona, subir);
    $$("[data-pestana]").forEach((b) =>
      b.addEventListener("click", () => {
        filtroD.pestana = b.dataset.pestana;
        $$("[data-pestana]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
        pintarListaArchivos();
      })
    );
    $("#buscar-d").addEventListener("input", (e) => {
      filtroD.texto = e.target.value;
      pintarListaArchivos();
    });
    $("#lista-d").addEventListener("click", accionesArchivo);
    pintarListaArchivos();
  }

  function pintarListaArchivos() {
    const cont = $("#lista-d");
    if (!cont) return;
    const q = filtroD.texto.trim().toLowerCase();
    const lista = st.archivos.filter(
      (f) => (filtroD.pestana === "documento" ? f.clase === "documento" : f.clase !== "documento") && (!q || (f.titulo + " " + f.nombre).toLowerCase().includes(q))
    );
    if (!lista.length) {
      cont.innerHTML = `<div class="archivos-lista"><div class="vacio-panel"><strong>${q ? "Ningún archivo coincide" : filtroD.pestana === "documento" ? "Aún no hay documentos" : "Aún no hay fotos ni archivos de noticias"}</strong>${
        q ? "Prueba con otra palabra." : filtroD.pestana === "documento" ? "Sube el PEI, el manual de convivencia, circulares o formatos." : "Aparecen aquí cuando agregas fotos o adjuntos a una noticia."
      }</div></div>`;
      return;
    }
    const cats = categoriasDocumentos();
    cont.innerHTML = `<div class="archivos-lista">${lista
      .map((f) => {
        const fam = familia(f.ext);
        const usos = usosDeArchivo(f.url);
        const detalle = [f.clase === "documento" ? f.categoria : usos.length ? "Usado en: " + usos.map((u) => u.titulo).join(", ") : "Sin usar en noticias", tamano(f.tamano), f.creado ? fecha(f.creado.slice(0, 10), true) : ""]
          .filter(Boolean)
          .join(", ");
        const icono = fam === "imagen" ? `<img class="miniatura-archivo" src="${esc(f.url)}" alt="" loading="lazy">` : `<span class="tipo-archivo" data-familia="${fam}" aria-hidden="true">${esc(f.ext || "doc")}</span>`;
        const fila = `<div class="archivo-fila">
          ${icono}
          <div><h3>${esc(f.titulo)}</h3><p>${esc(detalle)}${f.clase === "documento" && f.visible === false ? ' <span class="estado oculto">Oculto</span>' : ""}</p></div>
          <div class="acciones-fila">
            <a class="boton discreto" href="${esc(f.url)}" target="_blank" rel="noopener">Ver</a>
            ${f.url.startsWith("data:") ? "" : `<button class="boton discreto" type="button" data-copiar-archivo="${esc(f.id)}">Copiar enlace</button>`}
            <button class="boton discreto" type="button" data-editar-archivo="${esc(f.id)}" aria-expanded="${editandoArchivo === f.id}">Editar</button>
            <button class="boton discreto" type="button" data-borrar-archivo="${esc(f.id)}">Eliminar</button>
          </div>
        </div>`;
        const edicion =
          editandoArchivo === f.id
            ? `<form class="archivo-edicion" data-form-archivo="${esc(f.id)}">
            <div class="campo"><label for="ea-titulo">Título</label><input type="text" id="ea-titulo" name="titulo" value="${esc(f.titulo)}" maxlength="160" required></div>
            ${
              f.clase === "documento"
                ? `<div class="campo"><label for="ea-cat">Categoría</label><input type="text" id="ea-cat" name="categoria" list="ea-cats" value="${esc(f.categoria)}" maxlength="60"><datalist id="ea-cats">${cats.map((c) => `<option value="${esc(c)}">`).join("")}</datalist></div>
            <div class="campo ancho"><label for="ea-desc">Descripción (opcional)</label><textarea id="ea-desc" name="descripcion" rows="2" maxlength="500">${esc(f.descripcion || "")}</textarea></div>
            <label class="casilla ancho"><input type="checkbox" name="visible" ${f.visible !== false ? "checked" : ""}><span>Visible en la página Documentos del sitio</span></label>`
                : ""
            }
            <div class="acciones-fila ancho"><button class="boton" type="submit">Guardar</button><button class="boton secundario" type="button" data-cancelar-edicion>Cancelar</button></div>
          </form>`
            : "";
        return fila + edicion;
      })
      .join("")}</div>`;
    const form = $("[data-form-archivo]", cont);
    if (form) {
      $("input[name=titulo]", form).focus();
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const datos = { titulo: fd.get("titulo") };
        if (fd.has("categoria")) datos.categoria = fd.get("categoria");
        if (fd.has("descripcion")) datos.descripcion = fd.get("descripcion");
        const f = st.archivos.find((x) => x.id === form.dataset.formArchivo);
        if (f && f.clase === "documento") datos.visible = Boolean(form.querySelector("input[name=visible]").checked);
        try {
          const r = await G.actualizarArchivo(form.dataset.formArchivo, datos);
          Object.assign(f, r);
          editandoArchivo = null;
          G.toast("Cambios guardados");
          pintarListaArchivos();
        } catch (ex) {
          G.toast(ex.message, "error");
        }
      });
    }
  }

  async function accionesArchivo(e) {
    const ed = e.target.closest("[data-editar-archivo]");
    const bo = e.target.closest("[data-borrar-archivo]");
    const co = e.target.closest("[data-copiar-archivo]");
    if (e.target.closest("[data-cancelar-edicion]")) {
      editandoArchivo = null;
      pintarListaArchivos();
    }
    if (ed) {
      editandoArchivo = editandoArchivo === ed.dataset.editarArchivo ? null : ed.dataset.editarArchivo;
      pintarListaArchivos();
    }
    if (co) {
      const f = st.archivos.find((x) => x.id === co.dataset.copiarArchivo);
      if (f) copiar(enlaceAbsoluto(f.url));
    }
    if (bo) {
      const f = st.archivos.find((x) => x.id === bo.dataset.borrarArchivo);
      if (!f) return;
      const usos = usosDeArchivo(f.url);
      const texto = usos.length
        ? `«${f.titulo}» se usa en ${usos.length === 1 ? "la noticia" : "las noticias"}: ${usos.map((u) => u.titulo).join(", ")}. Si lo eliminas, dejará de verse allí. Esta acción no se puede deshacer.`
        : `Se borrará «${f.titulo}» del sitio. Esta acción no se puede deshacer.`;
      if (!(await confirmar("¿Eliminar este archivo?", texto, "Eliminar archivo"))) return;
      try {
        await G.eliminarArchivo(f.id);
        st.archivos = st.archivos.filter((x) => x.id !== f.id);
        G.toast("Archivo eliminado");
        pintarListaArchivos();
      } catch (ex) {
        G.toast(ex.message, "error");
      }
    }
  }

  /* ===================== Formularios de contenido del sitio ===================== */
  const FORMULARIOS = {
    institucion: {
      titulo: "Institución",
      texto: "La información que aparece en las páginas Inicio e Institución.",
      grupos: [
        {
          titulo: "Identidad",
          texto: "Nombre, lema y datos que se muestran en la portada y el pie de página.",
          campos: [
            { k: "identidad.nombre", l: "Nombre de la institución" },
            { fila: [{ k: "identidad.lema", l: "Lema", a: "Va en la cinta roja de la portada." }, { k: "identidad.eslogan", l: "Eslogan del PEI" }] },
            { k: "identidad.presentacion", l: "Presentación corta", t: "area", filas: 3, a: "Una o dos frases para la portada." },
            { fila: [{ k: "identidad.rector", l: "Rector o rectora" }, { k: "identidad.caracter", l: "Carácter" }] },
            { fila: [{ k: "identidad.dane", l: "Código DANE" }, { k: "identidad.nit", l: "NIT" }] },
            { fila: [{ k: "identidad.nucleo", l: "Núcleo" }, { k: "identidad.jornada", l: "Jornada" }] },
            { fila: [{ k: "identidad.corregimiento", l: "Corregimiento" }, { k: "identidad.municipio", l: "Municipio" }] },
            { k: "identidad.departamento", l: "Departamento" },
            { k: "identidad.niveles", l: "Niveles que ofrece", t: "lista" },
            { k: "identidad.resoluciones", l: "Resoluciones", t: "lista" },
          ],
        },
        {
          titulo: "Misión y visión",
          campos: [
            { k: "mision", l: "Misión", t: "area", filas: 8 },
            { k: "vision", l: "Visión", t: "area", filas: 8 },
          ],
        },
        {
          titulo: "Filosofía",
          campos: [
            { k: "filosofia", l: "Párrafos de la filosofía", t: "lista", largo: true },
            { k: "principios", l: "Principios", t: "lista", largo: true },
            { k: "pilares", l: "Pilares de la convivencia", t: "lista", largo: true },
          ],
        },
        {
          titulo: "Valores",
          campos: [
            { k: "valores.introduccion", l: "Introducción", t: "area", filas: 3 },
            { k: "valores.sociales", l: "Valores sociales", t: "lista" },
            { k: "valores.espirituales", l: "Valores espirituales", t: "lista" },
            { k: "valores.intelectuales", l: "Valores intelectuales", t: "lista" },
          ],
        },
        { titulo: "Perfil del estudiante", campos: [{ k: "perfilEstudiante", l: "Rasgos", t: "lista" }] },
        {
          titulo: "Proyectos pedagógicos",
          campos: [
            {
              k: "proyectos",
              l: "Proyectos",
              t: "pares",
              sub: [
                { k: "nombre", l: "Nombre" },
                { k: "detalle", l: "Descripción", t: "area" },
              ],
              nuevo: { nombre: "", detalle: "" },
            },
          ],
        },
        {
          titulo: "Reseña histórica",
          texto: "Los hitos se muestran como una línea de tiempo, en el orden de esta lista.",
          campos: [
            { k: "historia.introduccion", l: "Introducción", t: "area", filas: 4 },
            {
              k: "historia.hitos",
              l: "Hitos",
              t: "pares",
              enLinea: true,
              sub: [
                { k: "anio", l: "Año" },
                { k: "texto", l: "Qué pasó", t: "area" },
              ],
              nuevo: { anio: "", texto: "" },
            },
          ],
        },
      ],
    },
    simbolos: {
      titulo: "Símbolos",
      texto: "El escudo, la bandera y el himno de la institución. La bandera y el himno aparecen en el sitio cuando tienen contenido.",
      grupos: [
        {
          titulo: "Escudo",
          campos: [
            { k: "simbolos.escudoUrl", l: "Imagen del escudo", t: "imagen", original: "assets/img/escudo.webp", a: "Usa un PNG con fondo transparente. Se muestra en la cabecera, la portada y el pie." },
            {
              k: "simbolos.escudoElementos",
              l: "Elementos del escudo y su significado",
              t: "pares",
              sub: [
                { k: "nombre", l: "Elemento" },
                { k: "texto", l: "Significado", t: "area" },
              ],
              nuevo: { nombre: "", texto: "" },
            },
          ],
        },
        {
          titulo: "Bandera",
          texto: "Si no subes imagen ni descripción, la bandera no aparece en el sitio.",
          campos: [
            { k: "simbolos.banderaUrl", l: "Imagen de la bandera", t: "imagen" },
            { k: "simbolos.banderaDescripcion", l: "Descripción y significado de los colores", t: "area", filas: 5 },
          ],
        },
        {
          titulo: "Himno",
          texto: "Si no escribes la letra ni subes el audio, el himno no aparece en el sitio.",
          campos: [
            { fila: [{ k: "simbolos.himno.titulo", l: "Título" }, { k: "simbolos.himno.autor", l: "Autor de la letra y la música" }] },
            { k: "simbolos.himno.letra", l: "Letra", t: "area", filas: 14, a: "Separa las estrofas con una línea en blanco. Si una estrofa empieza con la palabra Coro, se muestra resaltada." },
            { k: "simbolos.himno.audioUrl", l: "Audio del himno (opcional)", t: "audio", a: "MP3 o M4A, hasta 18 MB." },
          ],
        },
      ],
    },
    contacto: {
      titulo: "Contacto y aviso",
      texto: "Datos de contacto, sedes, el aviso destacado y las categorías para noticias y documentos.",
      grupos: [
        {
          titulo: "Aviso destacado",
          texto: "Una franja roja bajo el menú, en todas las páginas. Úsala para avisos urgentes, como un cambio de horario.",
          campos: [
            { k: "aviso.activo", l: "Mostrar el aviso en el sitio", t: "check" },
            { k: "aviso.texto", l: "Texto del aviso", t: "area", filas: 2 },
            { k: "aviso.enlace", l: "Enlace (opcional)", a: "Por ejemplo, el enlace de una noticia o un documento." },
          ],
        },
        {
          titulo: "Datos de contacto",
          texto: "Los campos vacíos no se muestran en el sitio.",
          campos: [
            { k: "contacto.direccion", l: "Dirección" },
            { fila: [{ k: "contacto.telefono", l: "Teléfono" }, { k: "contacto.whatsapp", l: "WhatsApp" }] },
            { fila: [{ k: "contacto.correo", l: "Correo electrónico" }, { k: "contacto.horario", l: "Horario de atención" }] },
            { k: "contacto.facebook", l: "Página de Facebook", a: "Pega la dirección completa, por ejemplo https://facebook.com/…" },
            { k: "contacto.mapa", l: "Enlace de Google Maps", a: "En Google Maps, busca la institución, toca Compartir y pega aquí el enlace." },
          ],
        },
        {
          titulo: "Sedes",
          campos: [
            {
              k: "contacto.sedes",
              l: "Sedes",
              t: "pares",
              sub: [
                { k: "nombre", l: "Nombre de la sede" },
                { k: "detalle", l: "Ubicación o niveles que atiende" },
              ],
              nuevo: { nombre: "", detalle: "" },
            },
          ],
        },
        {
          titulo: "Categorías",
          texto: "Las opciones que aparecen al publicar noticias y al subir documentos.",
          campos: [
            { k: "noticias.categorias", l: "Categorías de noticias", t: "lista" },
            { k: "documentos.categorias", l: "Categorías de documentos", t: "lista" },
          ],
        },
      ],
    },
  };

  const leer = (obj, ruta) => ruta.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
  function escribir(obj, ruta, valor) {
    const partes = ruta.split(".");
    let o = obj;
    partes.slice(0, -1).forEach((k) => {
      if (o[k] == null || typeof o[k] !== "object") o[k] = {};
      o = o[k];
    });
    o[partes[partes.length - 1]] = valor;
  }
  const idDe = (k) => "f-" + k.replace(/\./g, "-");

  let camposActivos = {};

  function campoHtml(c) {
    if (c.fila) return `<div class="dos-columnas">${c.fila.map(campoHtml).join("")}</div>`;
    camposActivos[c.k] = c;
    return `<div class="campo-envoltura" id="c-${idDe(c.k)}">${campoInterior(c)}</div>`;
  }

  function campoInterior(c) {
    const v = leer(st.sitio, c.k);
    const id = idDe(c.k);
    const ayuda = c.a ? `<span class="ayuda">${esc(c.a)}</span>` : "";
    switch (c.t) {
      case "area":
        return `<div class="campo"><label for="${id}">${esc(c.l)}</label><textarea id="${id}" data-k="${c.k}" rows="${c.filas || 4}">${esc(v || "")}</textarea>${ayuda}</div>`;
      case "check":
        return `<label class="casilla"><input type="checkbox" id="${id}" data-k="${c.k}" ${v ? "checked" : ""}><span>${esc(c.l)}</span></label>`;
      case "lista": {
        const lista = Array.isArray(v) ? v : [];
        return `<div class="campo"><span class="etiqueta">${esc(c.l)}</span>${ayuda}<div class="lista-editable">${lista
          .map(
            (item, i) => `<div class="item-lista">
              ${
                c.largo
                  ? `<textarea id="${id}-${i}" data-k="${c.k}" data-i="${i}" rows="3" aria-label="${esc(c.l)} ${i + 1}">${esc(item)}</textarea>`
                  : `<input type="text" id="${id}-${i}" data-k="${c.k}" data-i="${i}" value="${esc(item)}" aria-label="${esc(c.l)} ${i + 1}">`
              }
              ${miniAcciones(c.k, i, lista.length)}
            </div>`
          )
          .join("")}</div><button type="button" class="boton secundario agregar" data-agregar="${c.k}">Agregar</button></div>`;
      }
      case "pares": {
        const lista = Array.isArray(v) ? v : [];
        return `<div class="campo"><span class="etiqueta">${esc(c.l)}</span>${ayuda}<div class="lista-editable">${lista
          .map(
            (item, i) => `<div class="item-lista par">
              <div class="subcampos ${c.enLinea ? "en-linea" : ""}">${c.sub
                .map((s) => {
                  const sid = `${id}-${i}-${s.k}`;
                  const val = esc((item && item[s.k]) || "");
                  return `<div class="campo"><label for="${sid}">${esc(s.l)}</label>${
                    s.t === "area"
                      ? `<textarea id="${sid}" data-k="${c.k}" data-i="${i}" data-sub="${s.k}" rows="3">${val}</textarea>`
                      : `<input type="text" id="${sid}" data-k="${c.k}" data-i="${i}" data-sub="${s.k}" value="${val}">`
                  }</div>`;
                })
                .join("")}</div>
              ${miniAcciones(c.k, i, lista.length)}
            </div>`
          )
          .join("")}</div><button type="button" class="boton secundario agregar" data-agregar="${c.k}">Agregar</button></div>`;
      }
      case "imagen":
      case "audio": {
        const esImagen = c.t === "imagen";
        const previa = v ? (esImagen ? `<img src="${esc(v)}" alt="">` : "Audio cargado") : esImagen ? "Sin imagen" : "Sin audio";
        return `<div class="campo"><span class="etiqueta">${esc(c.l)}</span>
          <div class="archivo-campo">
            <div class="previa">${previa}</div>
            <div style="display:grid;gap:.5rem">
              ${v && !esImagen ? `<audio controls src="${esc(v)}" preload="none"></audio>` : ""}
              <div class="acciones-fila">
                <button type="button" class="boton secundario" data-subir-campo="${c.k}">${v ? "Cambiar" : "Subir"} ${esImagen ? "imagen" : "audio"}</button>
                ${v ? `<button type="button" class="boton discreto" data-vaciar-campo="${c.k}">Quitar</button>` : ""}
                ${c.original && v !== c.original ? `<button type="button" class="boton discreto" data-original-campo="${c.k}">Usar el escudo original</button>` : ""}
              </div>
              ${ayuda}
            </div>
          </div></div>`;
      }
      default:
        return `<div class="campo"><label for="${id}">${esc(c.l)}</label><input type="text" id="${id}" data-k="${c.k}" value="${esc(v || "")}">${ayuda}</div>`;
    }
  }

  function miniAcciones(k, i, total) {
    return `<div class="mini-acciones">
      <button type="button" class="mini" data-mover="${k}" data-i="${i}" data-dir="-1" ${i === 0 ? "disabled" : ""} aria-label="Subir">${ICONO.arriba}</button>
      <button type="button" class="mini" data-mover="${k}" data-i="${i}" data-dir="1" ${i === total - 1 ? "disabled" : ""} aria-label="Bajar">${ICONO.abajo}</button>
      <button type="button" class="mini quitar" data-quitar="${k}" data-i="${i}" aria-label="Quitar">${ICONO.quitar}</button>
    </div>`;
  }

  function repintarCampo(k, enfocar) {
    const c = camposActivos[k];
    const cont = document.getElementById("c-" + idDe(k));
    if (!c || !cont) return;
    cont.innerHTML = campoInterior(c);
    if (enfocar) {
      const el = document.getElementById(enfocar);
      el && el.focus();
    }
  }

  function vFormulario(nombre) {
    const def = FORMULARIOS[nombre];
    document.title = def.titulo + ", Panel El Guineo";
    camposActivos = {};
    vista.innerHTML = `
      <div class="vista-cabeza"><div><h1>${esc(def.titulo)}</h1><p>${esc(def.texto)}</p></div>
        <a class="boton secundario" href="./#${nombre === "contacto" ? "contacto" : nombre}" target="_blank" rel="noopener">Ver en el sitio</a></div>
      <div class="formulario" id="formulario">
        ${def.grupos
          .map(
            (g) => `<section class="grupo">
          <div class="grupo-cabeza"><h2>${esc(g.titulo)}</h2>${g.texto ? `<p>${esc(g.texto)}</p>` : ""}</div>
          <div class="grupo-campos">${g.campos.map(campoHtml).join("")}</div>
        </section>`
          )
          .join("")}
      </div>
      <div class="barra-guardar" id="barra-guardar"><p id="estado-guardado"></p><button class="boton" type="button" id="guardar-sitio">Guardar cambios</button></div>`;

    const form = $("#formulario");
    form.addEventListener("input", (e) => {
      const el = e.target;
      const k = el.dataset.k;
      if (!k) return;
      if (el.dataset.i !== undefined) {
        const lista = leer(st.sitio, k);
        const i = Number(el.dataset.i);
        if (el.dataset.sub) lista[i] = { ...lista[i], [el.dataset.sub]: el.value };
        else lista[i] = el.value;
      } else {
        escribir(st.sitio, k, el.type === "checkbox" ? el.checked : el.value);
      }
      estadoGuardado();
    });
    form.addEventListener("change", (e) => {
      if (e.target.type === "checkbox" && e.target.dataset.k) {
        escribir(st.sitio, e.target.dataset.k, e.target.checked);
        estadoGuardado();
      }
    });
    form.addEventListener("click", async (e) => {
      const ag = e.target.closest("[data-agregar]");
      const mo = e.target.closest("[data-mover]");
      const qu = e.target.closest("[data-quitar]");
      const su = e.target.closest("[data-subir-campo]");
      const va = e.target.closest("[data-vaciar-campo]");
      const or = e.target.closest("[data-original-campo]");
      if (ag) {
        const k = ag.dataset.agregar;
        const c = camposActivos[k];
        const lista = Array.isArray(leer(st.sitio, k)) ? leer(st.sitio, k) : [];
        lista.push(c.t === "pares" ? { ...c.nuevo } : "");
        escribir(st.sitio, k, lista);
        const i = lista.length - 1;
        repintarCampo(k, c.t === "pares" ? `${idDe(k)}-${i}-${c.sub[0].k}` : `${idDe(k)}-${i}`);
        estadoGuardado();
      }
      if (mo) {
        const k = mo.dataset.mover;
        const lista = leer(st.sitio, k);
        const i = Number(mo.dataset.i);
        const j = i + Number(mo.dataset.dir);
        if (j < 0 || j >= lista.length) return;
        [lista[i], lista[j]] = [lista[j], lista[i]];
        repintarCampo(k);
        estadoGuardado();
      }
      if (qu) {
        const k = qu.dataset.quitar;
        leer(st.sitio, k).splice(Number(qu.dataset.i), 1);
        repintarCampo(k);
        estadoGuardado();
      }
      if (su) {
        const k = su.dataset.subirCampo;
        const c = camposActivos[k];
        const [file] = await elegirArchivos({ accept: c.t === "imagen" ? "image/*" : "audio/*" });
        if (!file) return;
        su.disabled = true;
        su.textContent = "Subiendo…";
        try {
          const rec = await subirUno(file, { clase: c.t === "imagen" ? "imagen" : "medio", visible: false, categoria: "Símbolos", titulo: c.l });
          escribir(st.sitio, k, rec.url);
          G.toast("Archivo subido. Guarda los cambios para publicarlo.");
        } catch (ex) {
          G.toast(ex.message, "error");
        }
        repintarCampo(k);
        estadoGuardado();
      }
      if (va) {
        escribir(st.sitio, va.dataset.vaciarCampo, "");
        repintarCampo(va.dataset.vaciarCampo);
        estadoGuardado();
      }
      if (or) {
        escribir(st.sitio, or.dataset.originalCampo, camposActivos[or.dataset.originalCampo].original);
        repintarCampo(or.dataset.originalCampo);
        estadoGuardado();
      }
    });

    $("#guardar-sitio").addEventListener("click", async () => {
      const b = $("#guardar-sitio");
      b.disabled = true;
      b.textContent = "Guardando…";
      try {
        const limpio = limpiarListas(structuredClone(st.sitio));
        const r = await G.guardarSitio(limpio);
        st.sitio = r;
        st.sitioOriginal = JSON.stringify(r);
        G.toast("Cambios guardados");
        vFormulario(nombre);
      } catch (ex) {
        G.toast(ex.message, "error");
        b.disabled = false;
        b.textContent = "Guardar cambios";
      }
    });
    estadoGuardado();
  }

  // Quita los elementos vacíos de las listas antes de guardar.
  function limpiarListas(o) {
    if (Array.isArray(o)) {
      return o
        .map(limpiarListas)
        .filter((x) => (typeof x === "string" ? x.trim() !== "" : x && typeof x === "object" ? Object.values(x).some((v) => String(v || "").trim() !== "") : true));
    }
    if (o && typeof o === "object") {
      Object.keys(o).forEach((k) => (o[k] = limpiarListas(o[k])));
    }
    return o;
  }

  function estadoGuardado() {
    const bar = $("#barra-guardar");
    if (!bar) return;
    const sucio = JSON.stringify(st.sitio) !== st.sitioOriginal;
    bar.classList.toggle("sucio", sucio);
    const act = st.sitio.actualizado;
    $("#estado-guardado").textContent = sucio
      ? "Tienes cambios sin guardar"
      : act
      ? `Guardado por última vez el ${fecha(new Date(new Date(act).getTime() - 5 * 3600000).toISOString().slice(0, 10))}`
      : "Sin cambios";
  }

  /* ============================== Ajustes ============================== */
  function vAjustes() {
    document.title = "Usuario y contraseña, Panel El Guineo";
    vista.innerHTML = `
      <div class="vista-cabeza"><div><h1>Usuario y contraseña</h1><p>Cambia los datos con los que entras al panel. Al guardar, las demás sesiones abiertas se cierran.</p></div></div>
      <form class="grupo" id="form-clave" novalidate style="max-width:52rem">
        <div class="grupo-cabeza"><h2>Acceso</h2><p>Usa una contraseña de al menos 8 caracteres que no uses en otros sitios.</p></div>
        <div class="grupo-campos">
          <div class="campo"><label for="a-actual">Contraseña actual</label><input type="password" id="a-actual" autocomplete="current-password" required></div>
          <div class="campo"><label for="a-usuario">Usuario</label><input type="text" id="a-usuario" autocomplete="username" autocapitalize="none" spellcheck="false" value="${esc(st.usuario)}"><span class="ayuda">Entre 3 y 40 caracteres, sin espacios.</span></div>
          <div class="dos-columnas">
            <div class="campo"><label for="a-nueva">Nueva contraseña</label><input type="password" id="a-nueva" autocomplete="new-password" minlength="8" required></div>
            <div class="campo"><label for="a-repetir">Repite la nueva contraseña</label><input type="password" id="a-repetir" autocomplete="new-password" minlength="8" required></div>
          </div>
          <p class="error-form" id="a-error" role="alert" hidden></p>
          <div><button class="boton" type="submit" id="a-guardar">Guardar usuario y contraseña</button></div>
        </div>
      </form>`;
    $("#form-clave").addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = $("#a-error");
      const mostrar = (m) => {
        err.hidden = false;
        err.textContent = m;
      };
      err.hidden = true;
      const claveActual = $("#a-actual").value;
      const usuarioNuevo = $("#a-usuario").value.trim();
      const claveNueva = $("#a-nueva").value;
      if (!claveActual) return mostrar("Escribe tu contraseña actual.");
      if (claveNueva.length < 8) return mostrar("La nueva contraseña debe tener al menos 8 caracteres.");
      if (claveNueva !== $("#a-repetir").value) return mostrar("Las dos contraseñas nuevas no coinciden.");
      const b = $("#a-guardar");
      b.disabled = true;
      try {
        const s = await G.cambiarCredenciales({ claveActual, usuarioNuevo, claveNueva });
        st.usuario = s.usuario;
        st.claveInicial = false;
        $("#aviso-clave").hidden = true;
        $("#area-usuario").textContent = "Sesión: " + st.usuario;
        G.toast("Usuario y contraseña actualizados");
        vAjustes();
      } catch (ex) {
        mostrar(ex.message);
        b.disabled = false;
      }
    });
  }

  iniciar();
})();
