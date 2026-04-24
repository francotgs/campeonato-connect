# AGENTS.md — Campeonato MundIAl 4Match

> **Documento operativo del proyecto.** Cursor/Claude/Codex deben leerlo al inicio de cada sesión.
> Para la especificación original del cliente ver [`specs.md`](./specs.md). Si hay contradicción entre los dos documentos, **este archivo prevalece** para decisiones técnicas; `specs.md` prevalece para requisitos de producto.

---

## 0. Cómo usar este documento

- **Cuando el usuario abre una sesión nueva con un agente**, este archivo debe cargarse en contexto antes de cualquier tarea.
- **Antes de generar código nuevo**, el agente debe validar que lo que va a escribir es compatible con:
  1. El stack definido en §10
  2. Las convenciones de §18
  3. El contrato de eventos de §13
  4. La FSM de §14
- **Cuando el agente detecte ambigüedad**, debe preguntar antes de asumir, no inventar.
- **Cuando se tome una decisión técnica nueva**, el agente debe proponer actualizar este archivo como parte del cambio.

---

## 1. Visión del producto

**Campeonato MundIAl 4Match** es un juego de cartas coleccionables de fútbol, en formato web app mobile-first, pensado para ser jugado **una única vez** durante el evento **Connect de Grupo CEDI**. Es una adaptación digital del clásico Top Trumps / Supertrump / 4Match:

- Cada jugador recibe un mazo de cartas de futbolistas.
- En cada ronda, un jugador elige un atributo de su carta; el valor más alto gana la carta del rival.
- Las partidas duran 2 minutos. Al finalizar, gana quien tenga más cartas (o todas).
- El torneo es **eliminatorio simple** con bracket potencia de 2 (hasta 256 slots).
- Los asistentes se suman escaneando un QR desde su celular; sin instalar nada, sin registro de cuenta.

**Objetivo del producto**: generar entretenimiento e interacción entre ~200–300 asistentes durante 30 minutos, coronar un único campeón sin intervención técnica, y ser operado por el equipo del evento desde un panel admin.

---

## 2. Contexto de uso y usuarios

| Aspecto | Detalle |
|---|---|
| **Usuarios finales** | Asistentes a evento corporativo tecnológico. Rango etario amplio, no necesariamente gamers. |
| **Dispositivo** | Smartphone propio (iOS Safari, Android Chrome). 100% navegador. |
| **Red** | WiFi del evento + red 4G de los dispositivos como fallback. |
| **Concurrencia** | 50–300 jugadores simultáneos. Objetivo: 1 sola instancia del servidor debe aguantar 300. |
| **Duración total del torneo** | ~30 minutos (8 rondas de 2 min + transiciones). |
| **Organizador** | Equipo del evento, con acceso a panel admin por link privado. |
| **Pantalla pública** | Proyector del salón muestra el bracket en tiempo real (vista `/bracket/[tournamentId]`). |

---

## 3. Criterios de éxito

Copiados literalmente de `specs.md` §11:

1. El torneo se completa de punta a punta sin intervención técnica.
2. La final ocurre entre **exactamente 2 jugadores humanos**, nunca un bot.
3. Al menos el 80% de los jugadores inscriptos llegan a jugar su primer partido.
4. Tiempo promedio de partida ≤ 2 minutos.
5. Cero crashes durante el evento (uptime 99.9% durante los 30 minutos).
6. El campeón es anunciado en pantalla grande con su nombre y estadísticas finales.

**El criterio #2 condiciona el diseño del bot** (ver §16).

---

## 4. Mecánica del juego

### 4.1 La partida

| Parámetro | Valor default (MVP) | Configurable |
|---|---|---|
| Duración | 120 s | En env var `MATCH_DURATION_SECONDS` |
| Cartas iniciales por jugador | 15 | En env var `CARDS_PER_PLAYER` |
| Timeout de inactividad en turno | 10 s (pick automático) | `TURN_PICK_TIMEOUT_SECONDS` |
| Timeout de reconexión | 30 s | `RECONNECT_GRACE_SECONDS` |
| Timeout de partida colgada (ambos inactivos) | 15 s | `MATCH_STALL_TIMEOUT_SECONDS` |
| Rondas de desempate | 3 (best of 3) | Fijo |

### 4.2 Flujo de una ronda

1. El servidor determina **quién elige atributo** (al inicio, aleatorio; luego, el ganador de la ronda anterior).
2. Se emite `round:started` con `chooser`, `myCurrentCard` (solo la carta del tope del mazo propio de cada jugador) y `deadline` (unix ms).
3. El `chooser` envía `match:pick_attribute`. Si no lo hace antes del deadline, el servidor elige el atributo **de menor valor de la carta del chooser** (para no ser injusto con el oponente).
4. El servidor resuelve:
   - Si `myValue > opponentValue` → chooser gana la carta del rival.
   - Si `myValue < opponentValue` → el rival gana la carta del chooser.
   - Si `myValue == opponentValue` → **empate**: cada jugador conserva su carta. El turno de elegir pasa al otro jugador.
5. Se emite `round:result` con el atributo, los dos valores, el ganador y el nuevo tamaño de mazo de cada uno.
6. Las cartas ganadas se agregan **al fondo del mazo** del ganador.

### 4.3 Fin de partida

- **Por eliminación**: un jugador se queda sin cartas → el otro gana.
- **Por tiempo**: al llegar a los 120 s, gana quien tiene más cartas.
- **Empate al tiempo**: si ambos tienen la misma cantidad de cartas, se juegan **3 rondas extra de desempate** al mejor de 3 (no cuenta el tiempo). Si tras las 3 rondas persiste el empate, gana quien haya ganado la última ronda. Si no hubo rondas ganadoras (todas empatadas), gana quien haya sido `chooser` en la primera ronda de la partida (desempate determinístico).
- **Por abandono**: derrota inmediata del que abandonó.
- **Por doble desconexión**: el primero que vuelva gana por W/O.

### 4.4 Atributos

Las cartas tienen exactamente 8 atributos comunes a todos los jugadores (incluidos arqueros, para simplificar MVP):

| Atributo | Rango | Descripción |
|---|---|---|
| `velocidad` | 1–99 | Capacidad de desplazamiento |
| `tiro` | 1–99 | Potencia y precisión de remate |
| `dribbling` | 1–99 | Habilidad con el balón |
| `pase` | 1–99 | Visión y distribución |
| `defensa` | 1–99 | Marca, intercepción |
| `fisico` | 1–99 | Fuerza, salto, resistencia |
| `regate` | 1–99 | Giro, engaño |
| `reflejos` | 1–99 | Solo significativo en arqueros, pero todos los jugadores lo tienen |

**Rating global**: campo `overall` (promedio ponderado de los 8). Informativo, no usado en comparaciones.

**Balance por posición** (para generar el catálogo):

| Posición | Atributos altos | Atributos bajos |
|---|---|---|
| Delantero (DEL) | velocidad, tiro, dribbling | defensa, reflejos |
| Mediocampista (MED) | pase, regate, dribbling | reflejos |
| Defensor (DEF) | defensa, fisico | velocidad, dribbling |
| Arquero (ARQ) | reflejos, fisico | velocidad, dribbling, tiro |

---

## 5. Estructura del torneo

### 5.1 Bracket

- **Siempre potencia de 2**: 2, 4, 8, 16, 32, 64, 128, 256.
- Al iniciar el torneo, el sistema **inscribe a todos los humanos registrados** y rellena los slots vacíos con **bots** hasta la siguiente potencia de 2.
- **Seeding**: aleatorio entre los humanos; los bots se distribuyen de forma que **no haya dos bots enfrentados en ronda 1** (maximiza partidas humano-vs-humano al comienzo).
- Ejemplo: 247 humanos → bracket 256 → 9 bots repartidos.

### 5.2 Progresión de rondas

- Una ronda de torneo no empieza hasta que **todas las partidas de la ronda anterior terminaron**.
- Cuando una partida termina, los dos jugadores quedan en estado "waiting" hasta que:
  - El rival de la próxima ronda también terminó su partida → empieza la nueva partida.
  - Si hubo W/O o el rival es bot, puede empezar antes.

### 5.3 Emparejamiento

- `round 1`: humano-vs-humano cuando sea posible; humano-vs-bot si quedan impares.
- `round 2+`: ganadores de partidas consecutivas en el bracket (pareado 1↔2, 3↔4, etc.).

---

## 6. Cartas: catálogo y distribución

### 6.1 Catálogo (`packages/cards/src/catalog.json`)

- **Catálogo actual**: 50 cartas bien balanceadas.
- **v2**: hasta 90–100 cartas.
- Selecciones actuales: **16 países** de alto reconocimiento/ranking internacional.
- Mix de posiciones: ~30% DEL, ~30% MED, ~25% DEF, ~15% ARQ.
- Ratings de referencia **inspirados** en FIFA/EA FC pero **no copiados**; sin escudos de clubes ni marcas registradas.

### 6.2 Estructura de una carta

```ts
{
  id: "mbappe",
  name: "Kylian Mbappé",
  country: "FR",
  position: "DEL",
  overall: 94,
  attributes: {
    velocidad: 97,
    tiro: 92,
    dribbling: 93,
    pase: 84,
    defensa: 38,
    fisico: 80,
    regate: 92,
    reflejos: 10
  },
  art: {
    // solo referencias a assets locales; no URLs externas en runtime
    portraitKey: "mbappe_portrait",
    gradient: ["#0F4C81", "#F8C100"]
  }
}
```

Las fotos de jugadores viven en `apps/web/public/cards/players/` y se resuelven
desde `art.portraitKey`. Deben ser assets locales optimizados y versionados, no
hotlinks. Los créditos/licencias de las imágenes viven en
`apps/web/public/cards/players/_credits.json`. El script
`scripts/fetch-card-portraits.mjs` permite regenerar los retratos desde
Wikipedia/Wikimedia Commons.

### 6.3 Distribución a partidas

- Al iniciar una partida, el servidor toma **30 cartas** del pool (15 para cada jugador) **sin repetir entre los dos mazos de esa partida**.
- Diferentes partidas del torneo **pueden** tener cartas repetidas entre sí (el pool se reusa).
- Mazos balanceados: cada mazo debe tener overall promedio entre 70 y 85 (para que nadie empiece con solo estrellas ni solo débiles). Implementar con muestreo hasta encontrar una partición válida (máximo 50 intentos; si falla, tolerancia se relaja).
- **Mazos de bots**: se toman del pool filtrado `overall <= 72` (mediocridad garantizada).

---

## 7. Flujos de usuario

### 7.1 Jugador

```
Escanea QR
  → Pantalla lobby: ingresa nombre + empresa
  → Ve las 15 cartas de su mazo (preview, antes del partido)
  → Espera que el admin inicie el torneo
  → Notificación: "Tu partida empieza en 3... 2... 1..."
  → Pantalla de partida: ve su carta, timer, mazo propio vs rival
  → Elige atributo (si le toca) o espera la elección del rival
  → Ve resultado de la ronda (animación verde/rojo/gris)
  → Repite hasta fin de partida
  → Pantalla resultado: "Ganaste / Perdiste"
  → Si ganó: "Esperando próximo rival"
  → Si perdió: ve el bracket completo en modo espectador
```

### 7.2 Admin

```
Ingresa a /admin/[token]
  → Configura torneo (nombre, tiempos, cartas) [en MVP: hardcoded en env]
  → Click "Abrir inscripción"
  → Ve QR grande en pantalla + contador de inscriptos
  → Click "Iniciar torneo" cuando decide
  → Sistema arma bracket automáticamente
  → Ve bracket en tiempo real
  → Puede pausar / reiniciar si es necesario
  → Al final: ve ganador + podio
```

### 7.3 Pantalla proyectable

```
/bracket/[tournamentId]
  → Vista full-screen optimizada para proyector (1920x1080)
  → Cuadro eliminatorio completo con nombres y empresas
  → Partida en curso resaltada
  → Resultados aparecen con animación al finalizar cada partida
  → Al final: podio con campeón, finalista, semifinalistas
```

---

## 8. Pantallas clave

| Ruta | Descripción | Uso |
|---|---|---|
| `/` | Landing + ingreso al torneo activo | Jugador (redirige a `/join/:tid`) |
| `/join/[tournamentId]` | Lobby de inscripción (nombre + empresa) | Jugador |
| `/play` | Vista activa del jugador: preview, partida, espera, resultado | Jugador (ruta única que cambia según estado) |
| `/bracket/[tournamentId]` | Vista proyectable del cuadro eliminatorio | Público/proyector |
| `/admin/[token]` | Panel de control del torneo | Organizador |

**Principio de diseño**: una sola ruta `/play` que renderiza distinto según el estado del jugador (`not_joined`, `in_lobby`, `previewing_deck`, `waiting_match`, `in_match`, `match_ended`, `eliminated`, `champion`). Esto evita redirects innecesarios en mobile.

---

## 9. Edge cases (referencia obligatoria)

Listado completo en `specs.md` §9. Estos son los **prioritarios para MVP**:

| # | Caso | Implementación |
|---|---|---|
| 1 | Desconexión del jugador | Socket.IO ping/pong cada 5s. Si pierde conexión por >30s: derrota automática. |
| 2 | Inactividad en turno | Timer de 10s por pick. Si expira, server elige atributo de menor valor del chooser. |
| 3 | Empate de atributos | Cada jugador conserva su carta. Turno de pick pasa al otro jugador. |
| 4 | Doble input / clicks múltiples | Cada evento del cliente lleva `msgId` (UUID). El server acepta solo el primero por ronda e ignora duplicados. UI se deshabilita tras enviar. |
| 5 | Desincronización de estado | Al reconectar, cliente pide `match:sync` y recibe estado completo. Re-renderiza desde cero. |
| 7 | Abandono voluntario | Botón "Abandonar" → derrota inmediata + W/O al rival. |
| 10 | Timeout global de partida | A los 120s: gana quien tiene más cartas. Si empate: 3 rondas extra. |
| 11 | Inscripción tardía | Endpoint de join rechaza con `TOURNAMENT_STARTED` si estado ≠ `registration_open`. |
| 12 | Múltiples sesiones del mismo usuario | Server identifica por `playerToken`. Si llega nueva conexión con mismo token: cierra la anterior (`takeover`). |

**No prioritarios en MVP** (se pueden agregar en v2 si queda tiempo): #6, #9, #13, #14, #15, #16, #17.

---

## 10. Stack técnico

### 10.1 Runtime y lenguaje

- **Node.js 22 LTS**
- **TypeScript 5.6+** con `strict: true` en todos los tsconfig
- **pnpm 9+** como package manager (workspaces)

### 10.2 Frontend (`apps/web`)

| Dependencia | Uso |
|---|---|
| `next` ^15 | App Router, SSR donde ayude, client components para el juego |
| `react` ^19 | Base |
| `typescript` ^5.6 | — |
| `tailwindcss` ^4 | Styling |
| `shadcn/ui` (last) | Componentes accesibles (Button, Card, Dialog, Toast) |
| `framer-motion` ^11 | Animaciones de cartas y transiciones de ronda |
| `zustand` ^5 | Estado local de UI (no del juego) |
| `socket.io-client` ^4 | Canal realtime |
| `zod` ^3 | Validación en cliente (tipos compartidos) |
| `clsx` + `tailwind-merge` | Utilidades de className |
| `lucide-react` | Iconos |

### 10.3 Backend (`apps/server`)

| Dependencia | Uso |
|---|---|
| `@nestjs/core`, `@nestjs/common` ^10 | Framework base |
| `@nestjs/platform-fastify` ^10 | Adapter Fastify |
| `@nestjs/websockets`, `@nestjs/platform-socket.io` ^10 | Gateway WS |
| `@nestjs/schedule` ^4 | Timers (`@Interval`, `@Timeout`) |
| `socket.io` ^4 | Servidor WS |
| `ioredis` ^5 | Cliente Redis |
| `zod` ^3 | Validación de payloads |
| `pino` ^9 + `nestjs-pino` | Logging estructurado |
| `uuid` ^10 | Generación de IDs |
| `jsonwebtoken` ^9 | Tokens de sesión |

### 10.4 Paquetes compartidos

**`packages/domain`** (reglas puras, sin deps de framework):
- `zod` ^3 — esquemas compartidos
- `vitest` ^2 — tests (dev only)

**`packages/cards`** (catálogo):
- Solo JSON + tipos de `@campeonato/domain`

### 10.5 Datos

- **Redis 7+** (Upstash o add-on de Railway)
- **AOF persistence activada** para sobrevivir reinicios
- **Sin Postgres en MVP**
- **Catálogo de cartas en JSON versionado**, no en DB

### 10.6 Hosting

- **Railway** para todo (web + server + Redis)
- Deploy por `git push` desde GitHub
- Variables de entorno vía Railway UI

### 10.7 Tooling

| Herramienta | Uso |
|---|---|
| `biome` ^1.9 | Linter + formatter (reemplaza ESLint + Prettier) |
| `tsx` ^4 | Ejecutar TS en dev |
| `turbo` ^2 | (opcional) orquestar builds del monorepo |
| `vitest` ^2 | Tests unitarios del dominio (solo `packages/domain`) |

### 10.8 Lo que NO usamos

- ❌ Playwright, Jest (tests E2E / unit tests de UI) — fuera de alcance en MVP
- ❌ Sentry, Datadog, otros APMs — solo `pino` a stdout
- ❌ Prisma, TypeORM, Postgres — no hay RDB
- ❌ Redis adapter de Socket.IO multi-instancia — una sola instancia alcanza
- ❌ tRPC — Socket.IO es el único canal de comunicación en el dominio del juego
- ❌ Storybook — overhead innecesario
- ❌ App nativa, Capacitor, PWA complejo — solo web app

---

## 11. Arquitectura: monorepo

```
campeonato-connect/
├── apps/
│   ├── web/                          # Next.js 15
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── page.tsx          # / landing
│   │   │   │   ├── join/[tid]/       # lobby
│   │   │   │   ├── play/             # vista activa del jugador
│   │   │   │   ├── bracket/[tid]/    # proyectable
│   │   │   │   └── admin/[token]/    # panel admin
│   │   │   ├── components/
│   │   │   │   ├── ui/               # shadcn
│   │   │   │   └── game/             # específicos del juego
│   │   │   ├── hooks/
│   │   │   │   └── useSocket.ts      # hook central
│   │   │   ├── lib/
│   │   │   │   └── socket.ts         # singleton del cliente
│   │   │   └── stores/
│   │   │       └── gameStore.ts      # zustand
│   │   ├── public/                   # arte de cartas
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   │
│   └── server/                       # NestJS
│       ├── src/
│       │   ├── main.ts               # bootstrap Fastify
│       │   ├── app.module.ts
│       │   ├── tournament/
│       │   │   ├── tournament.module.ts
│       │   │   ├── tournament.gateway.ts
│       │   │   ├── tournament.service.ts
│       │   │   └── bracket.service.ts
│       │   ├── match/
│       │   │   ├── match.module.ts
│       │   │   ├── match.gateway.ts
│       │   │   ├── match.service.ts
│       │   │   └── match-engine.ts   # orquesta la FSM
│       │   ├── bot/
│       │   │   └── bot.service.ts
│       │   ├── admin/
│       │   │   ├── admin.module.ts
│       │   │   └── admin.gateway.ts
│       │   ├── session/
│       │   │   ├── session.module.ts
│       │   │   └── session.service.ts # JWT + playerToken
│       │   └── redis/
│       │       └── redis.module.ts
│       └── package.json
│
├── packages/
│   ├── domain/                       # REGLAS PURAS — sin NestJS, sin Next
│   │   ├── src/
│   │   │   ├── events.ts             # esquemas Zod de eventos WS
│   │   │   ├── types.ts              # tipos compartidos
│   │   │   ├── match-rules.ts        # resolveRound, pickBotAttr, etc.
│   │   │   ├── bracket-rules.ts      # generateBracket, advance, etc.
│   │   │   ├── match-fsm.ts          # estados + transiciones
│   │   │   └── index.ts              # barrel
│   │   ├── tests/
│   │   │   ├── match-rules.test.ts
│   │   │   └── bracket-rules.test.ts
│   │   └── package.json
│   │
│   └── cards/
│       ├── src/
│       │   ├── catalog.json
│       │   ├── loader.ts
│       │   └── index.ts
│       └── package.json
│
├── .env.example
├── .gitignore
├── biome.json
├── package.json                      # root, workspaces
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── turbo.json                        # opcional
├── AGENTS.md                         # este archivo
├── specs.md                          # spec original del cliente
└── README.md
```

**Reglas de dependencia entre paquetes:**

- `packages/domain` no importa de ningún otro paquete del monorepo.
- `packages/cards` puede importar de `packages/domain`.
- `apps/server` importa de `domain` y `cards`.
- `apps/web` importa de `domain` (para tipos y Zod) y `cards` (para preview de mazos).
- **Nunca** importar de `apps/server` desde `apps/web` ni viceversa.

---

## 12. Modelo de datos (Redis)

Todas las keys usan el prefijo `t4m:` (4Match). TTL por defecto **4 horas** en casi todas (el evento dura 30 min, TTL largo cubre reintentos y debugging).

### 12.1 Tournament

```
t4m:tournament:{tid}                 HASH
  id              string
  name            string
  status          "registration_open" | "running" | "finished" | "paused"
  cupoMax         number
  matchDuration   number  (seconds)
  cardsPerPlayer  number
  createdAt       number  (unix ms)
  startedAt       number | null
  finishedAt      number | null
  championId      string | null

t4m:tournament:{tid}:players         SET<playerId>
t4m:tournament:{tid}:bracket         STRING (JSON serializado del bracket completo)
t4m:tournament:{tid}:currentRound    NUMBER (0-indexed)
```

### 12.2 Player

```
t4m:player:{pid}                     HASH
  id             string
  name           string
  company        string
  token          string  (JWT ya firmado, redundante para lookup)
  tournamentId   string
  status         "registered" | "in_match" | "waiting_next_match" | "eliminated" | "champion"
  currentMatchId string | null
  joinedAt       number
  isBot          boolean
  socketId       string | null
```

### 12.3 Match

```
t4m:match:{mid}                      HASH (JSON en un solo campo "state" para atomicidad)
  state: {
    id: string,
    tournamentId: string,
    round: number,
    bracketSlot: number,        // índice 0..N-1 del slot en la ronda
    players: [
      { id, deck: CardId[], currentCardIdx: number },
      { id, deck: CardId[], currentCardIdx: number }
    ],
    fsm: MatchFSMState,         // ver §14
    currentChooser: 0 | 1,
    currentAttribute: AttrKey | null,
    roundNumber: number,        // ronda de la partida, 1-indexed
    startedAt: number,
    endsAt: number,             // startedAt + duration
    deadlineAt: number | null,  // deadline del pick actual
    log: RoundLogEntry[]        // para auditoría y edge case #5
  }
```

### 12.4 Session / conexión

```
t4m:session:{socketId}               STRING  playerId
t4m:session:by-token:{token}         STRING  playerId
```

### 12.5 Pub/Sub (MVP: no usado activamente, pero canales reservados)

```
t4m:events:tournament:{tid}          canal
t4m:events:match:{mid}               canal
```

### 12.6 Reglas de atomicidad

- Todas las mutaciones al estado de una partida (`t4m:match:{mid}`) se hacen con **WATCH/MULTI/EXEC** o con un **Lua script**. Nunca read-modify-write naïve.
- Cambios al bracket se hacen con lock (`SET t4m:lock:bracket:{tid} NX EX 5`).

---

## 13. Contrato de eventos Socket.IO

**Todos los eventos** tienen payload validado con Zod. Los esquemas viven en `packages/domain/src/events.ts` y son la **única fuente de verdad** de los shapes.

### 13.1 Namespace

- `/` (default) — todos los eventos viajan por aquí. Rooms:
  - `tournament:{tid}` — join automático al conectar con token válido
  - `match:{mid}` — join cuando empieza la partida
  - `admin:{tid}` — solo el admin autenticado
  - `bracket:{tid}` — vista proyectable (read-only)

### 13.2 Autenticación del handshake

Cliente se conecta con `auth: { token: string | null, mode: "player" | "admin" | "viewer" }`.

- `player`: token JWT válido (lo recibió al hacer `player:join`).
- `admin`: token de admin (pasado por query string de `/admin/[token]`).
- `viewer`: sin auth, solo join al room `bracket:{tid}` (read-only, ve solo broadcasts de bracket).

### 13.3 Eventos Cliente → Servidor

Todos incluyen `msgId: string` (UUID v4) para idempotencia.

| Evento | Payload | Respuesta (ACK) | Notas |
|---|---|---|---|
| `player:join` | `{ tournamentId, name, company, msgId }` | `{ ok: true, token, playerId }` o `{ ok: false, code }` | Crea sesión. Emite `tournament:state` al room. |
| `player:reconnect` | `{ token, msgId }` | `{ ok: true, snapshot }` | Reengancha y envía estado completo. |
| `player:ready` | `{ msgId }` | `{ ok: true }` | Marca al jugador como listo (ya vio el preview). |
| `match:pick_attribute` | `{ matchId, roundNumber, attribute, msgId }` | `{ ok: true }` | Solo el `chooser` puede emitirlo. El resto es ignorado silenciosamente. |
| `match:sync` | `{ matchId, msgId }` | `{ ok: true, state }` | Para recuperación tras reconexión (edge #5). |
| `match:leave` | `{ matchId, msgId }` | `{ ok: true }` | Abandono voluntario (edge #7). |
| `admin:open_registration` | `{ tournamentId, msgId }` | `{ ok: true }` | Requiere auth admin. |
| `admin:start_tournament` | `{ tournamentId, msgId }` | `{ ok: true }` | Dispara generación de bracket y primer round. |
| `admin:reset` | `{ tournamentId, msgId }` | `{ ok: true }` | Borra todo estado del torneo (para pruebas). |
| `admin:pause` / `admin:resume` | `{ tournamentId, msgId }` | `{ ok: true }` | Pausa/reanuda el torneo. |

### 13.4 Eventos Servidor → Cliente

| Evento | Payload | Room destino |
|---|---|---|
| `tournament:state` | `{ tournament, playersCount, yourStatus? }` | `tournament:{tid}` |
| `bracket:updated` | `{ bracket, round }` | `tournament:{tid}`, `bracket:{tid}`, `admin:{tid}` |
| `match:starting` | `{ matchId, opponent, myCards, startingChooser, startsAt }` | socket del jugador |
| `match:started` | `{ matchId, startedAt, endsAt }` | `match:{mid}` |
| `round:started` | `{ roundNumber, chooser, myCurrentCard, opponentCardBack, deadlineAt }` | socket de cada jugador (payloads distintos) |
| `round:attribute_chosen` | `{ roundNumber, attribute, chosenBy }` | `match:{mid}` |
| `round:result` | `{ roundNumber, attribute, yourValue, opponentValue, winner, yourDeckSize, opponentDeckSize, revealedOpponentCard }` | socket de cada jugador |
| `match:tiebreaker_started` | `{ matchId, roundsToPlay: 3 }` | `match:{mid}` |
| `match:ended` | `{ matchId, winnerId, reason, stats }` | `match:{mid}` |
| `player:waiting_next` | `{ nextMatchETA? }` | socket del jugador |
| `player:eliminated` | `{ finalPosition, eliminatedBy }` | socket del jugador |
| `tournament:finished` | `{ championId, podium }` | `tournament:{tid}` |
| `error` | `{ code, message, msgId? }` | socket del emisor |

### 13.5 Códigos de error estándar

```
INVALID_PAYLOAD         — Zod validation failed
UNAUTHORIZED            — no tiene el token adecuado
TOURNAMENT_NOT_FOUND    — tid no existe
TOURNAMENT_STARTED      — intento de join tarde
TOURNAMENT_FULL         — cupo lleno
DUPLICATE_NAME          — nombre ya usado en ese torneo
NOT_YOUR_TURN           — pick cuando no te toca
ALREADY_PICKED          — segundo pick en la misma ronda
MATCH_NOT_ACTIVE        — pick en partida terminada
UNKNOWN_ATTRIBUTE       — atributo fuera del enum
STALE_MSG               — msgId ya procesado
INTERNAL                — cualquier otro
```

---

## 14. Máquina de estados (FSM) de la partida

### 14.1 Estados

```
WAITING_START     → ambos jugadores conectados, server va a disparar start
  ↓
PICKING           → chooser está eligiendo atributo, hay deadline
  ↓
RESOLVING         → server está calculando el resultado (transitorio, <50ms)
  ↓
SHOWING_RESULT    → cliente muestra animación ganó/perdió (2-3s server-driven)
  ↓
  ├─ empate o seguir → vuelve a PICKING
  ├─ alguien sin cartas → ENDED
  ├─ timeout de partida → CHECK_WINNER
  └─ abandono → ENDED

CHECK_WINNER      → compara mazos, decide ENDED o TIEBREAKER
  ↓
TIEBREAKER        → 3 rondas extra (cada una pasa por PICKING → RESOLVING → SHOWING_RESULT)
  ↓
ENDED             → estado terminal, se emite match:ended
```

### 14.2 Transiciones disparadas por eventos

| Desde → A | Disparador |
|---|---|
| `WAITING_START → PICKING` | `match:started` emitido (al pasar `startsAt`) |
| `PICKING → RESOLVING` | `match:pick_attribute` válido o timeout (10s) con auto-pick |
| `RESOLVING → SHOWING_RESULT` | server terminó cómputo |
| `SHOWING_RESULT → PICKING` | handoff de turno, mientras `now < endsAt` y ambos tienen cartas |
| `SHOWING_RESULT → ENDED` | alguien quedó sin cartas |
| `SHOWING_RESULT → CHECK_WINNER` | `now >= endsAt` |
| `CHECK_WINNER → ENDED` | diferencia de cartas ≠ 0 |
| `CHECK_WINNER → TIEBREAKER` | diferencia de cartas == 0 |
| `TIEBREAKER → ENDED` | 3 rondas extra completadas |
| `* → ENDED` | abandono, desconexión >30s, admin-reset |

### 14.3 Invariantes

- El server es **la única autoridad** sobre las transiciones.
- El cliente **nunca** toma decisiones de estado; solo renderiza lo que llega por WS.
- Cada transición persiste a Redis antes de emitir el evento al cliente.
- `msgId` procesados se guardan en `t4m:match:{mid}:processed_msgs` (SET con TTL 10 min) para idempotencia.

---

## 15. Motor de torneo

### 15.1 Generación del bracket

```ts
function generateBracket(humans: PlayerId[]): Bracket {
  const n = nextPowerOfTwo(humans.length);
  const bots = n - humans.length;
  // 1. mezclar humanos aleatoriamente
  // 2. intercalar bots de forma que no haya dos bots enfrentados en ronda 1
  //    estrategia: dividir los N slots en pares (0,1), (2,3), ..., (N-2, N-1)
  //    asignar humanos primero; si un par se queda con 2 slots vacíos, mover un bot
  //    a otro par
  // 3. emitir estructura Bracket
}
```

### 15.2 Estructura del bracket

```ts
type Bracket = {
  size: number;                      // potencia de 2
  rounds: Round[];                   // rounds[0] = primera ronda
};

type Round = {
  index: number;
  matches: BracketMatch[];
};

type BracketMatch = {
  slotA: PlayerId | null;            // null hasta que termine la ronda anterior
  slotB: PlayerId | null;
  matchId: MatchId | null;           // se crea al arrancar
  winnerId: PlayerId | null;
  status: "pending" | "live" | "finished";
};
```

### 15.3 Avance de rondas

- Cuando `match:ended` se procesa:
  1. Actualizar `BracketMatch.winnerId` y `status = "finished"`.
  2. Calcular el `BracketMatch` destino: `rounds[r+1].matches[Math.floor(slot/2)].slot(A|B)`.
  3. Si ambos slots del próximo match están llenos → crear la nueva `MatchId` y emitir `match:starting` a los dos jugadores.
  4. Emitir `bracket:updated` a `tournament:{tid}`, `bracket:{tid}`, `admin:{tid}`.

### 15.4 Casos especiales

- **Un solo jugador en una ronda**: declarar campeón inmediato.
- **Bot vs Bot en ronda 2+** (no debería ocurrir por el seeding, pero por si acaso): el sistema simula una partida instantánea y elige ganador al azar. Log de warning.

---

## 16. Política del bot

### 16.1 Principios

1. **Los bots pierden por defecto**, pero deben parecer jugar "normalmente" para no ser obvios.
2. Nunca se enfrentan dos bots entre sí en ronda 1 (garantía del seeding).
3. **Si un bot llega a octavos de final**, activa modo "piadoso": pierde todas sus rondas de pick.
4. **Un bot nunca puede ganar una semifinal**. Si por alguna razón matemática está por ganar, se rinde automáticamente (`match:leave`).

### 16.2 Algoritmo de pick (cuando le toca al bot elegir)

```ts
function botPickAttribute(botCard: Card, matchState): AttrKey {
  // Modo "piadoso" activo (ronda >= cuartos, o diferencia de cartas contra el humano es >= 3)
  if (isMercifulMode(matchState)) {
    return attributeWithLowestValue(botCard);
  }

  // Modo normal (ronda 1-2): bot juega subóptimo pero no torpe
  // - 70% de las veces: elige el segundo atributo más bajo
  // - 30% de las veces: elige un atributo aleatorio entre los 4 más bajos
  if (Math.random() < 0.7) {
    return sortAttributesAsc(botCard)[1];
  } else {
    const low4 = sortAttributesAsc(botCard).slice(0, 4);
    return sample(low4);
  }
}
```

### 16.3 Cartas mediocres

- Pool filtrado: `cards.filter(c => c.overall <= 72)`.
- Si el pool mediocre tiene menos de `N*15` cartas necesarias, se completa con cartas de overall 73–78 (pero no más altas).

### 16.4 Identificación en UI

- Los bots aparecen en el bracket con nombres neutros tipo `"Bot 01"`, `"Bot 02"`, etc.
- Empresa: `"CPU"`.
- No se marca visualmente como bot en la UI del jugador humano (para no spoilear).

---

## 17. Sesiones y autenticación

### 17.1 Flujo

1. Jugador hace `player:join` con nombre y empresa.
2. Server crea `playerId` (UUID), guarda en Redis, firma un JWT con payload `{ playerId, tournamentId, iat }` y `exp: 6h`.
3. JWT se devuelve en el ACK y el cliente lo guarda en:
   - **Cookie httpOnly** (para persistir ante cierre de tab)
   - **localStorage** (para leerlo desde JS al reconectar)
4. En el handshake de reconexión, el cliente envía `auth.token`; server valida y re-asocia `socketId` al `playerId`.

### 17.2 Sesión única por token

- Si llega una nueva conexión con un token que ya tiene `socketId` activo:
  - Desconectar el socket anterior con razón `session_takeover`.
  - Actualizar `t4m:player:{pid}.socketId` al nuevo.
  - Emitir `match:sync` al nuevo para que renderice estado actual.

### 17.3 Admin

- Token de admin generado al momento de crear el torneo (variable `ADMIN_TOKEN` en env, o random UUID generado al bootstrap).
- URL privada: `/admin/{ADMIN_TOKEN}`. No hay endpoint público para obtenerlo.

### 17.4 Viewer (pantalla proyectable)

- No requiere token.
- `/bracket/[tournamentId]` abre un WS en modo `viewer` y se subscribe al room `bracket:{tid}`.
- Read-only: cualquier evento cliente→server desde un viewer se rechaza con `UNAUTHORIZED`.

---

## 18. Convenciones de código

### 18.1 TypeScript

- `strict: true`, `noUncheckedIndexedAccess: true` en todos los `tsconfig.json`.
- **Prohibido** `any` excepto en tests (donde se permite con comentario explicativo).
- **Preferir** tipos derivados de Zod: `type Foo = z.infer<typeof fooSchema>`.
- Exports: **named exports**, no `default export` (salvo páginas Next.js donde es obligatorio).
- Enums: **no usar `enum` de TS**; usar `as const` + `type X = typeof X[keyof typeof X]`.

### 18.2 Naming

| Elemento | Convención |
|---|---|
| Archivos | `kebab-case.ts` (`match-engine.ts`) |
| Componentes React | `PascalCase.tsx` (`PlayerCard.tsx`) |
| Tipos e interfaces | `PascalCase` |
| Variables y funciones | `camelCase` |
| Constantes globales | `SCREAMING_SNAKE_CASE` |
| Esquemas Zod | `camelCaseSchema` (sufijo `Schema`) |
| Eventos WS | `domain:action` (`match:pick_attribute`, `round:started`) |
| Redis keys | `t4m:entity:id` con `:` como separador |

### 18.3 Estructura de archivos

- **Un archivo = una responsabilidad clara**. Si un archivo pasa de 300 líneas, partir.
- **Barrel `index.ts`** solo en `packages/*`, no en `apps/*` (genera problemas con Next).
- **Tests** viven en `tests/` dentro del paquete, no mezclados con código.

### 18.4 Comentarios

- **No narrativos**: nada de `// loop over players`.
- **Solo para explicar por qué** algo no obvio, o citar un edge case del spec: `// edge case #4 (doble input)`.

### 18.5 Logging

- Usar `pino` a través de `nestjs-pino`. Nunca `console.log` en `apps/server`.
- En `apps/web` sí se permite `console.log` durante dev; remover antes de deploy.
- Niveles: `error` para fallos recuperables, `warn` para condiciones raras (ej: bot vs bot), `info` para transiciones importantes del torneo, `debug` para detalles de partidas.

### 18.6 Errores

- En el backend: custom `GameError` extends Error con campo `code: ErrorCode`.
- Nunca `throw "string"`.
- En gateways: interceptor global captura `GameError` y emite `error` event al cliente con el code.

### 18.7 Validación de entrada

- **Todo** payload que llega del cliente pasa por Zod antes de tocar lógica.
- Si falla: emitir `error` con code `INVALID_PAYLOAD` y **no** procesar.

### 18.8 Git

- Branch principal: `main`.
- Commits en formato Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`).
- Un commit = un cambio coherente. No commits "WIP" en main.
- **No** generar commits automáticamente desde el agente salvo pedido explícito.

### 18.9 Lo que NO hacer

- ❌ No agregar dependencias nuevas sin discutirlo con el desarrollador.
- ❌ No introducir paquetes del monorepo nuevos sin actualizar este archivo.
- ❌ No mover archivos grandes sin razón.
- ❌ No usar `eval`, `Function`, serialización de código dinámico.
- ❌ No exponer secretos en el frontend (todo token debe ser validado en server).
- ❌ No hacer `any` casts para "que compile".
- ❌ No implementar features fuera del scope del MVP sin preguntar.

---

## 19. Despliegue

### 19.1 Entornos

| Entorno | Dominio | Notas |
|---|---|---|
| Local | `http://localhost:3000` (web), `http://localhost:4000` (server) | `pnpm dev` levanta ambos |
| Producción | Railway (dominios generados) | deploy por push a `main` |

### 19.2 Variables de entorno

**`apps/server/.env`**:
```
NODE_ENV=production
PORT=4000
REDIS_URL=redis://...
JWT_SECRET=<random 256-bit>
ADMIN_TOKEN=<random UUID>
MATCH_DURATION_SECONDS=120
CARDS_PER_PLAYER=15
TURN_PICK_TIMEOUT_SECONDS=10
RECONNECT_GRACE_SECONDS=30
MATCH_STALL_TIMEOUT_SECONDS=15
CORS_ORIGIN=https://<web-domain>
```

**`apps/web/.env`**:
```
NEXT_PUBLIC_SOCKET_URL=https://<server-domain>
NEXT_PUBLIC_TOURNAMENT_ID=<tid fijo del evento, o se toma del path>
```

### 19.3 Comandos clave

```bash
# Instalación
pnpm install

# Dev (ambos apps en paralelo)
pnpm dev

# Build
pnpm build

# Tests del dominio
pnpm --filter @campeonato/domain test

# Lint + format
pnpm lint
pnpm format

# Deploy (Railway CLI)
railway up
```

### 19.4 Checklist pre-evento (última hora)

- [ ] `ADMIN_TOKEN` rotado y guardado en lugar seguro.
- [ ] Probado con **3 dispositivos reales** (1 iOS Safari, 1 Android Chrome, 1 desktop).
- [ ] Probado el corte de red en medio de una partida (edge case #1, #16).
- [ ] Probado el doble click en el mismo atributo (edge case #4).
- [ ] Probado el empate al finalizar el tiempo (edge case #10).
- [ ] Pantalla proyectable probada en 1920x1080.
- [ ] QR impreso grande con URL correcta.
- [ ] Redis con AOF confirmado activo.
- [ ] Backup del catálogo de cartas por si hay que resetear.

---

## 20. Roadmap de desarrollo (fases)

Cada fase debe cerrarse antes de empezar la siguiente. Cada una es un commit o set de commits coherente.

### Fase 0 — Setup del monorepo (2–3 hs)

- [ ] Inicializar pnpm workspaces, tsconfig base, biome.
- [ ] Crear estructura de carpetas de §11.
- [ ] `packages/domain` vacío con Zod y Vitest configurado.
- [ ] `apps/web` con Next.js 15 App Router, Tailwind v4, shadcn/ui inicial.
- [ ] `apps/server` con NestJS + Fastify adapter, un gateway "health" que responde ping.
- [ ] Ambos apps levantan con `pnpm dev`.
- [ ] `.env.example` completo.

### Fase 1 — Dominio puro y catálogo (3–4 hs)

- [ ] `packages/domain/events.ts`: todos los esquemas Zod de §13.
- [ ] `packages/domain/types.ts`: tipos derivados.
- [ ] `packages/domain/match-rules.ts`: `resolveRound`, `drawCard`, `winnerByCount`.
- [ ] `packages/domain/bracket-rules.ts`: `generateBracket`, `advanceBracket`.
- [ ] `packages/domain/match-fsm.ts`: transiciones puras.
- [ ] `packages/cards/catalog.json`: 50 cartas balanceadas.
- [ ] 3–5 tests Vitest cubriendo: ronda normal, empate, bracket 247 humanos, bot pick, avance de bracket.

### Fase 2 — Loop de partida vía Socket.IO (4–5 hs)

- [ ] `session.service.ts`: emisión y validación de JWT.
- [ ] `tournament.gateway.ts` + `tournament.service.ts`: `player:join`, emisión de `tournament:state`.
- [ ] `match.gateway.ts` + `match-engine.ts`: loop completo de una partida 1v1.
- [ ] Persistencia de estado en Redis con transacciones (MULTI/EXEC).
- [ ] Timers con `@nestjs/schedule` o `setTimeout` manejado por el motor.
- [ ] `bot.service.ts`: picks automáticos con la política de §16.

### Fase 3 — Motor de torneo (3 hs)

- [ ] `bracket.service.ts`: generación y avance.
- [ ] Emisión de `match:starting` al ganar una ronda.
- [ ] `admin.gateway.ts`: start/reset/pause.
- [ ] Caso especial: un solo humano → campeón automático.

### Fase 4 — UI del jugador (5–6 hs)

- [ ] `lib/socket.ts`: cliente Socket.IO singleton con reconexión.
- [ ] `hooks/useSocket.ts`: hook con tipos derivados de Zod.
- [ ] `/join/[tid]`: lobby con formulario.
- [ ] `/play`: vista-según-estado (preview, match, waiting, result, eliminated).
- [ ] Componente `PlayerCard` con los 8 atributos tappables.
- [ ] Componente `RoundResult` con animación Framer Motion.
- [ ] Timer visible con cuenta regresiva.
- [ ] Responsive mobile-first (probar en DevTools mobile de inmediato).

### Fase 5 — UI del bracket proyectable (2–3 hs)

- [ ] `/bracket/[tid]`: vista fullscreen.
- [ ] Estilo estadio / tabla de campeonato.
- [ ] Refresh en tiempo real vía `bracket:updated`.
- [ ] Podio final.

### Fase 6 — Panel admin (2 hs)

- [ ] `/admin/[token]`: verificación de token.
- [ ] Botones: abrir inscripción, iniciar, pausar, reiniciar.
- [ ] Métricas simples: inscriptos, partidas activas, ronda actual.
- [ ] QR generado on-the-fly con la URL del torneo.

### Fase 7 — Pulido y deploy (3–4 hs)

- [ ] Revisar animaciones, transiciones, loaders.
- [ ] Testeo manual exhaustivo con 2–3 dispositivos reales.
- [ ] Deploy a Railway (web + server + Redis).
- [ ] Checklist pre-evento (§19.4).

**Total estimado: 25–35 hs de codeo con Cursor/Opus.**

---

## 21. Definition of Done (MVP)

Para declarar el MVP "listo para el evento":

### Funcional

- [ ] 200–300 jugadores pueden inscribirse en paralelo sin errores.
- [ ] El bracket se genera correctamente para cualquier N ≤ 256 humanos.
- [ ] Una partida completa (15 cartas, 2 min) corre de principio a fin sin bugs.
- [ ] Los bots tienen cartas mediocres y pierden >95% de las veces.
- [ ] Un bot jamás llega a la final.
- [ ] Reconexión funciona: cortar WiFi 20s y volver no rompe la partida.
- [ ] El panel admin puede iniciar, pausar y reiniciar el torneo.
- [ ] La pantalla proyectable se actualiza en tiempo real.
- [ ] El campeón se anuncia con nombre y empresa al final.

### Técnico

- [ ] 0 errores de TypeScript (`pnpm tsc --noEmit` pasa en todos los paquetes).
- [ ] 0 warnings de biome.
- [ ] Los tests del dominio pasan.
- [ ] `pnpm build` de ambos apps exitoso.
- [ ] Deploy a Railway exitoso y URL pública accesible.

### Experiencia

- [ ] Se ve bien en iPhone SE, iPhone 15, Pixel 7.
- [ ] Ningún texto se corta; ningún botón queda inalcanzable.
- [ ] La carta del jugador es visualmente atractiva (estilo FIFA card).
- [ ] El feedback de "ganaste / perdiste" es claro e inmediato.
- [ ] El tiempo se percibe claramente en el timer.

---

## 22. Fuera de alcance (v1.0 MVP)

Explícitamente **no** se implementa en esta versión. Cualquier request de algo de esta lista debe postergarse a v2.

- Registro de usuarios persistente entre eventos.
- Historial de partidas.
- Modos de juego alternativos (equipos, liga, deathmatch).
- Personalización de mazos por el jugador.
- Monetización o cartas de pago.
- Licencias oficiales (FIFA, clubes, fotos reales de jugadores).
- App nativa iOS / Android, Capacitor.
- PWA con service worker / offline.
- Multi-idioma (solo español).
- Sonidos, música, efectos de audio.
- Tests E2E (Playwright), tests de integración.
- Observabilidad (Sentry, Datadog).
- Panel admin con edición de cartas o parámetros en caliente.
- Reflejos como atributo exclusivo de arqueros.
- Spectator mode en vivo de una partida individual.
- Internacionalización de nombres / países.
- Chat entre jugadores.
- Sistema de rankings / ELO.

---

## 23. Cheatsheet

### Comandos frecuentes

```bash
# Instalar todo
pnpm install

# Dev paralelo
pnpm dev

# Solo web
pnpm --filter @campeonato/web dev

# Solo server
pnpm --filter @campeonato/server dev

# Correr tests del dominio
pnpm --filter @campeonato/domain test

# Lint + format con biome
pnpm lint
pnpm format

# Chequeo de tipos en todo el monorepo
pnpm -r tsc --noEmit

# Agregar shadcn component al web
pnpm --filter @campeonato/web dlx shadcn@latest add button

# Redis local (Docker)
docker run -d --name redis-local -p 6379:6379 redis:7 redis-server --appendonly yes
```

### Archivos clave para revisar ante dudas

| Duda | Archivo |
|---|---|
| ¿Qué shape tiene un evento X? | `packages/domain/src/events.ts` |
| ¿Cómo se resuelve una ronda? | `packages/domain/src/match-rules.ts` |
| ¿Cómo se arma un bracket? | `packages/domain/src/bracket-rules.ts` |
| ¿En qué estado puede estar una partida? | `packages/domain/src/match-fsm.ts` |
| ¿Qué atributos tiene una carta? | `packages/domain/src/types.ts` + `packages/cards/src/catalog.json` |
| ¿Cómo actúa el bot? | `apps/server/src/bot/bot.service.ts` |
| ¿Cómo se persiste el estado? | `apps/server/src/redis/` + buscar `t4m:` |

### Variables de entorno mínimas para dev

```bash
# apps/server/.env
PORT=4000
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret-cambiar-en-prod-minimo-32-chars
ADMIN_TOKEN=dev-admin-token
CORS_ORIGIN=http://localhost:3000
```

```bash
# apps/web/.env.local
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

---

**Última actualización:** 2026-04-22
**Versión de este documento:** 1.0 (MVP pre-evento)
