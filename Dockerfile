FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/ai-engine/package.json apps/ai-engine/package.json
COPY packages/types/package.json packages/types/package.json
RUN npm ci
COPY . .
RUN npm exec --workspace=backend -- prisma generate

FROM dependencies AS backend-build
RUN npm run build --workspace=backend

FROM backend-build AS backend
ENV NODE_ENV=production
ENV FFMPEG_PATH=/usr/bin/ffmpeg
RUN mkdir -p /app/spool /app/snapshots && chown -R node:node /app/spool /app/snapshots
USER node
WORKDIR /app/apps/backend
EXPOSE 3001
CMD ["node", "--require", "/app/docker/load-secrets.cjs", "dist/src/main.js"]

FROM dependencies AS web-build
ARG PUBLIC_ORIGIN
ENV NEXT_PUBLIC_API_URL=$PUBLIC_ORIGIN
ENV NEXT_PUBLIC_WS_URL=$PUBLIC_ORIGIN
ENV NEXT_TELEMETRY_DISABLED=1
RUN test -n "$PUBLIC_ORIGIN" && npm run build --workspace=web

FROM web-build AS web
ENV NODE_ENV=production
RUN chown -R node:node /app/apps/web/.next
USER node
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["npm", "start"]
