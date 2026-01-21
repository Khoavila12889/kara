#!/bin/sh
set -e

mkdir -p /var/log

echo "Starting auth proxy..."
cd /app/auth-proxy-server
node dist/index.js > /var/log/auth-proxy.log 2>&1 &

echo "Starting frontend..."
cd /app
serve -s ./frontend-dist -l 3000 > /var/log/frontend.log 2>&1 &

wait