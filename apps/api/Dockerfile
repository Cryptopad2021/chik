# syntax=docker/dockerfile:1
# CHIRKEY TOUR — API (NestJS), production multi-stage (ТЗ §75, фаза 16.1)
FROM node:20-alpine AS base
WORKDIR /repo
COPY package.json package-lock.json* turbo.json ./
COPY packages ./packages
COPY apps/api/package.json apps/api/package.json
# devDependencies нужны: prisma CLI (migrate deploy) и ts-node (seed/bootstrap) работают в prod-контейнере
RUN npm ci --workspace=@chirkey/api --workspace=@chirkey/types

FROM node:20-alpine AS build
WORKDIR /repo
COPY . .
RUN npm ci && npx prisma generate && npm run build -w @chirkey/api

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache curl
COPY --from=base /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/prisma ./prisma
# ts-node для seed/bootstrap из prod-контейнера (один раз — создать админа)
COPY --from=build /repo/tsconfig.json ./tsconfig.json
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /repo/node_modules/@prisma ./node_modules/@prisma
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3001/api/health || exit 1
CMD ["node", "dist/main.js"]
