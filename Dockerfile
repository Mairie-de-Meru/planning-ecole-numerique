# Image de production : serveur Next.js autonome + migrations au démarrage
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Pas de base au moment de la construction : les migrations sont jouées au démarrage du conteneur.
RUN npx next build \
 && npx esbuild scripts/migrate.ts scripts/seed.ts --bundle --platform=node --target=node22 --outdir=dist --out-extension:.js=.cjs --log-level=warning

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/drizzle ./drizzle
COPY --from=build --chown=app:app /app/dist ./dist
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD wget -qO- http://127.0.0.1:3000/connexion >/dev/null || exit 1
CMD ["sh", "-c", "node dist/migrate.cjs && node dist/seed.cjs && exec node server.js"]
