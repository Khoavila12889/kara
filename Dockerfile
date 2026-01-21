# =========================
# Stage 1: Build frontend
# =========================
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# =========================
# Stage 2: Build auth proxy
# =========================
FROM node:20-alpine AS auth-builder
WORKDIR /app/auth-proxy-server
COPY auth-proxy-server/package*.json ./
COPY auth-proxy-server/tsconfig.json ./
COPY auth-proxy-server/src ./src
RUN npm install

# =========================
# Stage 3: Production image
# =========================
FROM node:20-alpine

WORKDIR /app

# Copy built assets
COPY --from=frontend-builder /app/dist ./frontend-dist
COPY --from=auth-builder /app/auth-proxy-server ./auth-proxy-server

# Install runtime tools
RUN npm install -g serve pm2

# Copy startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 3000 5000
CMD ["/app/start.sh"]
