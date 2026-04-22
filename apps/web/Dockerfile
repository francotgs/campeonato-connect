# ============================================================================
# apps/web/Dockerfile — Campeonato MundIAl 4Match (Next.js 15)
# Multi-stage build for a pnpm monorepo. Run `docker build -f apps/web/Dockerfile .`
# from the repo root so pnpm workspace files are in context.
# ============================================================================

# ---- Stage 1: deps ---------------------------------------------------------
FROM node:22-alpine AS deps

ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

WORKDIR /repo

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/domain/package.json packages/domain/
COPY packages/cards/package.json packages/cards/

RUN pnpm install --frozen-lockfile

# ---- Stage 2: builder ------------------------------------------------------
FROM node:22-alpine AS builder

ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

WORKDIR /repo

# Reuse node_modules from deps stage.
COPY --from=deps /repo/node_modules node_modules
COPY --from=deps /repo/packages/domain/node_modules packages/domain/node_modules
COPY --from=deps /repo/packages/cards/node_modules packages/cards/node_modules
COPY --from=deps /repo/apps/web/node_modules apps/web/node_modules
COPY --from=deps /repo/pnpm-workspace.yaml pnpm-workspace.yaml
COPY --from=deps /repo/package.json package.json

COPY packages packages
COPY apps/web apps/web
COPY tsconfig.base.json ./

# NEXT_PUBLIC_* envs must be set at build time because Next inlines them.
ARG NEXT_PUBLIC_SOCKET_URL
ARG NEXT_PUBLIC_TOURNAMENT_ID
ARG NEXT_PUBLIC_DEFAULT_TID
ENV NEXT_PUBLIC_SOCKET_URL=${NEXT_PUBLIC_SOCKET_URL}
ENV NEXT_PUBLIC_TOURNAMENT_ID=${NEXT_PUBLIC_TOURNAMENT_ID}
ENV NEXT_PUBLIC_DEFAULT_TID=${NEXT_PUBLIC_DEFAULT_TID}

RUN pnpm --filter @campeonato/domain build \
    && pnpm --filter @campeonato/cards build \
    && pnpm --filter @campeonato/web build

# ---- Stage 3: runtime ------------------------------------------------------
FROM node:22-alpine AS runner

ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

# Next.js standalone output bundles only what's needed to run.
# The `outputFileTracingRoot` points at the monorepo root, so the standalone dir
# lives inside apps/web/.next/standalone with full paths preserved.
COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /repo/apps/web/public ./apps/web/public

EXPOSE 3000

# The server.js entrypoint inside the standalone bundle expects `PORT` from env.
CMD ["node", "apps/web/server.js"]
