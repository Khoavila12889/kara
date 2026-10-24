FROM node:24.22.0-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY index.html vite.config.* tsconfig*.json postcss.config.* tailwind.config.* ./
COPY src ./src
# Only public Vite settings are accepted as build arguments.
ARG VITE_YOUTUBE_API_KEY
ARG VITE_YOUTUBE_CLIENT_ID
ARG VITE_AUTH_PROXY_URL
ARG VITE_APP_DOMAIN
ARG VITE_APP_HOST
RUN npm run build

FROM node:24.22.0-alpine AS backend-builder
WORKDIR /app
COPY auth-proxy-server/package*.json ./
RUN npm ci
COPY auth-proxy-server/tsconfig.json ./
COPY auth-proxy-server/src ./src
RUN npm run build
RUN npm prune --omit=dev

FROM node:24.22.0-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 ROOM_SERVICE=1 ROOM_DB_PATH=/data/rooms.sqlite FRONTEND_DIST=/app/frontend-dist
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=frontend-builder /app/dist ./frontend-dist
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 3000
CMD ["node","dist/index.js"]
