# run-production-like.ps1 - Script chạy cả hai server giống như production

Write-Host "🚀 Khởi động T-Karaoke ứng dụng (chế độ giống production)..." -ForegroundColor Green

# Build ứng dụng trước
Write-Host "🔨 Building ứng dụng..."
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Lỗi khi build ứng dụng!" -ForegroundColor Red
    exit 1
}

# Khởi động auth proxy server trong background
Write-Host "🔌 Khởi động Auth Proxy Server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-Command", "Set-Location '$(Get-Location)\auth-proxy-server'; npm run dev"

# Đợi một chút để auth proxy server khởi động
Start-Sleep -Seconds 5

# Khởi động frontend server
Write-Host "📺 Khởi động Frontend Server..." -ForegroundColor Yellow
npx serve -s dist -l 5173 > frontend.log 2>&1 &
$frontendProcess = Get-Process -Name "serve" -ErrorAction SilentlyContinue

Write-Host "✅ Cả hai server đã được khởi động!" -ForegroundColor Green
Write-Host "🔌 Auth Proxy Server: http://localhost:3001" -ForegroundColor Cyan
Write-Host "📺 Frontend Server: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "🌐 Để người dùng truy cập từ xa, bạn cần:" -ForegroundColor Magenta
Write-Host "1. Sử dụng công cụ tunnel như ngrok: ngrok http 5173"
Write-Host "2. Hoặc cấu hình domain của bạn (hat.risingdragon.vn) trõ đến IP máy này"  
Write-Host "3. Cấu hình reverse proxy (nginx) để chuyển tiếp các đường dẫn API đến auth proxy server"
Write-Host ""
Write-Host "📋 Các endpoint quan trọng:" -ForegroundColor Magenta
Write-Host "   - Frontend: http://hat.risingdragon.vn (port 80)"
Write-Host "   - Auth callback: http://hat.risingdragon.vn/youtube-auth"
Write-Host "   - API callback: http://hat.risingdragon.vn/api/youtube/callback"
Write-Host ""
Write-Host "💡 Mẹo: Để chạy trên production, sử dụng Docker với lệnh:" -ForegroundColor White
Write-Host "   docker build -t tkaraoke . && docker run -p 80:80 tkaraoke"