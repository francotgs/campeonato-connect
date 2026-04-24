# Campeonato MundIAl 4Match

Juego de cartas coleccionables de fútbol, formato web app mobile-first, pensado para
correrse **una única vez** durante el evento **Connect de Grupo CEDI**. Adaptación
digital del clásico Top Trumps / Supertrump / 4Match.

> Documentación operativa del proyecto: [`AGENTS.md`](./AGENTS.md).
> Especificación original del cliente: [`specs.md`](./specs.md).

## Estructura del monorepo

```
campeonato-connect/
├── apps/
│   ├── web/      # Next.js 15 (App Router) — UI para jugadores, admin y proyector
│   └── server/   # NestJS + Fastify + Socket.IO — lógica de torneo y partidas
└── packages/
    ├── domain/   # Reglas puras: eventos, FSM, bracket, resolveRound (zod)
    └── cards/    # Catálogo JSON de cartas + loader
```

Reglas de dependencia entre paquetes y motivaciones completas en
[`AGENTS.md`](./AGENTS.md) §11.

## Requisitos

- Node.js **22 LTS**
- pnpm **9+**
- Docker (para correr Redis)

## Primeros pasos

```bash
# 1. Instalar dependencias
pnpm install

# 2. Copiar variables de entorno
cp .env.example apps/server/.env
cp .env.example apps/web/.env.local
# Editá apps/server/.env si querés cambiar JWT_SECRET o ADMIN_TOKEN

# 3. Levantar Redis (única dependencia externa)
docker compose up -d

# 4. Levantar server + web en paralelo
pnpm dev
#   → web    http://localhost:3000
#   → server http://localhost:4000  (healthcheck: GET /health)
#   → admin  http://localhost:3000/admin/dev-admin-token
#   → join   http://localhost:3000/join/t-default
#   → bracket http://localhost:3000/bracket/t-default
```

Desde `/join/t-default` se puede entrar al torneo o iniciar una partida de
prueba contra la CPU. La práctica usa el mismo motor de juego, pero no modifica
el bracket ni requiere acciones del admin.

> **Simular producción localmente** (mismo setup que Railway, con Docker):
> ```bash
> docker compose -f docker-compose.prod-local.yml up --build
> # Resetear todo (incluyendo datos de Redis):
> docker compose -f docker-compose.prod-local.yml down -v
> ```

## Scripts principales

| Script             | Descripción                                                    |
| ------------------ | -------------------------------------------------------------- |
| `pnpm dev`         | Levanta `apps/web` y `apps/server` en paralelo                 |
| `pnpm build`       | Build productivo de apps y paquetes                            |
| `pnpm typecheck`   | Chequeo de tipos recursivo (`tsc --noEmit`)                    |
| `pnpm lint`        | Lint con Biome                                                 |
| `pnpm format`      | Formateo con Biome                                             |
| `pnpm test`        | Tests del dominio (Vitest)                                     |

## Deploy

La app se despliega en **Railway** con 3 servicios (Redis + server + web) y redeploy
automático por cada `git push` a `main`. Guía paso a paso para alguien que nunca
usó Railway: [`docs/DEPLOY_RAILWAY.md`](./docs/DEPLOY_RAILWAY.md).

Archivos clave del deploy:

- `apps/server/Dockerfile` — imagen multi-stage del NestJS
- `apps/web/Dockerfile` — imagen multi-stage del Next.js (output standalone)
- `apps/server/railway.json` / `apps/web/railway.json` — config de builder y healthcheck

## Assets de cartas

Las cartas usan fotos locales en `apps/web/public/cards/players/`, vinculadas por
`art.portraitKey` desde `packages/cards/src/catalog.json`. Los créditos y licencias
de Wikimedia están en `apps/web/public/cards/players/_credits.json`.

Para regenerar retratos y créditos desde Wikimedia:

```bash
node scripts/fetch-card-portraits.mjs
```

Variables públicas del `web`:

- `NEXT_PUBLIC_SOCKET_URL` — URL pública del `server`.
- `NEXT_PUBLIC_TOURNAMENT_ID` — torneo activo que usa `/` y el panel admin.
- `NEXT_PUBLIC_DEFAULT_TID` — fallback compatible con Docker/Railway si no se define `NEXT_PUBLIC_TOURNAMENT_ID`.

El torneo se inicia desde `/admin/<ADMIN_TOKEN>`. Al tocar **Iniciar torneo**, el
backend arma el bracket con humanos registrados y completa automáticamente los
slots faltantes con bots hasta la siguiente potencia de 2.

## Estado

- [x] **Fase 0** — Setup del monorepo (scaffolding, health gateway, landing vacía).
- [x] **Fase 1** — Dominio puro y catálogo.
- [x] **Fase 2** — Loop de partida vía Socket.IO.
- [x] **Fase 3** — Motor de torneo.
- [x] **Fase 4** — UI del jugador.
- [x] **Fase 5** — UI del bracket proyectable.
- [x] **Fase 6** — Panel admin.
- [x] **Fase 7** — Sistema de diseño unificado + deploy a Railway.
