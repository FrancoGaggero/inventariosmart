# Imagen de la API para Render. Se construye desde la raíz del monorepo:
#   docker build -f apps/api/Dockerfile .
# Etapa 1: instalar y compilar con pnpm (sólo la API y sus dependencias del workspace).
FROM node:22-alpine AS build
RUN npm install -g pnpm@12.3.4
WORKDIR /repo
# Manifiestos primero, para aprovechar la caché de capas.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/api-client/package.json packages/api-client/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @inventariosmart/api...
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @inventariosmart/shared build \
 && pnpm --filter @inventariosmart/api build \
 && pnpm --filter @inventariosmart/api --prod deploy --legacy /out

# Etapa 2: runtime mínimo. Aplica migraciones al arrancar y levanta la API.
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out ./
COPY --from=build /repo/apps/api/dist ./dist
EXPOSE 3000
# `prisma` está en dependencies para que migrate deploy funcione en producción.
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node dist/main.js"]
