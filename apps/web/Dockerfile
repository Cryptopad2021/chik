# syntax=docker/dockerfile:1
# CHIRKEY TOUR — Public web (Next.js), production multi-stage standalone (фаза 16.1)
FROM node:20-alpine AS deps
WORKDIR /app
ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api
ARG NEXT_PUBLIC_WEB_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_PUBLIC_WEB_URL=$NEXT_PUBLIC_WEB_URL
COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/
COPY packages ./packages
RUN npm ci --workspace=@chirkey/web

FROM node:20-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WEB_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_PUBLIC_WEB_URL=$NEXT_PUBLIC_WEB_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build -w @chirkey/web

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN apk add --no-cache curl && addgroup -S app && adduser -S app -G app
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
# public/ может отсутствовать в git (только .gitkeep) — копируем через wildcard, отсутствие не ломает сборку
COPY --from=build /app/apps/web/public/. ./apps/web/public/
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/ >/dev/null || exit 1
CMD ["node", "apps/web/server.js"]
