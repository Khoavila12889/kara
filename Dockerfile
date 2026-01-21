# Multi-stage build for T-Karaoke application with auth proxy server
# Features: Karaoke mode, Music mode, YouTube playlist integration, Vietnamese UI,
# OAuth2 authentication with PKCE, Firebase real-time synchronization,
# background theme customization, responsive design

# Stage 1: Build the frontend application
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy package files and install dependencies for frontend
COPY package*.json ./
RUN npm install

# Copy the frontend source code
COPY . .

# Build the frontend application
RUN npm run build

# Stage 2: Build the auth proxy server
FROM node:20-alpine AS auth-builder

WORKDIR /app

# Copy auth proxy server package files and install dependencies
COPY auth-proxy-server/package*.json ./auth-proxy-server/
COPY auth-proxy-server/tsconfig.json ./auth-proxy-server/

WORKDIR /app/auth-proxy-server
RUN npm install

# Copy the auth proxy server source code
WORKDIR /app
COPY auth-proxy-server/src ./auth-proxy-server/src

# Build the auth proxy server
RUN npm run build --prefix auth-proxy-server

# Stage 3: Create the final image with both services using reverse proxy
FROM node:20-alpine

# Install nginx for reverse proxy
RUN apk add --no-cache nginx

WORKDIR /app

# Copy built frontend assets
COPY --from=frontend-builder /app/dist ./frontend-dist

# Copy built auth proxy server
COPY --from=auth-builder /app/auth-proxy-server ./auth-proxy-server

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Install serve globally for serving frontend
RUN npm install -g serve

# Install PM2 globally for process management
RUN npm install -g pm2

# Create a startup script
RUN echo '#!/bin/sh

# Create log directories
mkdir -p /var/log

# Start the auth proxy server in background
cd /app/auth-proxy-server
# Use environment variables from runtime
export \$(cat .env | xargs) 2>/dev/null || true
node dist/index.js > /var/log/auth-proxy.log 2>&1 &
AUTH_PID=$!

# Wait a moment for auth server to start
sleep 2

# Start the frontend server in background
cd /app
serve -s ./frontend-dist -l 8080 > /var/log/frontend.log 2>&1 &
FRONTEND_PID=$!

# Wait a moment for frontend server to start
sleep 2

# Start nginx as reverse proxy
nginx -g "daemon off;"

# Wait for all processes
wait $AUTH_PID
wait $FRONTEND_PID
' > /app/start.sh

RUN chmod +x /app/start.sh

# Expose ports
EXPOSE 80

# Start both services
CMD ["/app/start.sh"]
