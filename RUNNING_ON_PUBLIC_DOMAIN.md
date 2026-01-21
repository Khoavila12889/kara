# Hướng Dẫn Chạy Ứng Dụng Trên Domain Công Khai

## Tổng Quan
Ứng dụng T-Karaoke gồm 2 phần chính:
1. **Frontend Server** - Giao diện người dùng (React app)
2. **Auth Proxy Server** - Xử lý xác thực OAuth với YouTube (cổng 3001)

## Cách 1: Chạy Với Docker (Đề Xuất)

### Bước 1: Build Docker Image
```bash
docker build -t tkaraoke .
```

### Bước 2: Chạy Container
```bash
# Với môi trường production
docker run -d \
  --name tkaraoke \
  -p 80:80 \
  -e YOUTUBE_CLIENT_ID="your_client_id" \
  -e YOUTUBE_CLIENT_SECRET="your_client_secret" \
  -e FRONTEND_URL="http://hat.risingdragon.vn" \
  -e REDIRECT_URI="http://hat.risingdragon.vn/youtube-auth" \
  tkaraoke
```

## Cách 2: Chạy Thủ Công Trên Máy Chủ

### Bước 1: Cài Đặt PM2 (nếu chưa có)
```bash
npm install -g pm2
```

### Bước 2: Build Frontend
```bash
npm run build
```

### Bước 3: Chạy Cả Hai Server
```bash
# Terminal 1: Chạy auth proxy server
cd auth-proxy-server
pm2 start npm --name "tkaraoke-auth" -- run dev

# Terminal 2: Chạy frontend server
npx serve -s dist -l 5173
```

### Bước 4: Cấu Hình Reverse Proxy (Nginx)
Tạo file cấu hình nginx:

```nginx
server {
    listen 80;
    server_name hat.risingdragon.vn;

    # Frontend
    location / {
        proxy_pass http://localhost:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Auth proxy
    location /api/youtube/callback {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /youtube-auth {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Sau đó reload nginx:
```bash
sudo nginx -t && sudo nginx -s reload
```

## Cách 3: Sử Dụng Công Cụ Tunnel (Cho Phát Triển/Mẫu Thử)

Nếu bạn muốn người dùng truy cập tạm thời mà không cần cấu hình máy chủ:

### Dùng Ngrok
```bash
# Cài đặt ngrok
npm install -g ngrok

# Chạy frontend
npx serve -s dist -l 5173

# Mở terminal khác và chạy auth proxy
cd auth-proxy-server && npm run dev

# Mở terminal khác và chạy ngrok
ngrok http 5173
```

Ngrok sẽ cung cấp một URL công khai mà người dùng có thể truy cập.

## Cấu Hình Domain

Đảm bảo domain `hat.risingdragon.vn` trỏ đến IP của máy chủ của bạn thông qua DNS A record.

## Cấu Hình OAuth

Trong Google Cloud Console, đảm bảo các URL sau được thêm vào "Authorized redirect URIs":
- `http://hat.risingdragon.vn/youtube-auth`
- `https://hat.risingdragon.vn/youtube-auth` (nếu dùng HTTPS)

## Kiểm Tra Hệ Thống

Sau khi chạy, kiểm tra các endpoint:
- Frontend: `http://hat.risingdragon.vn/`
- Health check: `http://hat.risingdragon.vn/health`
- Auth callback: `http://hat.risingdragon.vn/youtube-auth`

## Gỡ Rối

Nếu gặp lỗi "GeneralOAuthFlows":
1. Kiểm tra email của bạn đã được thêm vào "Test users" trong Google Cloud Console chưa
2. Đảm bảo "Authorized redirect URIs" đúng
3. Kiểm tra log của auth proxy server

Log của auth proxy server:
```bash
cd auth-proxy-server
npm run dev
```

## Dừng Ứng Dụng

Nếu dùng PM2:
```bash
pm2 stop tkaraoke-auth
pm2 delete tkaraoke-auth
```

Nếu dùng Docker:
```bash
docker stop tkaraoke
docker rm tkaraoke
```