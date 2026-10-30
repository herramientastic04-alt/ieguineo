# Sitio web de la Institución Educativa El Guineo

Sitio oficial de la I.E. El Guineo (Canalete, Córdoba) con panel de administración.

- **Sitio público:** inicio, institución (historia, misión, visión, filosofía, valores, perfil, proyectos), símbolos, noticias, documentos y contacto.
- **Panel de administración** en `/admin`: publicar noticias con fotos, galería, videos y adjuntos; subir documentos de hasta 18 MB; editar todo el contenido institucional; aviso destacado; cambiar usuario y contraseña.
- **Base de datos:** Netlify Blobs, incluida en Netlify. No hay que crear ni configurar nada.

**Acceso inicial al panel**

| Usuario | Contraseña |
|---|---|
| `admin` | `adminguineo` |

Cámbiala apenas entres, en **Usuario y contraseña**. Mientras uses la inicial, el panel muestra un aviso.

---

## Cómo publicarlo en Netlify

> No uses la opción de arrastrar y soltar la carpeta (Netlify Drop): esa vía no prepara las funciones del panel y el sitio quedaría sin base de datos. Usa una de estas dos opciones.

### Opción A: con GitHub (recomendada, todo desde el navegador)

1. **Crea el repositorio.** Entra a [github.com](https://github.com), crea una cuenta si no tienes y pulsa **New repository**. Nómbralo `ie-el-guineo-web`, elige *Private* si no quieres que el código sea público y pulsa **Create repository**.
2. **Sube los archivos.** En el repositorio vacío, pulsa **uploading an existing file**. Descomprime el ZIP en tu computador, abre la carpeta `ie-el-guineo-web` y arrastra **todo su contenido** (las carpetas `public`, `netlify`, `scripts` y los archivos `netlify.toml`, `package.json`, `package-lock.json`, `README.md`) a la página. Espera a que carguen y pulsa **Commit changes**.
3. **Conecta Netlify.** Entra a [app.netlify.com](https://app.netlify.com) (puedes iniciar sesión con tu cuenta de GitHub). Pulsa **Add new project**, luego **Import an existing project**, elige **GitHub** y selecciona `ie-el-guineo-web`.
4. **Publica.** Netlify lee la configuración del archivo `netlify.toml`, así que no cambies nada: pulsa **Deploy**. En uno o dos minutos el sitio queda en una dirección como `https://nombre-al-azar.netlify.app`.
5. **Pon un nombre fácil.** En **Project configuration**, **Change project name**, escribe por ejemplo `ieelguineo`. La dirección quedará `https://ieelguineo.netlify.app`.
6. **Entra al panel** en `https://ieelguineo.netlify.app/admin` con `admin` y `adminguineo`, y cambia la contraseña.

Cada vez que cambies un archivo en GitHub, Netlify vuelve a publicar solo. Las noticias y documentos **no** se pierden al republicar: viven en Netlify Blobs, no en los archivos.

### Opción B: con la terminal (Netlify CLI)

Necesitas [Node.js](https://nodejs.org) 22 o superior.

```bash
npm install -g netlify-cli
netlify login
cd ie-el-guineo-web
npm install
netlify deploy --prod --site-name ieelguineo
```

La primera vez crea el proyecto en tu cuenta; las siguientes basta con `netlify deploy --prod`.

---

## Uso diario del panel

| Quiero… | Dónde |
|---|---|
| Publicar una noticia, evento o comunicado | **Noticias**, **Nueva noticia** |
| Programar una noticia para otro día | En el editor, pon la fecha futura: se publica sola ese día |
| Subir el PEI, el manual de convivencia, circulares o formatos | **Documentos** |
| Cambiar misión, visión, valores, historia, rector | **Institución** |
| Agregar la bandera o el himno | **Símbolos** (aparecen en el sitio cuando tienen contenido) |
| Poner un aviso urgente en todas las páginas | **Contacto y aviso**, **Aviso destacado** |
| Cambiar teléfono, correo, WhatsApp, sedes | **Contacto y aviso** |

Las fotos se reducen automáticamente antes de subirlas. Los archivos grandes se envían por partes, hasta 18 MB cada uno.

Al compartir una noticia con el botón **WhatsApp** o **Copiar enlace**, el enlace muestra el título, el resumen y la foto de portada en la vista previa.

---

## Si olvidas la contraseña

1. En Netlify, abre el proyecto y entra a **Project configuration**, **Environment variables**.
2. Crea la variable `RESTABLECER_ACCESO` con cualquier código, por ejemplo `nov2026`.
3. Vuelve a publicar: **Deploys**, **Trigger deploy**, **Deploy project**.
4. Entra al panel con `admin` / `adminguineo` (o con `ADMIN_USER` y `ADMIN_PASSWORD` si las definiste). La contraseña olvidada se borra y puedes crear una nueva en **Usuario y contraseña**.

Cada código sirve una sola vez. Si vuelves a olvidarla, cambia el valor de `RESTABLECER_ACCESO` por otro código y repite los pasos.

### Variables de entorno opcionales

En Netlify, **Project configuration**, **Environment variables**:

| Variable | Para qué sirve |
|---|---|
| `ADMIN_USER` | Usuario inicial, en lugar de `admin` |
| `ADMIN_PASSWORD` | Contraseña inicial, en lugar de `adminguineo` |
| `SESSION_SECRET` | Clave para firmar las sesiones. Si no la pones, se genera una al azar y se guarda en Blobs |
| `RESTABLECER_ACCESO` | Recupera el acceso si olvidas la contraseña (ver arriba) |

Si ya cambiaste la contraseña desde el panel, esa es la que vale.

---

## Dónde se guarda cada cosa

| Almacén de Netlify Blobs | Contenido |
|---|---|
| `guineo-contenido` | Textos institucionales (`sitio`), noticias (`noticias`) y la lista de archivos (`archivos`) |
| `guineo-archivos` | Los archivos subidos, divididos en partes |
| `guineo-config` | Usuario, contraseña cifrada y clave de sesiones |

En **Data & Storage**, **Blobs** puedes revisar y descargar estos datos como copia de seguridad.

El contenido inicial (misión, visión, filosofía, valores, historia, proyectos) se tomó del PEI y está en `netlify/lib/defaults.mjs`. Lo que se edita desde el panel tiene prioridad sobre ese archivo.

## Estructura del proyecto

```
public/                 Sitio público y panel (HTML, CSS, JavaScript, imágenes)
  index.html            Sitio público
  admin.html            Panel de administración (/admin)
  assets/
netlify/functions/api.mjs   API: sesión, noticias, archivos, contenido, enlaces para compartir
netlify/lib/            Autenticación, utilidades y contenido inicial del PEI
netlify.toml            Configuración de Netlify
```

Para probarlo en tu computador: `npm install` y luego `npx netlify dev`, y abre `http://localhost:8888`.

Si cambias el contenido inicial en `netlify/lib/defaults.mjs`, ejecuta `npm run defaults` para actualizar la vista previa sin servidor.
