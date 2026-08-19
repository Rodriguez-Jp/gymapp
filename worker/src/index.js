/* Bitácora — API. Worker nativo + D1, sin dependencias.
   El servidor no entiende el objeto DB: lo trata como un blob JSON opaco
   que pertenece a un usuario. Toda la lógica de gym vive en el cliente. */

const ORIGIN = "https://gym.jp-home-lab.com";
/* Cerrado tras crear las dos cuentas (Jp1911 y Mari). Poner en true para
   habilitar /register temporalmente si hace falta una cuenta más. */
const REGISTRATION_OPEN = false;

const CORS = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const TOKEN_DAYS = 90;
const MAX_DATA = 1024 * 1024;
const ITER = 100000;
const USER_RE = /^[A-Za-z0-9_]{3,32}$/;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
const fail = (error, status) => json({ error }, status);

const hex = (buf) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const unhex = (s) => new Uint8Array(s.match(/../g).map((h) => parseInt(h, 16)));

/* ===== contraseñas: PBKDF2-SHA256 vía Web Crypto ===== */
async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    256
  );
  return hex(bits);
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `${hex(salt)}:${await derive(password, salt, ITER)}:${ITER}`;
}

async function verifyPassword(password, stored) {
  const [salt, hash, iter] = String(stored).split(":");
  if (!salt || !hash || !iter) return false;
  return equal(await derive(password, unhex(salt), parseInt(iter, 10)), hash);
}

/* Comparación en tiempo constante: no filtrar cuánto acertó por el tiempo. */
function equal(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ===== tokens ===== */
async function issueToken(env, userId) {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  const now = new Date();
  const expires = new Date(now.getTime() + TOKEN_DAYS * 86400000);
  await env.DB.prepare(
    "INSERT INTO auth_tokens (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
  )
    .bind(token, userId, now.toISOString(), expires.toISOString())
    .run();
  return token;
}

async function authenticate(req, env) {
  const m = (req.headers.get("Authorization") || "").match(/^Bearer\s+(\S+)$/i);
  if (!m) return null;
  const row = await env.DB.prepare(
    "SELECT user_id, expires_at FROM auth_tokens WHERE token = ?"
  )
    .bind(m[1])
    .first();
  if (!row) return null;
  if (new Date(row.expires_at) <= new Date()) {
    await env.DB.prepare("DELETE FROM auth_tokens WHERE token = ?")
      .bind(m[1])
      .run();
    return null;
  }
  return { userId: row.user_id, token: m[1] };
}

async function readBody(req) {
  try {
    const b = await req.json();
    return b && typeof b === "object" ? b : null;
  } catch {
    return null;
  }
}

/* ===== rutas ===== */
async function register(req, env) {
  const body = await readBody(req);
  if (!body) return fail("cuerpo inválido", 400);
  const { username, password } = body;

  if (typeof username !== "string" || !USER_RE.test(username))
    return fail("usuario: 3–32 caracteres, letras, números o guión bajo", 400);
  if (typeof password !== "string" || password.length < 8)
    return fail("la contraseña necesita al menos 8 caracteres", 400);

  const exists = await env.DB.prepare("SELECT id FROM users WHERE username = ?")
    .bind(username)
    .first();
  if (exists) return fail("usuario ya existe", 409);

  const res = await env.DB.prepare(
    "INSERT INTO users (username, pass_hash, created_at) VALUES (?, ?, ?)"
  )
    .bind(username, await hashPassword(password), new Date().toISOString())
    .run();

  return json({ token: await issueToken(env, res.meta.last_row_id) });
}

async function login(req, env) {
  const body = await readBody(req);
  if (!body) return fail("cuerpo inválido", 400);
  const { username, password } = body;
  if (typeof username !== "string" || typeof password !== "string")
    return fail("faltan usuario o contraseña", 400);

  const user = await env.DB.prepare(
    "SELECT id, pass_hash FROM users WHERE username = ?"
  )
    .bind(username)
    .first();
  /* Mismo mensaje para usuario inexistente y contraseña mala: no revelar cuál. */
  if (!user || !(await verifyPassword(password, user.pass_hash)))
    return fail("usuario o contraseña incorrectos", 401);

  return json({ token: await issueToken(env, user.id) });
}

async function loadData(env, auth) {
  const row = await env.DB.prepare(
    "SELECT data, updated_at FROM user_data WHERE user_id = ?"
  )
    .bind(auth.userId)
    .first();
  if (!row) return json({ data: null, updated_at: null });
  try {
    return json({ data: JSON.parse(row.data), updated_at: row.updated_at });
  } catch {
    return fail("los datos guardados están corruptos", 500);
  }
}

async function saveData(req, env, auth) {
  const body = await readBody(req);
  if (!body || !("data" in body)) return fail("falta data", 400);
  if (body.data === null || typeof body.data !== "object")
    return fail("data debe ser un objeto", 400);

  const serialized = JSON.stringify(body.data);
  if (serialized.length > MAX_DATA) return fail("data demasiado grande", 413);

  const updated_at = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO user_data (user_id, data, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
  )
    .bind(auth.userId, serialized, updated_at)
    .run();

  return json({ ok: true, updated_at });
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    const { pathname } = new URL(req.url);
    const post = req.method === "POST";
    const get = req.method === "GET";

    if (post && pathname === "/register")
      return REGISTRATION_OPEN ? register(req, env) : fail("registro cerrado", 403);
    if (post && pathname === "/login") return login(req, env);

    if ((get && pathname === "/load") || (post && pathname === "/save") || (post && pathname === "/logout")) {
      const auth = await authenticate(req, env);
      if (!auth) return fail("token inválido o expirado", 401);

      if (pathname === "/load") return loadData(env, auth);
      if (pathname === "/save") return saveData(req, env, auth);
      await env.DB.prepare("DELETE FROM auth_tokens WHERE token = ?").bind(auth.token).run();
      return json({ ok: true });
    }

    return fail("no existe", 404);
  },
};
