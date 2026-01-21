# Hướng Dẫn Thiết Lập Lại OAuth 2.0 Cho Ứng Dụng

## Vấn đề
Bạn đang gặp lỗi `401 deleted_client` khi cố gắng đăng nhập YouTube, điều này có nghĩa là OAuth client credentials hiện tại đã bị xóa khỏi Google Cloud Console.

## Giải Pháp
Bạn cần tạo lại OAuth 2.0 Client ID và Secret mới. Dưới đây là các bước chi tiết:

### Bước 1: Truy cập Google Cloud Console
1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. Chọn hoặc tạo một project mới (hoặc sử dụng project hiện tại)
3. Bật YouTube Data API v3 cho project:
   - Vào "APIs & Services" → "Library"
   - Tìm và bật "YouTube Data API v3"

### Bước 2: Cấu hình OAuth Consent Screen
1. Vào "APIs & Services" → "OAuth consent screen"
2. Chọn loại ứng dụng phù hợp ("External" nếu dành cho công chúng)
3. Hoàn thành các thông tin yêu cầu như:
   - Application name (ví dụ: "T-Karaoke App")
   - User support email
   - Authorized domains: `hat.risingdragon.vn`
   - Developer contact information
4. Trong phần "Scopes", thêm các phạm vi cần thiết:
   - `.../auth/youtube.readonly` - Xem dữ liệu YouTube của người dùng
   - `.../auth/userinfo.profile` - Xem hồ sơ cơ bản của người dùng
   - `.../auth/userinfo.email` - Xem địa chỉ email của người dùng
5. Lưu lại và tiếp tục

### Bước 3: Tạo OAuth 2.0 Client ID mới
1. Vào "APIs & Services" → "Credentials"
2. Nhấp vào "Create Credentials" → "OAuth 2.0 Client IDs"
3. Chọn "Application type" là "Web application"
4. Đặt tên cho ứng dụng (ví dụ: "T-Karaoke Web App")
5. Trong phần "Authorized redirect URIs", thêm các địa chỉ sau:
   - `https://hat.risingdragon.vn/youtube-auth`
   - `http://localhost:5173/youtube-auth` (nếu phát triển cục bộ)
   - `http://localhost:3000/youtube-auth` (nếu dùng cổng khác)
6. Nhấp "Create" để tạo OAuth 2.0 Client

### Bước 4: Lưu trữ credentials an toàn
Sau khi tạo thành công, bạn sẽ thấy:
- OAuth 2.0 Client ID (dài khoảng 24 ký tự)
- OAuth 2.0 Client Secret (dài khoảng 24 ký tự)

**QUAN TRỌNG**: Sao chép và lưu trữ hai giá trị này ở nơi an toàn, vì bạn sẽ không thể xem lại Client Secret sau khi rời khỏi trang này.

### Bước 5: Cập nhật cấu hình trong ứng dụng
Sau khi có Client ID và Client Secret mới, cập nhật các file sau:

#### Cập nhật file `.env` ở thư mục gốc:
```env
# Thay thế bằng Client ID mới bạn vừa tạo
VITE_YOUTUBE_CLIENT_ID="[CLIENT_ID_MỚI_BẠN_VỪA_TẠO]"
```

#### Cập nhật file `auth-proxy-server/.env`:
```env
# Thay thế bằng Client ID và Client Secret mới bạn vừa tạo
YOUTUBE_CLIENT_ID=[CLIENT_ID_MỚI_BẠN_VỪA_TẠO]
YOUTUBE_CLIENT_SECRET=[CLIENT_SECRET_MỚI_BẠN_VỪA_TẠO]
```

### Bước 6: Kiểm tra lại
1. Khởi động lại cả ứng dụng chính và auth proxy server
2. Xóa cache trình duyệt và thử đăng nhập lại

## Các lỗi thường gặp và cách xử lý

### Lỗi "redirect_uri_mismatch"
- Kiểm tra kỹ rằng URI chuyển hướng trong Google Cloud Console khớp chính xác với `REDIRECT_URI` trong file `.env`

### Lỗi "invalid_client"
- Đảm bảo bạn đang sử dụng đúng Client ID và Client Secret
- Kiểm tra không có khoảng trắng thừa trong các giá trị

### Lỗi "unauthorized_redirect_uri"
- Đảm bảo bạn đã thêm đúng URI chuyển hướng trong phần "Authorized redirect URIs" của OAuth 2.0 Client

### Lỗi "access_denied" hoặc "popup_blocked_by_browser"
- Đây có thể là lỗi liên quan đến popup bị chặn bởi trình duyệt
- Thử mở trang trong cửa sổ ẩn danh hoặc kiểm tra cài đặt trình duyệt

## Ghi chú quan trọng
- Không chia sẻ Client Secret với bất kỳ ai
- Không commit các file chứa credentials vào kho mã nguồn
- Nếu bạn đang chạy trên nhiều môi trường (dev/prod), bạn có thể cần cấu hình riêng cho từng môi trường

## Kiểm tra credentials
Bạn có thể chạy lệnh sau để kiểm tra xem credentials đã được tải đúng chưa:
```bash
cd auth-proxy-server
node test-oauth.js
```

## Nếu bạn không thể tạo credentials mới
Nếu bạn không có quyền truy cập vào Google Cloud Console hoặc không thể tạo credentials mới, bạn có thể:
1. Liên hệ với người quản lý tài khoản Google Cloud
2. Sử dụng một tài khoản Google khác để tạo project mới
3. Sử dụng dịch vụ của bên thứ ba để xử lý OAuth nếu cần

## Gỡ lỗi nâng cao
Nếu sau khi cập nhật credentials mà vẫn gặp lỗi:
1. Kiểm tra log của auth proxy server để xem lỗi cụ thể
2. Đảm bảo cả ứng dụng chính và auth proxy server đều đang chạy phiên bản mới nhất
3. Kiểm tra xem có bất kỳ phần mềm nào chặn kết nối mạng không (firewall, antivirus)
4. Thử trên trình duyệt khác hoặc chế độ ẩn danh

## Lỗi "GeneralOAuthFlows" và "quyền truy cập bị chặn"

Nếu bạn gặp lỗi liên quan đến "GeneralOAuthFlows" hoặc "quyền truy cập bị chặn", điều này thường xảy ra khi ứng dụng OAuth chưa được xác nhận (verified). Google yêu cầu xác nhận ứng dụng OAuth nếu bạn muốn truy cập dữ liệu của người dùng.

### Cách giải quyết:

1. **Trở lại OAuth Consent Screen**:
   - Trong Google Cloud Console, vào "APIs & Services" → "OAuth consent screen"
   - Nếu bạn đã chọn "External" (ứng dụng công khai), bạn cần hoàn tất quy trình xác nhận

2. **Hoàn tất quy trình xác nhận**:
   - Cung cấp thêm thông tin bảo mật và chính sách quyền riêng tư
   - Tải lên chính sách quyền riêng tư hợp lệ
   - Có thể cần thêm thông tin về ứng dụng để Google xem xét

3. **Trong khi chờ xác nhận**, bạn có thể:
   - Thêm tài khoản email của bạn (và tài khoản người dùng khác nếu cần) vào phần "Test users"
   - Chỉ những tài khoản trong danh sách test users mới có thể sử dụng ứng dụng

4. **Nếu bạn chọn "Internal"** (chỉ dành cho tổ chức):
   - Ứng dụng chỉ có thể được sử dụng bởi các tài khoản trong cùng tổ chức Google Workspace
   - Không cần xác nhận nhưng giới hạn người dùng

## Tùy chọn thay thế nếu không thể xác nhận ứng dụng

Nếu bạn không thể hoàn tất quy trình xác nhận, bạn có thể:
1. Sử dụng chế độ "Testing" với danh sách người dùng thử nghiệm
2. Tạo một ứng dụng "Internal" nếu bạn đang sử dụng Google Workspace
3. Sử dụng API Key thay vì OAuth cho các tác vụ không yêu cầu quyền truy cập cá nhân