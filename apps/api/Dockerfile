# Imagen de la API para Render. Se construye desde la raíz del monorepo:
#   docker build -f apps/api/Dockerfile .
# Etapa 1: instalar y compilar con pnpm (workspace completo, sólo lo necesario para la API).
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @inventariosmart/api...
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @inventariosmart/shared build \
 && pnpm --filter @inventariosmart/api prisma:generate \
 && pnpm --filter @inventariosmart/api build \
 && pnpm --filter @inventariosmart/api --prod deploy --legacy /out

# Etapa 2: runtime mínimo. Aplica migraciones al arrancar y levanta la API.
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out ./
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/prisma ./prisma
COPY --from=build /repo/apps/api/prisma.config.ts ./prisma.config.ts
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
