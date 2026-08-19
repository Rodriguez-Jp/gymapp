# Bitácora — Backend en Cloudflare (Worker + D1)

Brief para Claude Code. El objetivo es sacar una app de gym (un solo archivo
`index.html`) del `localStorage` y darle un backend real en Cloudflare, con
cuentas de usuario, para que los datos estén disponibles en cualquier
dispositivo sin importar/exportar JSON a mano.

Este documento tiene TODO el contexto necesario. Léelo completo antes de empezar.

---

## 0. Contexto: qué es la app hoy

`index.html` es una PWA de una sola página, sin build, sin dependencias, sin
framework. Todo el estado vive en un objeto JavaScript llamado `DB` que
actualmente se serializa a `localStorage` bajo la clave `"bitacora_v3"`.

La forma exacta de `DB` es:

```js
DB = {
  log: {
    "2026-07-13": {
      "lun_press_inc::inc_bb": { sets: [ {w:5,r:7}, {w:7.5,r:8} ] },
      "lun_curl::curl_bay":    { sets: [ {w:14,r:8} ] }
      // clave = "slotId::variantId", valor = { sets:[{w,r}, ...] }
      // w = peso en kg (siempre kg internamente), r = repeticiones
    }
    // una entrada por cada fecha ISO (YYYY-MM-DD) en que se entrenó
  },
  start: "2026-07-12",   // fecha ISO de inicio del ciclo de 9 semanas
  bw: 85,                // peso corporal en kg
  unit: "kg",            // "kg" o "lb" — unidad en que el usuario TECLEA
  pick: {                // variante elegida por slot: { slotId: variantId }
    "lun_row_h": "row_stack"
  },
  mode: {                // modo de carga por ejercicio: { "slotId::variantId": modo }
    "lun_row_h::row_stack": "stack"
  },
  bars: { std:20, ez:10, smith:15 },  // peso de barras en kg
  fixedRow: 2            // flag interno de migración, no tocar
}
```

**Lo importante:** el backend NO necesita entender la estructura interna de
`DB`. Para el servidor, `DB` es un blob JSON opaco que pertenece a un usuario.
El servidor solo guarda y devuelve ese blob. Toda la lógica de gym se queda en
el cliente. Esto mantiene el backend simple y evita que cambios futuros en la
rutina requieran tocar el servidor o migrar la base de datos.

---

## 1. Arquitectura objetivo

```
index.html  (GitHub Pages o Cloudflare Pages)
     |
     |  fetch() con token en header Authorization
     v
Cloudflare Worker  (API REST)
     |
     v
Cloudflare D1  (SQLite)
```

**Principio: offline-first con sync.** `localStorage` NO se elimina. Sigue
siendo el buffer inmediato para que la app funcione sin señal (típico en un
gimnasio). El backend pasa a ser la fuente de verdad: al abrir la app se hace
`pull` desde D1, y al guardar una sesión se hace `push` a D1. Si no hay red, se
guarda local y se sincroniza cuando vuelve la conexión.

**Sync deseado: automático** — hace pull al abrir y push al guardar una sesión,
sin botón manual, pero mostrando un pequeño aviso (toast) cuando sincroniza.

---

## 2. Modelo de datos (D1)

Crear estas tres tablas. El esquema debe soportar múltiples usuarios desde el
inicio, aunque de entrada solo se registre uno.

```sql
-- Usuarios
CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT UNIQUE NOT NULL,
  pass_hash  TEXT NOT NULL,       -- PBKDF2, formato: "salt_hex:hash_hex:iteraciones"
  created_at TEXT NOT NULL
);

-- Tokens de sesión (para no pedir login en cada request)
CREATE TABLE IF NOT EXISTS auth_tokens (
  token      TEXT PRIMARY KEY,    -- aleatorio, 32+ bytes en hex
  user_id    INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,       -- p.ej. 90 días desde la creación
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- El blob de datos de cada usuario (el objeto DB serializado)
CREATE TABLE IF NOT EXISTS user_data (
  user_id    INTEGER PRIMARY KEY,
  data       TEXT NOT NULL,       -- JSON.stringify(DB)
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

Guardar el `DB` como un blob JSON (no normalizarlo en tablas relacionales) es
una decisión deliberada: el volumen de datos por usuario es diminuto (una
bitácora de gym son kilobytes), y así el backend queda inmune a cambios en la
estructura de la rutina.

---

## 3. El Worker (API)

Framework: **ninguno** (Worker nativo) o **Hono** si prefieres un router limpio.
Hono es ligero y hace el código más legible; cualquiera de los dos está bien.

### Endpoints

| Método | Ruta        | Auth | Qué hace |
|--------|-------------|------|----------|
| POST   | `/register` | no   | Crea usuario. Body: `{username, password}`. Devuelve `{token}`. |
| POST   | `/login`    | no   | Valida credenciales. Body: `{username, password}`. Devuelve `{token}`. |
| GET    | `/load`     | sí   | Devuelve `{data}` (el DB del usuario) o `{data:null}` si aún no guardó nada. |
| POST   | `/save`     | sí   | Body: `{data}`. Guarda (upsert) el DB del usuario. Devuelve `{ok:true, updated_at}`. |
| POST   | `/logout`   | sí   | Invalida el token actual (opcional pero recomendado). |

### Autenticación

- El cliente manda el token en el header `Authorization: Bearer <token>`.
- El Worker valida el token contra `auth_tokens`, chequea que no esté expirado,
  y resuelve el `user_id`.
- Si el token es inválido o expiró → responder `401`. El cliente entonces
  muestra la pantalla de login de nuevo.

### Hashing de contraseñas

Usar **Web Crypto (`crypto.subtle`)**, que corre nativo en Workers — no instalar
librerías de hashing externas. Algoritmo: **PBKDF2** con SHA-256, sal aleatoria
por usuario (16 bytes), y un número alto de iteraciones (mínimo 100.000).
Guardar en `pass_hash` como `salt_hex:hash_hex:iteraciones` para poder
re-derivar y comparar en el login.

Generar tokens con `crypto.getRandomValues` (32 bytes → hex).

**Nota de alcance honesta:** esto es seguridad razonable para un proyecto
personal y para compartir con amigos. No es un sistema bancario. No implementes
rate-limiting complejo, 2FA, ni recuperación de contraseña por email en esta
primera versión — se puede añadir después si la app crece.

### CORS

La app se sirve desde GitHub Pages (o Cloudflare Pages), un origen distinto al
del Worker, así que el Worker DEBE responder con headers CORS:

```
Access-Control-Allow-Origin: <origen de la app, o * al inicio>
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

Y manejar las peticiones `OPTIONS` (preflight) devolviendo 204 con esos headers.
Al inicio se puede usar `*`; cuando la URL final de la app esté fija, cambiarlo
al origen exacto por seguridad.

### Validaciones mínimas

- `username`: 3–32 caracteres, alfanumérico + guión bajo. Rechazar duplicados
  (la restricción `UNIQUE` ayuda, pero devolver un error claro tipo
  `{error:"usuario ya existe"}` con status 409).
- `password`: mínimo 8 caracteres.
- `data` en `/save`: que sea JSON válido y no exceda un tamaño razonable
  (p.ej. 1 MB) para evitar abuso.

---

## 4. Cambios en `index.html` (cliente)

El archivo `index.html` ya existe en el repo. Hay que modificarlo, NO reescribirlo
desde cero — conserva toda la lógica de gym, UI y estilos intactos. Los cambios
son quirúrgicos:

### 4.1 Configuración
Añadir cerca del inicio del `<script>` una constante con la URL del Worker:

```js
const API = "https://TU-WORKER.workers.dev";  // se rellena tras desplegar
```

### 4.2 Estado de auth
Guardar el token en `localStorage` (clave aparte, p.ej. `"bitacora_token"`) para
no pedir login en cada apertura.

### 4.3 Pantalla de login/registro
Añadir un overlay simple (mismo lenguaje visual de la app: fondo oscuro
`--ink`, acento naranja `--signal`) que aparece SOLO si no hay token válido.
Con dos campos (usuario, contraseña) y dos botones: "Entrar" y "Crear cuenta".
Al autenticarse con éxito, guardar el token y ocultar el overlay.

### 4.4 Sync — pull al abrir
En el arranque (donde hoy está `load(); restoreDraft(); renderNav(); render();`):
1. Si hay token → `GET /load`.
2. Si devuelve `data` → usar ese `DB` (y también escribirlo a `localStorage`
   como buffer).
3. Si `data` es null (usuario nuevo) o no hay red → usar lo que haya en
   `localStorage` (comportamiento actual).
4. Mostrar toast "Sincronizado" cuando el pull tiene éxito.

### 4.5 Sync — push al guardar
La función `persist()` hoy solo hace `localStorage.setItem`. Modificarla (o
envolver el botón de guardar sesión) para que, además de guardar local, dispare
`POST /save` con el `DB` completo. El push debe:
- Ser "fire and forget" con manejo de error: si falla (sin red), NO romper la
  UI — el dato ya quedó en localStorage. Marcar que hay cambios pendientes.
- Cuando vuelva la conexión (o en el siguiente arranque), reintentar el push
  pendiente.
- Mostrar toast discreto "Guardado en la nube" al confirmarse.

**Importante sobre el push:** empujar el `DB` completo en cada guardado está
perfectamente bien dado el tamaño diminuto de los datos. No hace falta hacer
sync incremental por set. Esto mantiene el cliente simple. Con el volumen de un
usuario real (unas pocas escrituras por día), esto está MUY por debajo de
cualquier límite del free tier de D1 (100.000 escrituras/día).

### 4.6 Estrategia de conflictos
Simple y suficiente para un usuario con pocos dispositivos: **last-write-wins**
por `updated_at`. Al hacer pull, si el `updated_at` del servidor es más reciente
que el último push local conocido, el servidor gana. No implementar merge
complejo. Documentar esta decisión en un comentario en el código.

### 4.7 Lo que NO cambia
- Toda la definición de la rutina (`PROGRAM`, `CYCLE`), la lógica de carga
  efectiva, las gráficas, el draft-autosave que ya persiste la sesión en curso,
  los botones de importar/exportar (se dejan como respaldo manual opcional).
- El import/export sigue existiendo como red de seguridad, pero deja de ser
  necesario para el uso diario.

---

## 5. Estructura del repo objetivo

```
/
├── index.html              # la app (modificar la existente)
├── worker/
│   ├── src/
│   │   └── index.js        # el Worker
│   ├── schema.sql          # las 3 tablas de la sección 2
│   ├── wrangler.toml       # config de Wrangler con el binding de D1
│   └── package.json        # si se usa Hono u otra dependencia
└── BACKEND_SETUP.md        # este archivo
```

`index.html` puede quedar en la raíz para servirse fácil con GitHub Pages. El
Worker vive en `worker/` y se despliega aparte.

---

## 6. Pasos de despliegue (ejecutar con Wrangler)

Estos son los pasos que Claude Code debe ejecutar / guiar. Requieren una cuenta
de Cloudflare (gratis) y `wrangler` instalado (`npm i -g wrangler`).

1. **Login en Cloudflare:**
   ```bash
   wrangler login
   ```

2. **Crear la base de datos D1:**
   ```bash
   wrangler d1 create bitacora-db
   ```
   Esto imprime un `database_id`. Copiarlo al `wrangler.toml`:
   ```toml
   name = "bitacora-api"
   main = "src/index.js"
   compatibility_date = "2026-01-01"

   [[d1_databases]]
   binding = "DB"                    # así se accede en el Worker: env.DB
   database_name = "bitacora-db"
   database_id = "<el-id-que-imprimió>"
   ```

3. **Crear las tablas:**
   ```bash
   wrangler d1 execute bitacora-db --remote --file=./schema.sql
   ```

4. **Desplegar el Worker:**
   ```bash
   wrangler deploy
   ```
   Esto imprime la URL pública del Worker
   (algo como `https://bitacora-api.<subdominio>.workers.dev`).

5. **Poner esa URL en `index.html`** en la constante `API` (sección 4.1).

6. **Subir `index.html` a GitHub** y activar GitHub Pages (Settings → Pages →
   rama main / raíz). O desplegar en Cloudflare Pages si se prefiere todo bajo
   Cloudflare.

7. **Probar el flujo completo:**
   - Abrir la app → aparece login.
   - Crear cuenta → registra y entra.
   - Registrar una sesión de prueba y guardar → toast "Guardado en la nube".
   - Abrir la app en otro dispositivo/navegador, iniciar sesión con el mismo
     usuario → deben aparecer los datos.

8. **(Opcional) Migrar el respaldo existente:** el usuario tiene un JSON de
   respaldo (`bitacora-2026-07-15.json`) con la estructura de `DB`. Para cargar
   esos datos históricos en la cuenta nueva, la vía más simple es: iniciar
   sesión en la app, usar el botón "Importar" existente para meter el JSON al
   `localStorage`, y dejar que el siguiente `push` lo suba a D1. No hace falta
   un script de migración server-side.

---

## 7. Verificación / criterios de aceptación

La implementación está completa cuando:

- [ ] `wrangler deploy` despliega el Worker sin errores.
- [ ] `/register` crea un usuario y `/login` devuelve un token válido.
- [ ] Las contraseñas se guardan hasheadas con PBKDF2 (verificar que
      `pass_hash` en la tabla NO contiene la contraseña en texto plano).
- [ ] `/load` y `/save` requieren token válido y responden 401 sin él.
- [ ] La app muestra login solo cuando no hay token; con token entra directo.
- [ ] Guardar una sesión escribe en D1 (verificable con
      `wrangler d1 execute bitacora-db --remote --command "SELECT updated_at FROM user_data"`).
- [ ] Abrir la app desde otro navegador con el mismo usuario trae los datos.
- [ ] Sin conexión, la app sigue funcionando con localStorage y sincroniza al
      recuperar red.
- [ ] CORS configurado: la app en GitHub Pages puede llamar al Worker sin
      errores de origen cruzado.

---

## 8. Notas finales para quien implemente

- **No sobre-ingenierizar.** Es una app de gym para una persona (y quizá unos
  amigos después). Mantener el Worker en un solo archivo si se puede, código
  legible, sin capas innecesarias.
- **El cliente es la autoridad de la lógica de gym.** El Worker solo hace
  auth + guardar/leer un blob. No meter lógica de rutina en el servidor.
- **Free tier de sobra.** El uso real (un puñado de lecturas/escrituras al día)
  está a órdenes de magnitud de cualquier límite de D1/Workers. No hace falta
  optimizar nada de eso todavía.
- **Preservar la identidad visual** de la app en la pantalla de login: fondo
  oscuro, acento naranja, tipografía del sistema, mismo tono directo en los
  textos ("Entrar", "Crear cuenta", mensajes de error claros y sin disculpas).
