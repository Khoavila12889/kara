# -------- Build stage --------
FROM node:24.22.0-alpine AS builder

WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build

# -------- Production stage --------
FROM node:24.22.0-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist


EXPOSE 5000
CMD ["node", "dist/index.js"]