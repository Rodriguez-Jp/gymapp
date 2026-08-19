# Desplegar la Bitácora

Dos caminos. El **A** (panel de Cloudflare, sin terminal) y el **B** (Wrangler).
Hacen lo mismo; elige uno.

Al terminar cualquiera de los dos, salta a **Paso final**.

---

## Camino A — desde el panel de Cloudflare (sin terminal)

### A1. Crear la base de datos

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Storage & Databases** → **D1**.
2. **Create database**. Nombre: `bitacora-db`. Crear.

### A2. Crear las tablas

1. Dentro de `bitacora-db`, pestaña **Console**.
2. Pega el contenido de `worker/schema.sql` y ejecútalo.
3. En **Tables** deben aparecer: `users`, `auth_tokens`, `user_data`.

### A3. Crear el Worker

1. **Compute (Workers)** → **Create** → **Start with Hello World!** → **Deploy**.
   Nombre: `bitacora-api`.
2. Entra al Worker → **Edit code** (`</>`).
3. Borra todo lo que hay y pega el contenido completo de `worker/src/index.js`.
4. **Deploy**.

### A4. Conectar el Worker con la base

1. En el Worker → **Settings** → **Bindings** → **Add** → **D1 database**.
2. **Variable name**: `DB` — exacto, en mayúsculas. El código usa `env.DB`.
3. **D1 database**: `bitacora-db`.
4. Guardar. El Worker se re-despliega solo.

### A5. Copiar la URL

En la pestaña del Worker sale algo como:

```
https://bitacora-api.<tu-subdominio>.workers.dev
```

Cópiala y ve al **Paso final**.

---

## Camino B — con Wrangler

Wrangler 4 pide Node 22 y tú tienes Node 20; usa `npx wrangler@3` o actualiza Node.

```bash
cd worker
npx wrangler@3 login
npx wrangler@3 d1 create bitacora-db     # imprime un database_id
```

Pon ese `database_id` en `wrangler.toml` (reemplaza `PONER_AQUI_EL_ID`), y sigue:

```bash
npx wrangler@3 d1 execute bitacora-db --remote --file=./schema.sql
npx wrangler@3 deploy                     # imprime la URL del Worker
```

---

## Paso final — enchufar la app al Worker

1. En `index.html`, busca:

   ```js
   const API="";                       // URL del Worker — rellenar tras desplegar
   ```

   Pon tu URL, **sin barra al final**:

   ```js
   const API="https://bitacora-api.tu-subdominio.workers.dev";
   ```

   Mientras esté vacío, la app funciona 100% en local, como antes. Ese es el
   interruptor: con URL sincroniza, sin URL no.

2. Sube el cambio y activa GitHub Pages: **Settings → Pages → Branch: main / root**.

3. Abre la app, **Crear cuenta**, y listo.

### Migrar tu historial

En el dispositivo donde ya tienes tus datos: entra por primera vez con tu cuenta
nueva. Tu `localStorage` actual se conserva y se sube solo en el primer push.

Si abres desde un dispositivo limpio, usa **Importar** con tu respaldo
`bitacora-2026-07-15.json` y el siguiente push lo sube.

### Cerrar el CORS (recomendado, cuando la URL esté fija)

En `worker/src/index.js`:

```js
const ORIGIN = "*";
```

Cámbialo a tu origen exacto y vuelve a desplegar:

```js
const ORIGIN = "https://rodriguez-jp.github.io";
```

---

## Comprobar que quedó bien

Con Wrangler:

```bash
npx wrangler@3 d1 execute bitacora-db --remote --command "SELECT username, created_at FROM users"
npx wrangler@3 d1 execute bitacora-db --remote --command "SELECT user_id, updated_at, length(data) FROM user_data"
```

Desde el panel: D1 → `bitacora-db` → **Console**, las mismas consultas.

En `users.pass_hash` debe verse `sal:hash:100000` — nunca tu contraseña.

Prueba de verdad: guarda una sesión en el celular, abre la app en el navegador
del PC con el mismo usuario, y deben estar los datos.
