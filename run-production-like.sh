#!/bin/bash
# run-production-like.sh - Script chạy cả hai server giống như production

echo "🚀 Khởi động T-Karaoke ứng dụng (chế độ giống production)..."

# Khởi động auth proxy server trong background
echo "🔌 Khởi động Auth Proxy Server..."
cd auth-proxy-server
npm run dev > auth-proxy.log 2>&1 &
AUTH_PROXY_PID=$!
cd ..

echo "Auth Proxy Server PID: $AUTH_PROXY_PID"

# Đợi một chút để auth proxy server khởi động
sleep 3

# Khởi động frontend server
echo "📺 Khởi động Frontend Server..."
npx serve -s dist -l 5173 > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend Server PID: $FRONTEND_PID"

# Đợi một chút để frontend server khởi động
sleep 2

echo "✅ Cả hai server đã được khởi động!"
echo "🔌 Auth Proxy Server: http://localhost:3001"
echo "📺 Frontend Server: http://localhost:5173"
echo ""
echo "🌐 Để người dùng truy cập từ xa, bạn cần:"
echo "1. Sử dụng công cụ tunnel như ngrok: ngrok http 5173"
echo "2. Hoặc cấu hình domain của bạn (hat.risingdragon.vn) trỏ đến IP máy này"
echo "3. Cấu hình reverse proxy (nginx) để chuyển tiếp các đường dẫn API đến auth proxy server"
echo ""
echo "📋 Các endpoint quan trọng:"
echo "   - Frontend: http://hat.risingdragon.vn (port 80)"
echo "   - Auth callback: http://hat.risingdragon.vn/youtube-auth"
echo "   - API callback: http://hat.risingdragon.vn/api/youtube/callback"
echo ""
echo "🛑 Dừng server: kill $AUTH_PROXY_PID $FRONTEND_PID"

# Giữ script chạy
wait $AUTH_PROXY_PID $FRONTEND_PID