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
- Redis 7+ (para fases ≥ 2 — dev: `docker run -d --name redis-local -p 6379:6379 redis:7 redis-server --appendonly yes`)

## Primeros pasos

```bash
# 1. Instalar
pnpm install

# 2. Copiar variables de entorno (ver .env.example)
cp .env.example apps/server/.env
cp .env.example apps/web/.env.local

# 3. Levantar ambos apps en paralelo
pnpm dev
#   → web    http://localhost:3000
#   → server http://localhost:4000  (healthcheck: GET /health)
```

## Scripts principales

| Script             | Descripción                                                    |
| ------------------ | -------------------------------------------------------------- |
| `pnpm dev`         | Levanta `apps/web` y `apps/server` en paralelo                 |
| `pnpm build`       | Build productivo de apps y paquetes                            |
| `pnpm typecheck`   | Chequeo de tipos recursivo (`tsc --noEmit`)                    |
| `pnpm lint`        | Lint con Biome                                                 |
| `pnpm format`      | Formateo con Biome                                             |
| `pnpm test`        | Tests del dominio (Vitest)                                     |

## Estado

- [x] **Fase 0** — Setup del monorepo (scaffolding, health gateway, landing vacía).
- [ ] Fase 1 — Dominio puro y catálogo.
- [ ] Fase 2 — Loop de partida vía Socket.IO.
- [ ] Fase 3 — Motor de torneo.
- [ ] Fase 4 — UI del jugador.
- [ ] Fase 5 — UI del bracket proyectable.
- [ ] Fase 6 — Panel admin.
- [ ] Fase 7 — Pulido y deploy.
