# Deploy a Railway — Guía paso a paso

> Esta guía asume que **nunca usaste Railway** y querés llegar al evento con la app funcionando en un dominio público. Seguila de arriba hacia abajo sin saltear pasos.

## Arquitectura del deploy

Vamos a desplegar **3 servicios** dentro del mismo proyecto de Railway:

| Servicio | Qué es | Imagen | Puerto |
| -------- | ------ | ------ | ------ |
| `redis` | Base de datos en memoria (estado del torneo) | Plugin oficial de Railway | 6379 |
| `server` | API NestJS + Socket.IO (game loop) | `apps/server/Dockerfile` | 4000 |
| `web` | UI Next.js (jugadores, bracket, admin) | `apps/web/Dockerfile` | 3000 |

Railway conecta cada servicio al repo de GitHub y **redeploya automáticamente en cada `git push` a `main`**.

---

## Paso 1. Preparar el repo en GitHub

Si todavía no subiste el código:

```powershell
# desde c:\Users\FrancoTomasGarcia\Documents\Proyectos\campeonato-connect
git status
git add .
git commit -m "feat(fase-7): sistema de diseño unificado + Dockerfiles para Railway"
```

Luego creá el repo en GitHub (`campeonato-connect` por ejemplo) y subilo:

```powershell
git remote add origin https://github.com/<tu-usuario>/campeonato-connect.git
git branch -M main
git push -u origin main
```

> **Importante**: `apps/server/.env` y `apps/web/.env.local` están en `.gitignore`. **No subas secretos al repo.** En Railway configuraremos las variables a mano.

---

## Paso 2. Crear la cuenta de Railway

1. Entrá a https://railway.app
2. Click **Login** → **Login with GitHub**
3. Autorizá a Railway a leer tus repos. Podés darle acceso sólo a `campeonato-connect` si preferís.
4. Confirmá tu email si te lo pide.
5. Railway arranca con un plan **Hobby / trial** con crédito gratis suficiente para probar y hacer el evento.

> Para un evento "en serio" (varias horas, muchos conectados) conviene pasar al plan **Hobby** ($5/mes) o **Pro**. Con el trial alcanza para ensayar.

---

## Paso 3. Crear el proyecto y agregar Redis

1. En el dashboard de Railway click **New Project** → **Empty Project**.
2. Ponele un nombre, por ejemplo `campeonato-mundial-4match`.
3. Dentro del proyecto click **+ Create** → **Database** → **Add Redis**.
4. Railway lanza un servicio `Redis` listo en segundos. Click sobre el servicio → pestaña **Variables** y copiá el valor de `REDIS_URL` (algo como `redis://default:xxx@redis.railway.internal:6379`). Lo vas a pegar en el server.

> La variable `redis.railway.internal` funciona **dentro de Railway** y no expone Redis a internet, que es lo que queremos.

---

## Paso 4. Crear el servicio `server` (NestJS)

1. En el mismo proyecto click **+ Create** → **GitHub Repo** → elegí `campeonato-connect`.
2. En la pantalla que aparece:
   - **Service name**: `server`
   - **Branch**: `main`
   - Railway detecta automáticamente el monorepo.
3. Entrá al servicio → pestaña **Settings**:
   - **Root Directory**: dejá vacío (Railway corre desde la raíz del repo).
   - **Build → Builder**: seleccioná **Dockerfile**.
   - **Build → Dockerfile Path**: `apps/server/Dockerfile`.
   - **Deploy → Start Command**: dejá vacío (lo toma del Dockerfile o de `railway.json`).
   - **Networking → Public Networking**: click **Generate Domain**. Railway te da algo como `server-production-xxxx.up.railway.app`. Guardá esa URL.
4. Pestaña **Variables** → **Raw Editor**, pegá lo siguiente y ajustá:

   ```ini
   NODE_ENV=production
   PORT=4000
   REDIS_URL=${{Redis.REDIS_URL}}
   JWT_SECRET=<pegar-un-secret-largo-aleatorio>
   ADMIN_TOKEN=<pegar-un-admin-token-aleatorio-y-recordarlo>
   CORS_ORIGIN=https://<dominio-del-web-cuando-lo-tengas>.up.railway.app
   MATCH_DURATION_SECONDS=120
   CARDS_PER_PLAYER=15
   TURN_PICK_TIMEOUT_SECONDS=10
   RECONNECT_GRACE_SECONDS=30
   MATCH_STALL_TIMEOUT_SECONDS=15
   BOOTSTRAP_TOURNAMENT_ID=t-default
   BOOTSTRAP_TOURNAMENT_NAME=Campeonato MundIAl 4Match
   BOOTSTRAP_CUPO_MAX=256
   LOG_LEVEL=info
   ```

   - `${{Redis.REDIS_URL}}` es una referencia automática al servicio Redis — Railway la reemplaza en runtime.
   - Para `JWT_SECRET` y `ADMIN_TOKEN` generá valores aleatorios (PowerShell):

     ```powershell
     [Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
     ```

   - `CORS_ORIGIN` lo completamos después de crear el `web`.

5. Click **Deploy** (o esperá al auto-deploy). El primer build puede tardar 2-4 min. Mirá los logs en la pestaña **Deployments**.
6. Cuando termine, probá el healthcheck desde el navegador:
   `https://server-production-xxxx.up.railway.app/health`
   Debería devolver `{ "ok": true, ... }`.

---

## Paso 5. Crear el servicio `web` (Next.js)

1. En el proyecto click **+ Create** → **GitHub Repo** → mismo repo.
2. **Service name**: `web`, **Branch**: `main`.
3. Pestaña **Settings**:
   - **Build → Builder**: **Dockerfile**.
   - **Build → Dockerfile Path**: `apps/web/Dockerfile`.
   - **Build → Build Arguments** (importante: estas vars se "queman" en el bundle de Next porque son `NEXT_PUBLIC_*`):

     | Nombre | Valor |
     | --- | --- |
     | `NEXT_PUBLIC_SOCKET_URL` | `https://<dominio-del-server>.up.railway.app` |
     | `NEXT_PUBLIC_TOURNAMENT_ID` | `t-default` |
     | `NEXT_PUBLIC_DEFAULT_TID` | `t-default` |

   - **Networking → Public Networking**: **Generate Domain**. Anotá el dominio, p. ej. `web-production-yyyy.up.railway.app`.
4. Pestaña **Variables** — aunque los `NEXT_PUBLIC_*` ya están como build args, Next también las quiere en runtime. Agregalas iguales:

   ```ini
   NODE_ENV=production
   PORT=3000
   NEXT_PUBLIC_SOCKET_URL=https://<dominio-del-server>.up.railway.app
   NEXT_PUBLIC_TOURNAMENT_ID=t-default
   NEXT_PUBLIC_DEFAULT_TID=t-default
   ```

5. **Volvé al servicio `server`** y completá `CORS_ORIGIN` con la URL del `web`:

   ```
   CORS_ORIGIN=https://web-production-yyyy.up.railway.app
   ```

   Redeploy del `server` (botón "Redeploy" en la pestaña Deployments) para que tome el cambio.

6. Deploy del `web`. Al terminar, abrí:
   - `https://web-production-yyyy.up.railway.app/join/t-default` → pantalla de inscripción.
   - `https://web-production-yyyy.up.railway.app/bracket/t-default` → bracket público.
   - `https://web-production-yyyy.up.railway.app/admin/<ADMIN_TOKEN>` → panel admin.

---

## Paso 6. Probar end-to-end en producción

1. Abrí la URL `/admin/<ADMIN_TOKEN>` → tocá **Abrir inscripción**.
2. Desde otro dispositivo (o pestaña incógnito) abrí `/join/t-default` y registrá un jugador.
3. Repetí para sumar más jugadores. Si querés completar cupo rápido, desde admin tocá **Sumar bots hasta 8**.
4. En admin tocá **Iniciar torneo**. La UI de los jugadores debería pasar a la pantalla de deck y arrancar las partidas.
5. Abrí `/bracket/t-default` en una pantalla grande (proyector) → verás el árbol actualizándose en vivo.

---

## Paso 7. (Opcional) Dominio propio

1. Si tenés un dominio (ej. `campeonato.tu-marca.com`):
2. En `web` → **Settings → Networking → Custom Domain** → agregá `campeonato.tu-marca.com`.
3. Railway te dice qué registro `CNAME` crear en tu DNS.
4. Actualizá `CORS_ORIGIN` en el `server` para que apunte al nuevo dominio.

---

## Paso 8. Deploy automático con `git push`

Ya está configurado. Cada `git push origin main` dispara un redeploy automático de los servicios `server` y `web`. Tips:

- Si sólo tocaste `apps/web`, Railway redeploya ambos — no es un problema.
- Mirá los logs en tiempo real desde la pestaña **Deployments** de cada servicio.
- Para un rollback rápido: **Deployments → Redeploy** sobre el build anterior que funcionaba.

---

## Troubleshooting

### "No pude conectar con el servidor" al entrar a `/join/t-default`
- Revisá que `NEXT_PUBLIC_SOCKET_URL` en el `web` apunta al dominio del `server` con `https://`.
- Revisá en el `server` que `CORS_ORIGIN` es exactamente el dominio del `web` (sin barra al final).
- Abrí la consola del navegador (F12): si ves error de CORS, re-deployá el `server`.

### El healthcheck del `server` falla
- Verificá que `REDIS_URL` está definido con `${{Redis.REDIS_URL}}`.
- En logs del `server` buscá "Redis connection". Si falla, destruí y recreá el plugin de Redis.

### El build del `web` tarda muchísimo
- Normal la primera vez (pnpm instala todo). Las siguientes compilaciones usan cache de Docker.

### Los jugadores se desconectan
- Chequeá que no tengás `sleep`/timeouts de Railway demasiado bajos (Hobby está bien).
- Mirá logs del `server`: si ves reconexiones continuas, podría ser que el plan actual quedó corto en RAM. Escalá a Pro si pasa en el evento.

### Quiero resetear el torneo
- Desde el panel admin → **Reset torneo** (pide confirmación doble).
- O desde terminal: `pnpm --filter @campeonato/server admin:reset` si tenés el server local apuntando al Redis de Railway.

---

## Checklist pre-evento

Hacé este checklist **el día antes** del evento:

- [ ] Último `git push` con la versión que querés correr ya desplegado y probado.
- [ ] Variables de entorno del `server` y `web` revisadas y con `CORS_ORIGIN` y `NEXT_PUBLIC_SOCKET_URL` apuntándose correctamente.
- [ ] `ADMIN_TOKEN` guardado en un lugar seguro (gestor de passwords). **Nadie más debe conocerlo.**
- [ ] Abrir `/admin/<ADMIN_TOKEN>` y probar: abrir inscripción, sumar 8 bots, iniciar torneo, verlo llegar al campeón en el bracket, resetear.
- [ ] Generar el QR de inscripción desde admin y tenerlo impreso / en una slide para mostrar al evento.
- [ ] Tener el bracket en `/bracket/t-default` abierto en un monitor grande / proyector.
- [ ] Plan B: screenshot del bracket en caso de caída (muy improbable).
- [ ] Confirmar que el plan de Railway tiene crédito suficiente para la duración del evento.
- [ ] Borrar jugadores de prueba: desde admin **Reset torneo** una vez para empezar limpio.
- [ ] Avisar a jugadores de no refrescar la página durante una partida (el backend igual soporta reconexión en 30s por defecto).

---

## Referencias rápidas

- Dashboard Railway: https://railway.app/dashboard
- Docs Railway: https://docs.railway.com
- Logs de un servicio: click en el servicio → **Deployments** → **View Logs**.
- Variables referenciadas entre servicios: `${{NombreServicio.NOMBRE_VAR}}`.
