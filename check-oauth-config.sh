#!/bin/bash
# Script kiểm tra OAuth credentials

echo "=== KIỂM TRA CẤU HÌNH OAUTH ==="

echo ""
echo "Kiểm tra file .env ở thư mục gốc:"
echo "----------------------------------------"
if [ -f .env ]; then
    echo "✓ File .env tồn tại"
    echo "VITE_YOUTUBE_CLIENT_ID: $(grep 'VITE_YOUTUBE_CLIENT_ID' .env | cut -d '=' -f2)"
    echo "VITE_AUTH_PROXY_URL: $(grep 'VITE_AUTH_PROXY_URL' .env | cut -d '=' -f2)"
    echo "VITE_APP_DOMAIN: $(grep 'VITE_APP_DOMAIN' .env | cut -d '=' -f2)"
else
    echo "✗ File .env không tồn tại"
fi

echo ""
echo "Kiểm tra file auth-proxy-server/.env:"
echo "----------------------------------------"
if [ -f auth-proxy-server/.env ]; then
    echo "✓ File auth-proxy-server/.env tồn tại"
    echo "YOUTUBE_CLIENT_ID: $(grep 'YOUTUBE_CLIENT_ID' auth-proxy-server/.env | cut -d '=' -f2)"
    echo "YOUTUBE_CLIENT_SECRET: $(grep 'YOUTUBE_CLIENT_SECRET' auth-proxy-server/.env | cut -d '=' -f2 | sed 's/./&/g' | sed 's/.\{5\}$/*****/')"
    echo "REDIRECT_URI: $(grep 'REDIRECT_URI' auth-proxy-server/.env | cut -d '=' -f2)"
    echo "FRONTEND_URL: $(grep 'FRONTEND_URL' auth-proxy-server/.env | cut -d '=' -f2)"
else
    echo "✗ File auth-proxy-server/.env không tồn tại"
fi

echo ""
echo "=== HƯỚNG DẪN TIẾP THEO ==="
echo "Nếu bạn vẫn gặp lỗi 'deleted_client', vui lòng làm theo hướng dẫn trong file OAUTH_SETUP_GUIDE.md"
echo "để tạo lại OAuth credentials mới từ Google Cloud Console."