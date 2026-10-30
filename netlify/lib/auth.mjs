import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { HttpError, stores } from "./util.mjs";

const scryptAsync = promisify(scrypt);
const SESSION_HOURS = 12;
const MAX_FAILS = 8;
const LOCK_MINUTES = 15;

// Credenciales iniciales. Se pueden cambiar desde el panel (Ajustes) o con
// las variables de entorno ADMIN_USER y ADMIN_PASSWORD en Netlify.
const INITIAL_USER = process.env.ADMIN_USER || "admin";
const INITIAL_PASSWORD = process.env.ADMIN_PASSWORD || "adminguineo";

const b64 = (buf) => Buffer.from(buf).toString("base64url");
const sha = (s) => createHash("sha256").update(String(s)).digest();

function safeEqual(a, b) {
  const x = Buffer.isBuffer(a) ? a : Buffer.from(a);
  const y = Buffer.isBuffer(b) ? b : Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

async function hashPassword(password, salt) {
  const key = await scryptAsync(String(password), salt, 32, { N: 16384, r: 8, p: 1 });
  return b64(key);
}

async function getSecret() {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) return process.env.SESSION_SECRET;
  const store = stores.config();
  let secret = await store.get("secret");
  if (secret) return secret;
  const fresh = randomBytes(32).toString("hex");
  await store.set("secret", fresh, { onlyIfNew: true });
  secret = await store.get("secret");
  return secret || fresh;
}

async function getAuthRecord() {
  const record = await stores.config().get("auth", { type: "json" });
  if (record && record.usuario && record.hash) return record;
  return null;
}

// Recuperación de acceso: si en Netlify se define RESTABLECER_ACCESO con un
// código nuevo, el primer ingreso con las credenciales iniciales borra la
// contraseña guardada. Cada código sirve una sola vez.
async function maybeReset(usuario, clave) {
  const code = process.env.RESTABLECER_ACCESO;
  if (!code) return false;
  if (!(safeEqual(sha(usuario), sha(INITIAL_USER)) & safeEqual(sha(clave), sha(INITIAL_PASSWORD)))) return false;
  const store = stores.config();
  const usado = await store.get("restablecer-usado");
  if (usado === sha(code).toString("hex")) return false;
  await store.delete("auth");
  await store.set("restablecer-usado", sha(code).toString("hex"));
  return true;
}

async function checkCredentials(usuario, clave) {
  await maybeReset(usuario, clave);
  const record = await getAuthRecord();
  if (!record) {
    const ok = safeEqual(sha(usuario), sha(INITIAL_USER)) & safeEqual(sha(clave), sha(INITIAL_PASSWORD));
    return ok ? { usuario: INITIAL_USER, version: 0, inicial: true } : null;
  }
  const hash = await hashPassword(clave, record.salt);
  const ok = safeEqual(sha(usuario.toLowerCase()), sha(record.usuario.toLowerCase())) & safeEqual(hash, record.hash);
  return ok ? { usuario: record.usuario, version: record.version || 1, inicial: false } : null;
}

function ipKey(context, req) {
  const ip = context?.ip || req.headers.get("x-nf-client-connection-ip") || "local";
  return "intentos/" + createHash("sha256").update(ip).digest("hex").slice(0, 24);
}

async function assertNotLocked(key) {
  const entry = await stores.config().get(key, { type: "json" });
  if (entry && entry.n >= MAX_FAILS && Date.now() - entry.desde < LOCK_MINUTES * 60_000) {
    throw new HttpError(429, `Demasiados intentos fallidos. Espera ${LOCK_MINUTES} minutos e intenta de nuevo.`);
  }
  return entry;
}

async function registerFail(key, entry) {
  const now = Date.now();
  const fresh = !entry || now - entry.desde > LOCK_MINUTES * 60_000;
  await stores.config().setJSON(key, fresh ? { n: 1, desde: now } : { n: entry.n + 1, desde: entry.desde });
}

async function signToken(payload) {
  const secret = await getSecret();
  const body = b64(JSON.stringify(payload));
  const sig = b64(createHmac("sha256", secret).update(body).digest());
  return `${body}.${sig}`;
}

export async function login(req, context, { usuario, clave }) {
  usuario = String(usuario || "").trim();
  clave = String(clave || "");
  if (!usuario || !clave) throw new HttpError(400, "Escribe el usuario y la contraseña.");
  const key = ipKey(context, req);
  const fails = await assertNotLocked(key);
  const ok = await checkCredentials(usuario, clave);
  if (!ok) {
    await registerFail(key, fails);
    await new Promise((r) => setTimeout(r, 500));
    throw new HttpError(401, "El usuario o la contraseña no son correctos.");
  }
  if (fails) await stores.config().delete(key);
  const exp = Date.now() + SESSION_HOURS * 3600_000;
  const token = await signToken({ u: ok.usuario, v: ok.version, exp });
  return { token, usuario: ok.usuario, claveInicial: ok.inicial, expira: exp };
}

export async function requireAdmin(req) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const [body, sig] = token.split(".");
  if (!body || !sig) throw new HttpError(401, "Inicia sesión para continuar.");
  const secret = await getSecret();
  const expected = b64(createHmac("sha256", secret).update(body).digest());
  if (!safeEqual(sig, expected)) throw new HttpError(401, "Tu sesión no es válida. Inicia sesión de nuevo.");
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    throw new HttpError(401, "Tu sesión no es válida. Inicia sesión de nuevo.");
  }
  if (!payload.exp || payload.exp < Date.now()) throw new HttpError(401, "Tu sesión terminó. Inicia sesión de nuevo.");
  const record = await getAuthRecord();
  const version = record ? record.version || 1 : 0;
  if (payload.v !== version) throw new HttpError(401, "La contraseña cambió. Inicia sesión de nuevo.");
  return { usuario: payload.u, claveInicial: !record };
}

export async function changeCredentials(admin, { claveActual, usuarioNuevo, claveNueva }) {
  const ok = await checkCredentials(admin.usuario, String(claveActual || ""));
  if (!ok) throw new HttpError(400, "La contraseña actual no es correcta.");
  const usuario = String(usuarioNuevo || admin.usuario).trim();
  const clave = String(claveNueva || "");
  if (!/^[A-Za-z0-9._@-]{3,40}$/.test(usuario)) {
    throw new HttpError(400, "El usuario debe tener entre 3 y 40 caracteres, sin espacios.");
  }
  if (clave.length < 8) throw new HttpError(400, "La nueva contraseña debe tener al menos 8 caracteres.");
  const record = await getAuthRecord();
  const salt = randomBytes(16).toString("hex");
  const next = {
    usuario,
    salt,
    hash: await hashPassword(clave, salt),
    version: (record?.version || 1) + 1,
    actualizado: new Date().toISOString(),
  };
  await stores.config().setJSON("auth", next);
  const exp = Date.now() + SESSION_HOURS * 3600_000;
  const token = await signToken({ u: usuario, v: next.version, exp });
  return { token, usuario, claveInicial: false, expira: exp };
}
