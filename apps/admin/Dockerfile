# syntax=docker/dockerfile:1
# CHIRKEY TOUR — Admin (Next.js), production multi-stage standalone (фаза 16.1)
FROM node:20-alpine AS deps
WORKDIR /app
ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY package.json package-lock.json* ./
COPY apps/admin/package.json apps/admin/
COPY packages ./packages
RUN npm ci --workspace=@chirkey/admin

FROM node:20-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build -w @chirkey/admin

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3002 HOSTNAME=0.0.0.0
RUN apk add --no-cache curl && addgroup -S app && adduser -S app -G app
COPY --from=build /app/apps/admin/.next/standalone ./
COPY --from=build /app/apps/admin/.next/static ./apps/admin/.next/static
# public может отсутствовать — wildcard-копирование не ломает сборку
COPY --from=build /app/apps/admin/public/. ./apps/admin/public/
USER app
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3002/ >/dev/null || exit 1
CMD ["node", "apps/admin/server.js"]
