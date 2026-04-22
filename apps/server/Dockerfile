# ============================================================================
# apps/server/Dockerfile — Campeonato MundIAl 4Match (NestJS)
# Multi-stage build for a pnpm monorepo. Run `docker build -f apps/server/Dockerfile .`
# from the repo root so pnpm workspace files are in context.
# ============================================================================

# ---- Stage 1: deps & build -------------------------------------------------
FROM node:22-alpine AS builder

ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

WORKDIR /repo

# Copy workspace manifests first so Docker layer cache is reused when code changes but deps don't.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/domain/package.json packages/domain/
COPY packages/cards/package.json packages/cards/

RUN pnpm install --frozen-lockfile

# Now copy the full sources for packages and server (web is not needed for the server image).
COPY packages packages
COPY apps/server apps/server
COPY tsconfig.base.json ./

# Build workspace deps first, then the server.
RUN pnpm --filter @campeonato/domain build \
    && pnpm --filter @campeonato/cards build \
    && pnpm --filter @campeonato/server build

# Prune dev deps so the runtime image is smaller.
RUN pnpm --filter @campeonato/server --prod deploy /out

# ---- Stage 2: runtime ------------------------------------------------------
FROM node:22-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /out /app

EXPOSE 4000

# Railway / Docker inject env vars at runtime, so no --env-file here.
CMD ["node", "dist/main.js"]
