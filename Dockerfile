# syntax=docker/dockerfile:1
# Obraz produkcyjny serwisu turniejowego (Next.js standalone).
FROM node:24-alpine AS deps
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:24-alpine AS build
WORKDIR /src
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /src/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
RUN apk add --no-cache tini \
 && adduser -D -h /home/container container
WORKDIR /app
COPY --from=build /src/.next/standalone ./
COPY --from=build /src/.next/static ./.next/static
COPY --from=build /src/public ./public
COPY --from=build /src/public/assets ./default-assets
COPY --from=build /src/drizzle ./drizzle
COPY --from=build /src/scripts/migrate.mjs ./scripts/migrate.mjs
# pełne pakiety potrzebne do migracji (standalone zawiera tylko pliki używane przez aplikację)
COPY --from=deps /src/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=deps /src/node_modules/postgres ./node_modules/postgres
COPY deploy/start.sh deploy/docker-entrypoint.sh ./
RUN chmod +x start.sh docker-entrypoint.sh \
 && mkdir -p .next/cache /data/assets && chmod -R a+rX /app && chmod -R a+rwX /app/.next/cache && chown container /data/assets
USER container
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--", "/app/docker-entrypoint.sh"]
