/* Sitio público de la I.E. El Guineo */
(function () {
  "use strict";
  const G = window.Guineo;
  const { esc, fecha, tamano, familia } = G;
  const $ = (s, el = document) => el.querySelector(s);
  const vista = $("#vista");

  const estado = { sitio: null, noticias: [], archivos: [], cargado: false };
  const POR_PAGINA = 12;
  const ESCUDO_CHICO = "assets/img/escudo-160.webp";

  /* ----------------------------- Carga inicial ----------------------------- */
  async function cargar() {
    const [sitio, noticias, archivos] = await Promise.allSettled([G.sitio(), G.noticias(), G.archivos()]);
    estado.sitio = sitio.status === "fulfilled" ? sitio.value : window.GuineoDefaults.merge(window.GuineoDefaults.sitio, {});
    estado.noticias = noticias.status === "fulfilled" ? noticias.value : [];
    estado.archivos = archivos.status === "fulfilled" ? archivos.value : [];
    estado.cargado = true;
    if (G.modo === "demo") $("#aviso-demo").hidden = false;
    if ([sitio, noticias, archivos].some((r) => r.status === "rejected")) {
      G.toast("No pudimos cargar todo el contenido. Recarga la página en unos segundos.", "error");
    }
    pintarMarco();
    $("#cargando").remove();
    enrutar();
  }

  function escudoUrl() {
    return (estado.sitio && estado.sitio.simbolos.escudoUrl) || "assets/img/escudo.webp";
  }

  function pintarMarco() {
    const s = estado.sitio;
    const id = s.identidad;
    document.querySelectorAll('[data-campo="identidad.nombre"]').forEach((el) => (el.textContent = id.nombre));
    document.querySelectorAll('[data-campo="identidad.lema"]').forEach((el) => (el.textContent = id.lema));
    if (s.simbolos.escudoUrl && !/assets\/img\/escudo\.webp$/.test(s.simbolos.escudoUrl)) {
      document.querySelectorAll("[data-escudo]").forEach((img) => (img.src = s.simbolos.escudoUrl));
    }
    $("#anio").textContent = new Date().getFullYear();
    const datos = [
      ["DANE", id.dane],
      ["NIT", id.nit],
      ["Rector", id.rector],
      ["Ubicación", [id.corregimiento, id.municipio, id.departamento].filter(Boolean).join(", ")],
      ["Teléfono", s.contacto.telefono],
      ["Correo", s.contacto.correo],
    ].filter(([, v]) => v);
    $("#pie-datos").innerHTML = datos.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");

    const aviso = s.aviso || {};
    if (aviso.activo && aviso.texto) {
      $("#aviso").hidden = false;
      $("#aviso-texto").textContent = aviso.texto;
      const a = $("#aviso-enlace");
      if (aviso.enlace) {
        a.hidden = false;
        a.href = aviso.enlace;
        if (/^https?:/i.test(aviso.enlace)) {
          a.target = "_blank";
          a.rel = "noopener";
        }
      }
    }
  }

  /* -------------------------------- Rutas -------------------------------- */
  const rutas = {
    inicio: vistaInicio,
    institucion: vistaInstitucion,
    simbolos: vistaSimbolos,
    noticias: vistaNoticias,
    documentos: vistaDocumentos,
    contacto: vistaContacto,
  };

  const TITULOS = {
    inicio: "",
    institucion: "Institución",
    simbolos: "Símbolos",
    noticias: "Noticias",
    documentos: "Documentos",
    contacto: "Contacto",
  };

  function enrutar() {
    if (!estado.cargado) return;
    const hash = decodeURIComponent(location.hash.replace(/^#/, ""));
    let ruta = hash || "inicio";
    let param = null;
    if (ruta.startsWith("noticia-")) {
      param = ruta.slice(8);
      ruta = "noticia";
    } else if (!rutas[ruta]) {
      ruta = "inicio";
    }
    document.querySelectorAll(".navegacion a").forEach((a) => {
      const activa = a.dataset.ruta === ruta || (ruta === "noticia" && a.dataset.ruta === "noticias");
      if (activa) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    cerrarMenu();
    const nombre = estado.sitio.identidad.nombre;
    if (ruta === "noticia") {
      vistaNoticia(param);
    } else {
      document.title = TITULOS[ruta] ? `${TITULOS[ruta]}, ${nombre}` : nombre;
      rutas[ruta]();
    }
    window.scrollTo({ top: 0, behavior: "instant" in document.documentElement.style ? "instant" : "auto" });
    $("#contenido").focus({ preventScroll: true });
  }

  window.addEventListener("hashchange", enrutar);

  /* --------------------------- Piezas reutilizables --------------------------- */
  function imagenNoticia(n, clase = "imagen-noticia", conBanderin = true) {
    const ban = conBanderin && n.categoria ? `<span class="banderin">${esc(n.categoria)}</span>` : "";
    if (n.portada && n.portada.url) {
      return `<div class="${clase}"><img src="${esc(n.portada.url)}" alt="" loading="lazy">${ban}</div>`;
    }
    return `<div class="${clase}"><div class="sin-foto"><img src="${esc(ESCUDO_CHICO)}" alt="" loading="lazy"></div>${ban}</div>`;
  }

  function metaNoticia(n) {
    return `<div class="meta"><time datetime="${esc(n.fecha)}">${esc(fecha(n.fecha))}</time></div>`;
  }

  function filaDocumento(f) {
    const fam = familia(f.ext);
    const partes = [f.categoria, tamano(f.tamano), f.creado ? fecha(f.creado.slice(0, 10)) : ""].filter(Boolean).join(", ");
    const verUrl = f.url;
    const bajarUrl = f.url.startsWith("data:") ? f.url : f.url + "?descargar=1";
    return `<article class="documento">
      <span class="tipo-archivo" data-familia="${fam}" aria-hidden="true">${esc(f.ext || "doc")}</span>
      <div>
        <h3>${esc(f.titulo)}</h3>
        ${f.descripcion ? `<p>${esc(f.descripcion)}</p>` : ""}
        <p>${esc(partes)}</p>
      </div>
      <div class="acciones">
        ${/^(pdf|jpg|jpeg|png|webp|gif|mp3|m4a|ogg|wav|mp4|txt)$/.test(f.ext) ? `<a class="boton secundario" href="${esc(verUrl)}" target="_blank" rel="noopener">Ver</a>` : ""}
        <a class="boton" href="${esc(bajarUrl)}" ${f.url.startsWith("data:") ? `download="${esc(f.nombre)}"` : ""}>Descargar</a>
      </div>
    </article>`;
  }

  function vacio(titulo, texto) {
    return `<div class="vacio"><strong>${esc(titulo)}</strong><p>${esc(texto)}</p></div>`;
  }

  function cabezaPagina(titulo, texto, migas) {
    return `<section class="pagina-cabeza"><div class="envoltura">
      ${migas || ""}
      <h1>${esc(titulo)}</h1>
      ${texto ? `<p>${esc(texto)}</p>` : ""}
    </div></section>`;
  }

  function recortar(texto, max) {
    if (!texto || texto.length <= max) return texto || "";
    const corte = texto.slice(0, max);
    return corte.slice(0, corte.lastIndexOf(" ")) + "…";
  }

  /* -------------------------------- Inicio -------------------------------- */
  function vistaInicio() {
    const s = estado.sitio;
    const id = s.identidad;
    const nombre = id.nombre.replace(/^Instituci[oó]n Educativa\s+/i, "");
    const pre = id.nombre.length > nombre.length ? id.nombre.slice(0, id.nombre.length - nombre.length).trim() : "";
    const noticias = estado.noticias;
    const destacada = noticias.find((n) => n.destacada) || noticias[0];
    const resto = noticias.filter((n) => n !== destacada).slice(0, 4);

    const niveles = id.niveles && id.niveles.length ? `${id.niveles[0].split(",")[0]} a ${id.niveles[id.niveles.length - 1].split(",")[0].replace(/ vocacional/i, "")}` : "";
    const datos = [
      ["Niveles", niveles],
      ["Jornada", id.jornada],
      ["Carácter", id.caracter],
      ["Código DANE", id.dane],
    ].filter(([, v]) => v);

    vista.innerHTML = `
    <section class="portada">
      <div class="envoltura portada-rejilla">
        <div>
          ${pre ? `<p class="portada-pre">${esc(pre)}</p>` : ""}
          <h1 class="portada-nombre">${esc(nombre)}</h1>
          ${id.lema ? `<span class="cinta"><span>${esc(id.lema)}</span></span>` : ""}
          <p class="portada-texto">${esc(id.presentacion)}</p>
          <div class="portada-acciones">
            <a class="boton" href="#noticias">Ver noticias</a>
            <a class="boton secundario" href="#documentos">Consultar documentos</a>
          </div>
        </div>
        <div class="portada-escudo"><img src="${esc(escudoUrl())}" alt="Escudo de la ${esc(id.nombre)}" width="720" height="708" fetchpriority="high"></div>
      </div>
    </section>
    <section class="datos" aria-label="Datos de la institución">
      <dl class="envoltura">${datos.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
    </section>

    <section class="seccion">
      <div class="envoltura">
        <div class="seccion-cabeza">
          <h2>Noticias</h2>
          ${noticias.length ? `<a class="enlace-mas" href="#noticias">Ver todas las noticias</a>` : ""}
        </div>
        ${
          destacada
            ? `<div class="noticias-portada">
          <a class="destacada" href="#noticia-${esc(destacada.id)}">
            ${imagenNoticia(destacada)}
            ${metaNoticia(destacada)}
            <h3>${esc(destacada.titulo)}</h3>
            ${destacada.resumen ? `<p>${esc(destacada.resumen)}</p>` : ""}
          </a>
          <div class="lista-noticias">
            ${resto
              .map(
                (n) => `<a href="#noticia-${esc(n.id)}">
              ${imagenNoticia(n, "imagen-noticia miniatura", false)}
              <div><div class="meta"><span class="categoria-texto">${esc(n.categoria)}</span><time datetime="${esc(n.fecha)}">${esc(fecha(n.fecha))}</time></div><h3>${esc(n.titulo)}</h3></div>
            </a>`
              )
              .join("")}
          </div>
        </div>`
            : vacio("Aún no hay noticias publicadas", "Las noticias, eventos y comunicados de la institución aparecerán aquí.")
        }
      </div>
    </section>

    <section class="seccion">
      <div class="envoltura">
        <div class="seccion-cabeza"><h2>Quiénes somos</h2></div>
        <div class="identidad">
          <div><h3>Misión</h3><p>${esc(recortar(s.mision, 330))}</p></div>
          <div><h3>Visión</h3><p>${esc(recortar(s.vision, 330))}</p></div>
        </div>
        <div class="identidad-pie">
          <div class="valores-linea">${(s.valores.sociales || []).slice(0, 7).map((v) => `<span class="chip">${esc(v)}</span>`).join("")}</div>
          <a class="enlace-mas" href="#institucion">Conocer la institución</a>
        </div>
      </div>
    </section>

    <section class="seccion">
      <div class="envoltura">
        <div class="seccion-cabeza">
          <div><h2>Documentos recientes</h2><p>Circulares, formatos y documentos institucionales para estudiantes y familias.</p></div>
          ${estado.archivos.length ? `<a class="enlace-mas" href="#documentos">Ver todos los documentos</a>` : ""}
        </div>
        ${
          estado.archivos.length
            ? `<div class="documentos-lista">${estado.archivos.slice(0, 5).map(filaDocumento).join("")}</div>`
            : vacio("Aún no hay documentos publicados", "Aquí se podrán descargar el PEI, el manual de convivencia, circulares y formatos.")
        }
      </div>
    </section>

    <section class="seccion">
      <div class="envoltura visita">
        <div>
          <h2 style="font-size:var(--t-2xl)">Visítanos</h2>
          <p style="margin-top:.75rem;color:var(--gris);max-width:30rem">${esc(s.historia.introduccion.split(". ")[0])}.</p>
          ${s.contacto.mapa ? `<p style="margin-top:1.5rem"><a class="boton secundario" href="${esc(s.contacto.mapa)}" target="_blank" rel="noopener">Abrir en Google Maps</a></p>` : ""}
        </div>
        ${fichaContacto()}
      </div>
    </section>`;
  }

  function fichaContacto() {
    const c = estado.sitio.contacto;
    const filas = [
      ["Dirección", esc(c.direccion)],
      ["Horario", esc(c.horario)],
      ["Teléfono", c.telefono ? copiable(c.telefono, `tel:${c.telefono.replace(/[^\d+]/g, "")}`) : ""],
      ["WhatsApp", c.whatsapp ? copiable(c.whatsapp, `https://wa.me/${c.whatsapp.replace(/\D/g, "").replace(/^(?!57)/, "57")}`) : ""],
      ["Correo", c.correo ? copiable(c.correo, `mailto:${c.correo}`) : ""],
      ["Facebook", c.facebook ? `<a href="${esc(c.facebook)}" target="_blank" rel="noopener">Ver página</a>` : ""],
    ].filter(([, v]) => v);
    return `<dl class="ficha">${filas.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>`;
  }

  function copiable(texto, href) {
    return `<span class="copiable"><a href="${esc(href)}" ${/^https/.test(href) ? 'target="_blank" rel="noopener"' : ""}>${esc(texto)}</a><button class="copiar" type="button" data-copiar="${esc(texto)}">Copiar</button></span>`;
  }

  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-copiar]");
    if (!b) return;
    const texto = b.dataset.copiar;
    try {
      await navigator.clipboard.writeText(texto);
      G.toast("Copiado: " + texto);
    } catch {
      const r = document.createRange();
      r.selectNodeContents(b.previousElementSibling);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      G.toast("Texto seleccionado. Cópialo con Ctrl+C o mantén presionado.");
    }
  });

  /* ------------------------------ Institución ------------------------------ */
  function vistaInstitucion() {
    const s = estado.sitio;
    const id = s.identidad;
    const secciones = [
      ["historia", "Historia"],
      ["mision", "Misión y visión"],
      ["filosofia", "Filosofía"],
      ["valores", "Valores"],
      ["perfil", "Perfil del estudiante"],
      ["proyectos", "Proyectos"],
      ["datos", "Datos"],
    ];
    vista.innerHTML = `
    ${cabezaPagina("Nuestra institución", id.eslogan ? `${id.eslogan}. Conoce la historia, los principios y los proyectos que orientan la vida escolar en El Guineo.` : "")}
    <nav class="subnav" aria-label="Secciones"><div class="envoltura">
      ${secciones.map(([k, t]) => `<button type="button" data-ir="${k}">${t}</button>`).join("")}
    </div></nav>
    <div class="envoltura">
      <section class="bloque" id="b-historia">
        <h2>Reseña histórica</h2>
        <div class="bloque-cuerpo">
          <p class="texto-grande">${esc(s.historia.introduccion)}</p>
          <ol class="linea-tiempo">
            ${(s.historia.hitos || []).map((h) => `<li><span class="anio">${esc(h.anio)}</span><p>${esc(h.texto)}</p></li>`).join("")}
          </ol>
        </div>
      </section>
      <section class="bloque" id="b-mision">
        <h2>Misión y visión</h2>
        <div class="bloque-cuerpo">
          <h3>Misión</h3>
          <p class="texto-grande">${esc(s.mision)}</p>
          <h3>Visión</h3>
          <p class="texto-grande">${esc(s.vision)}</p>
        </div>
      </section>
      <section class="bloque" id="b-filosofia">
        <h2>Filosofía</h2>
        <div class="bloque-cuerpo">
          ${(s.filosofia || []).map((p) => `<p>${esc(p)}</p>`).join("")}
          ${s.principios && s.principios.length ? `<h3>Principios</h3><ul class="lista-principios">${s.principios.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}
          ${s.pilares && s.pilares.length ? `<h3>Pilares de la convivencia</h3><ul class="lista-principios">${s.pilares.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}
        </div>
      </section>
      <section class="bloque" id="b-valores">
        <h2>Valores institucionales</h2>
        <div class="bloque-cuerpo">
          ${s.valores.introduccion ? `<p class="texto-grande">${esc(s.valores.introduccion)}</p>` : ""}
          <div class="grupos-valores">
            ${grupoValores("Valores sociales", s.valores.sociales)}
            ${grupoValores("Valores espirituales", s.valores.espirituales)}
            ${grupoValores("Valores intelectuales", s.valores.intelectuales)}
          </div>
        </div>
      </section>
      <section class="bloque" id="b-perfil">
        <h2>Perfil del estudiante</h2>
        <div class="bloque-cuerpo">
          <p>El estudiante de la ${esc(id.nombre)}, como persona de bien y apta para desarrollarse en sociedad, se reconoce por ser:</p>
          <div class="valores-linea">${(s.perfilEstudiante || []).map((v) => `<span class="chip">${esc(v)}</span>`).join("")}</div>
        </div>
      </section>
      <section class="bloque" id="b-proyectos">
        <h2>Proyectos pedagógicos</h2>
        <div class="bloque-cuerpo" style="max-width:none">
          <div class="proyectos">${(s.proyectos || []).map((p) => `<div class="proyecto"><h3>${esc(p.nombre)}</h3><p>${esc(p.detalle)}</p></div>`).join("")}</div>
        </div>
      </section>
      <section class="bloque" id="b-datos">
        <h2>Datos de la institución</h2>
        <div class="bloque-cuerpo">
          <table class="tabla-datos"><tbody>
            ${[
              ["Nombre", id.nombre],
              ["Rector", id.rector],
              ["Carácter", id.caracter],
              ["Código DANE", id.dane],
              ["NIT", id.nit],
              ["Núcleo", id.nucleo],
              ["Jornada", id.jornada],
              ["Ubicación", [`Corregimiento ${id.corregimiento}`, id.municipio, id.departamento].filter(Boolean).join(", ")],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => `<tr><th scope="row">${k}</th><td>${esc(v)}</td></tr>`)
              .join("")}
            ${id.niveles && id.niveles.length ? `<tr><th scope="row">Niveles</th><td>${id.niveles.map(esc).join("<br>")}</td></tr>` : ""}
            ${id.resoluciones && id.resoluciones.length ? `<tr><th scope="row">Resoluciones</th><td>${id.resoluciones.map(esc).join("<br>")}</td></tr>` : ""}
          </tbody></table>
        </div>
      </section>
    </div>`;

    const botones = vista.querySelectorAll("[data-ir]");
    botones.forEach((b) =>
      b.addEventListener("click", () => {
        const destino = document.getElementById("b-" + b.dataset.ir);
        destino && destino.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      })
    );
    if ("IntersectionObserver" in window) {
      const obs = new IntersectionObserver(
        (entradas) => {
          entradas.forEach((en) => {
            if (en.isIntersecting) {
              const k = en.target.id.slice(2);
              botones.forEach((b) => b.classList.toggle("activo", b.dataset.ir === k));
            }
          });
        },
        { rootMargin: "-40% 0px -55% 0px" }
      );
      vista.querySelectorAll(".bloque").forEach((b) => obs.observe(b));
    }
  }

  function grupoValores(titulo, lista) {
    if (!lista || !lista.length) return "";
    return `<div><h3>${esc(titulo)}</h3><div class="valores-linea">${lista.map((v) => `<span class="chip">${esc(v)}</span>`).join("")}</div></div>`;
  }

  /* -------------------------------- Símbolos -------------------------------- */
  function vistaSimbolos() {
    const s = estado.sitio;
    const sim = s.simbolos;
    const himno = sim.himno || {};
    const estrofas = (himno.letra || "")
      .split(/\n\s*\n/)
      .map((e) => e.trim())
      .filter(Boolean);
    vista.innerHTML = `
    ${cabezaPagina("Símbolos institucionales", "Los símbolos representan la identidad de la comunidad guineísta: su tierra, su gente y su compromiso con el estudio.")}
    <div class="envoltura">
      <section class="simbolo">
        <div class="simbolo-imagen"><img src="${esc(escudoUrl())}" alt="Escudo de la ${esc(s.identidad.nombre)}"></div>
        <div>
          <h2>El escudo</h2>
          ${s.identidad.lema ? `<span class="cinta"><span>${esc(s.identidad.lema)}</span></span>` : ""}
          <dl class="elementos">
            ${(sim.escudoElementos || []).map((e) => `<div><dt>${esc(e.nombre)}</dt><dd>${esc(e.texto)}</dd></div>`).join("")}
          </dl>
        </div>
      </section>
      ${
        sim.banderaUrl || sim.banderaDescripcion
          ? `<section class="simbolo">
        ${sim.banderaUrl ? `<div class="simbolo-imagen bandera"><img src="${esc(sim.banderaUrl)}" alt="Bandera de la ${esc(s.identidad.nombre)}"></div>` : "<div></div>"}
        <div><h2>La bandera</h2>${(sim.banderaDescripcion || "")
          .split(/\n+/)
          .filter(Boolean)
          .map((p) => `<p style="margin-bottom:1rem">${esc(p)}</p>`)
          .join("")}</div>
      </section>`
          : ""
      }
      ${
        himno.letra || himno.audioUrl
          ? `<section class="simbolo">
        <div>
          <h2>${esc(himno.titulo || "El himno")}</h2>
          ${himno.autor ? `<p class="himno-autor">${esc(himno.autor)}</p>` : ""}
          ${himno.audioUrl ? `<audio controls preload="none" src="${esc(himno.audioUrl)}" style="margin-top:1rem"></audio>` : ""}
        </div>
        <div class="himno">${estrofas
          .map((e) => {
            const coro = /^(coro|estribillo)\b/i.test(e);
            return `<p class="${coro ? "coro" : ""}">${esc(e).replace(/\n/g, "<br>")}</p>`;
          })
          .join("")}</div>
      </section>`
          : ""
      }
    </div>`;
  }

  /* -------------------------------- Noticias -------------------------------- */
  const filtro = { categoria: "", texto: "", pagina: 1 };

  function vistaNoticias() {
    const cats = Array.from(new Set(estado.noticias.map((n) => n.categoria).filter(Boolean)));
    vista.innerHTML = `
    ${cabezaPagina("Noticias", "Eventos, comunicados y logros de nuestra comunidad educativa.")}
    <section class="seccion"><div class="envoltura">
      ${
        estado.noticias.length
          ? `<div class="filtros">
        <div class="chips" role="group" aria-label="Filtrar por categoría">
          <button type="button" data-cat="" aria-pressed="${!filtro.categoria}">Todas</button>
          ${cats.map((c) => `<button type="button" data-cat="${esc(c)}" aria-pressed="${filtro.categoria === c}">${esc(c)}</button>`).join("")}
        </div>
        <label class="visualmente-oculto" for="buscar-noticias">Buscar noticias</label>
        <input type="search" id="buscar-noticias" placeholder="Buscar noticias" value="${esc(filtro.texto)}">
      </div>
      <div id="resultados"></div>`
          : vacio("Aún no hay noticias publicadas", "Cuando la institución publique noticias, eventos o comunicados, los verás aquí.")
      }
    </div></section>`;
    if (!estado.noticias.length) return;
    vista.querySelectorAll("[data-cat]").forEach((b) =>
      b.addEventListener("click", () => {
        filtro.categoria = b.dataset.cat;
        filtro.pagina = 1;
        vista.querySelectorAll("[data-cat]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        pintarResultados();
      })
    );
    $("#buscar-noticias").addEventListener("input", (e) => {
      filtro.texto = e.target.value;
      filtro.pagina = 1;
      pintarResultados();
    });
    pintarResultados();
  }

  function normalizar(t) {
    return String(t || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
  }

  function pintarResultados() {
    const q = normalizar(filtro.texto.trim());
    const lista = estado.noticias.filter(
      (n) => (!filtro.categoria || n.categoria === filtro.categoria) && (!q || normalizar(n.titulo + " " + n.resumen).includes(q))
    );
    const visibles = lista.slice(0, filtro.pagina * POR_PAGINA);
    const cont = $("#resultados");
    if (!lista.length) {
      cont.innerHTML = vacio("Sin resultados", "Prueba con otra palabra o elige otra categoría.");
      return;
    }
    cont.innerHTML = `<div class="rejilla-noticias">${visibles
      .map(
        (n) => `<a class="tarjeta-noticia" href="#noticia-${esc(n.id)}">
        ${imagenNoticia(n)}
        ${metaNoticia(n)}
        <h2>${esc(n.titulo)}</h2>
        ${n.resumen ? `<p>${esc(recortar(n.resumen, 170))}</p>` : ""}
      </a>`
      )
      .join("")}</div>
      ${lista.length > visibles.length ? `<div class="mas-resultados"><button class="boton secundario" type="button" id="ver-mas">Ver más noticias</button></div>` : ""}`;
    const mas = $("#ver-mas");
    if (mas)
      mas.addEventListener("click", () => {
        filtro.pagina++;
        pintarResultados();
      });
  }

  /* ---------------------------- Detalle de noticia ---------------------------- */
  let galeriaActual = [];

  async function vistaNoticia(idNoticia) {
    let n = estado.noticias.find((x) => x.id === idNoticia);
    if (!n) {
      try {
        n = await G.noticia(idNoticia);
      } catch (e) {
        document.title = "Noticia no encontrada, " + estado.sitio.identidad.nombre;
        vista.innerHTML = `${cabezaPagina("Noticia no encontrada", "")}<section class="seccion"><div class="envoltura">${vacio(
          "No encontramos esta noticia",
          "Puede que la hayan retirado o que el enlace esté incompleto."
        )}<p style="margin-top:1.5rem"><a class="boton" href="#noticias">Ver todas las noticias</a></p></div></section>`;
        return;
      }
    }
    document.title = `${n.titulo}, ${estado.sitio.identidad.nombre}`;
    galeriaActual = n.galeria || [];
    const otras = estado.noticias.filter((x) => x.id !== n.id).slice(0, 3);
    const enlace = G.enlaceCompartir(n.id);
    const textoWa = encodeURIComponent(`${n.titulo}\n${enlace}`);
    vista.innerHTML = `
    <article class="articulo"><div class="envoltura">
      <div class="articulo-cabeza">
        <nav class="migas" aria-label="Ruta"><a href="#inicio">Inicio</a><span aria-hidden="true">/</span><a href="#noticias">Noticias</a></nav>
        ${n.categoria ? `<span class="banderin">${esc(n.categoria)}</span>` : ""}
        <h1>${esc(n.titulo)}</h1>
        ${n.resumen ? `<p class="resumen">${esc(n.resumen)}</p>` : ""}
        <div class="meta"><time datetime="${esc(n.fecha)}">${esc(fecha(n.fecha))}</time>${n.estado === "borrador" ? `<span class="categoria-texto">Borrador, no visible al público</span>` : ""}</div>
      </div>
      ${n.portada && n.portada.url ? `<figure class="articulo-portada"><img src="${esc(n.portada.url)}" alt=""></figure>` : ""}
      <div class="articulo-cuerpo">
        <div>
          <div class="prosa">${G.limpiarHtml(n.cuerpo)}</div>
          ${
            galeriaActual.length
              ? `<h2 style="font-size:var(--t-xl);margin-top:3rem">Galería</h2><div class="galeria">${galeriaActual
                  .map((g, i) => `<button type="button" data-foto="${i}" aria-label="Ampliar foto ${i + 1}${g.pie ? ": " + esc(g.pie) : ""}"><img src="${esc(g.url)}" alt="${esc(g.pie || "")}" loading="lazy"></button>`)
                  .join("")}</div>`
              : ""
          }
        </div>
        <aside class="articulo-lateral">
          ${
            n.adjuntos && n.adjuntos.length
              ? `<div><h2>Documentos adjuntos</h2><div class="adjuntos">${n.adjuntos
                  .map((a) => {
                    const ext = (a.url.split("?")[0].match(/\.([a-z0-9]{1,5})$/i) || [, a.tipo.split("/")[1] || "doc"])[1];
                    return `<a class="adjunto" href="${esc(a.url)}" target="_blank" rel="noopener"><span class="tipo-archivo" data-familia="${familia(ext)}" aria-hidden="true">${esc(ext.slice(0, 4))}</span><span>${esc(a.titulo)}<small>${esc(tamano(a.tamano))}</small></span></a>`;
                  })
                  .join("")}</div></div>`
              : ""
          }
          <div>
            <h2>Compartir</h2>
            <div class="compartir">
              <a class="boton secundario" href="https://wa.me/?text=${textoWa}" target="_blank" rel="noopener">WhatsApp</a>
              <a class="boton secundario" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(enlace)}" target="_blank" rel="noopener">Facebook</a>
              <button class="boton secundario" type="button" data-copiar="${esc(enlace)}">Copiar enlace</button>
            </div>
          </div>
          ${
            otras.length
              ? `<div><h2>Otras noticias</h2><div class="lista-noticias">${otras
                  .map((o) => `<a href="#noticia-${esc(o.id)}">${imagenNoticia(o, "imagen-noticia miniatura", false)}<div><div class="meta"><time>${esc(fecha(o.fecha))}</time></div><h3>${esc(o.titulo)}</h3></div></a>`)
                  .join("")}</div></div>`
              : ""
          }
        </aside>
      </div>
    </div></article>`;
    vista.querySelectorAll("[data-foto]").forEach((b) => b.addEventListener("click", () => abrirVisor(Number(b.dataset.foto))));
  }

  /* Visor de fotos */
  let fotoActual = 0;
  const visor = $("#visor");
  function abrirVisor(i) {
    fotoActual = i;
    mostrarFoto();
    visor.hidden = false;
    $("#visor-cerrar").focus();
    document.body.style.overflow = "hidden";
  }
  function mostrarFoto() {
    const g = galeriaActual[fotoActual];
    if (!g) return;
    $("#visor-img").src = g.url;
    $("#visor-img").alt = g.pie || "";
    $("#visor-pie").textContent = g.pie || `${fotoActual + 1} de ${galeriaActual.length}`;
    $("#visor-anterior").hidden = $("#visor-siguiente").hidden = galeriaActual.length < 2;
  }
  function cerrarVisor() {
    visor.hidden = true;
    document.body.style.overflow = "";
  }
  $("#visor-cerrar").addEventListener("click", cerrarVisor);
  $("#visor-anterior").addEventListener("click", () => {
    fotoActual = (fotoActual - 1 + galeriaActual.length) % galeriaActual.length;
    mostrarFoto();
  });
  $("#visor-siguiente").addEventListener("click", () => {
    fotoActual = (fotoActual + 1) % galeriaActual.length;
    mostrarFoto();
  });
  visor.addEventListener("click", (e) => {
    if (e.target === visor) cerrarVisor();
  });
  document.addEventListener("keydown", (e) => {
    if (visor.hidden) return;
    if (e.key === "Escape") cerrarVisor();
    if (e.key === "ArrowLeft") $("#visor-anterior").click();
    if (e.key === "ArrowRight") $("#visor-siguiente").click();
  });

  /* ------------------------------- Documentos ------------------------------- */
  const filtroDocs = { texto: "", categoria: "" };

  function vistaDocumentos() {
    const docs = estado.archivos;
    const cats = Array.from(new Set(docs.map((d) => d.categoria).filter(Boolean)));
    vista.innerHTML = `
    ${cabezaPagina("Documentos", "Consulta y descarga los documentos oficiales, circulares y formatos de la institución.")}
    <section class="seccion"><div class="envoltura">
      ${
        docs.length
          ? `<div class="filtros">
        <div class="chips" role="group" aria-label="Filtrar por categoría">
          <button type="button" data-dcat="" aria-pressed="${!filtroDocs.categoria}">Todos</button>
          ${cats.map((c) => `<button type="button" data-dcat="${esc(c)}" aria-pressed="${filtroDocs.categoria === c}">${esc(c)}</button>`).join("")}
        </div>
        <label class="visualmente-oculto" for="buscar-docs">Buscar documentos</label>
        <input type="search" id="buscar-docs" placeholder="Buscar documentos" value="${esc(filtroDocs.texto)}">
      </div>
      <div id="lista-docs"></div>`
          : vacio("Aún no hay documentos publicados", "Cuando la institución publique documentos, podrás verlos y descargarlos desde aquí.")
      }
    </div></section>`;
    if (!docs.length) return;
    vista.querySelectorAll("[data-dcat]").forEach((b) =>
      b.addEventListener("click", () => {
        filtroDocs.categoria = b.dataset.dcat;
        vista.querySelectorAll("[data-dcat]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        pintarDocs();
      })
    );
    $("#buscar-docs").addEventListener("input", (e) => {
      filtroDocs.texto = e.target.value;
      pintarDocs();
    });
    pintarDocs();
  }

  function pintarDocs() {
    const q = normalizar(filtroDocs.texto.trim());
    const lista = estado.archivos.filter(
      (d) => (!filtroDocs.categoria || d.categoria === filtroDocs.categoria) && (!q || normalizar(d.titulo + " " + d.descripcion + " " + d.nombre).includes(q))
    );
    const cont = $("#lista-docs");
    if (!lista.length) {
      cont.innerHTML = vacio("Sin resultados", "Prueba con otra palabra o elige otra categoría.");
      return;
    }
    const orden = (estado.sitio.documentos && estado.sitio.documentos.categorias) || [];
    const grupos = {};
    lista.forEach((d) => (grupos[d.categoria] = grupos[d.categoria] || []).push(d));
    const nombres = Object.keys(grupos).sort((a, b) => {
      const ia = orden.indexOf(a), ib = orden.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    });
    cont.innerHTML = nombres
      .map((c) => `<section class="grupo-documentos"><h2>${esc(c)}</h2><div class="documentos-lista">${grupos[c].map(filaDocumento).join("")}</div></section>`)
      .join("");
  }

  /* -------------------------------- Contacto -------------------------------- */
  function vistaContacto() {
    const s = estado.sitio;
    const c = s.contacto;
    vista.innerHTML = `
    ${cabezaPagina("Contacto", "Te esperamos en el corregimiento El Guineo. Comunícate con la institución por cualquiera de estos medios.")}
    <div class="envoltura contacto-rejilla">
      <div>
        ${fichaContacto()}
        ${c.mapa ? `<p style="margin-top:1.75rem"><a class="boton" href="${esc(c.mapa)}" target="_blank" rel="noopener">Cómo llegar en Google Maps</a></p>` : ""}
      </div>
      <div>
        <h2 style="font-size:var(--t-xl);margin-bottom:1rem">Sedes</h2>
        <div class="sedes">${(c.sedes || []).map((d) => `<div class="sede"><h3>${esc(d.nombre)}</h3>${d.detalle ? `<p>${esc(d.detalle)}</p>` : ""}</div>`).join("")}</div>
      </div>
    </div>`;
  }

  /* ---------------------------------- Menú ---------------------------------- */
  const menuBoton = $("#menu-boton");
  const nav = $("#navegacion");
  function cerrarMenu() {
    nav.classList.remove("abierta");
    menuBoton.setAttribute("aria-expanded", "false");
  }
  menuBoton.addEventListener("click", () => {
    const abierto = nav.classList.toggle("abierta");
    menuBoton.setAttribute("aria-expanded", String(abierto));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("abierta")) {
      cerrarMenu();
      menuBoton.focus();
    }
  });

  cargar();
})();
