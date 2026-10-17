# syntax=docker/dockerfile:1
# Image unique, deux commandes (design, décision 7) :
#   web    : node server.js (par défaut, applique les migrations au démarrage)
#   worker : node worker.js
# Image publique : aucun secret au build, tout passe par l'environnement au démarrage.

# Dernière LTS de Node (cf. .nvmrc), Debian trixie slim, pinnée par tag exact et digest.
ARG NODE_IMAGE=node:24.22.0-trixie-slim@sha256:7f486cabe892bff8fef04c0f7da8dba84a560be3e4e2740b7a86afc57ebec315

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

# 1. Dépendances, depuis le lockfile uniquement.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# 2. Build : Next.js en standalone, plus le bundle worker.js (esbuild) dans .next/standalone.
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build
# Next ne relie better-sqlite3 que sous .next/node_modules : worker.js le cherche dans
# node_modules/. On recrée le lien pnpm (relatif, donc valable dans le standalone).
RUN for pkg in better-sqlite3 sharp; do \
      [ -e ".next/standalone/node_modules/$pkg" ] \
        || ln -s "$(readlink "node_modules/$pkg")" ".next/standalone/node_modules/$pkg"; \
    done \
    && cd .next/standalone && node -e 'require("better-sqlite3"); require("sharp")'

# 3. Exécution : utilisateur non root, données sur le volume /data.
FROM ${NODE_IMAGE} AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr \
    && rm -rf /var/lib/apt/lists/* \
    && tesseract --version
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    DATA_DIR=/data \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
RUN mkdir -p /data && chown node:node /data
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/drizzle ./drizzle
USER node
VOLUME /data
EXPOSE 3000
CMD ["node", "server.js"]
