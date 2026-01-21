# Hướng Dẫn Từng Bước Tạo Lại OAuth Credentials

## Bước 1: Truy cập Google Cloud Console
1. Mở trình duyệt và truy cập: https://console.cloud.google.com/
2. Đăng nhập bằng tài khoản Google của bạn
3. Chọn project hiện tại hoặc tạo project mới

## Bước 2: Bật APIs cần thiết
1. Trong menu bên trái, chọn "APIs & Services" → "Library"
2. Tìm kiếm "YouTube Data API v3"
3. Nhấp vào kết quả tìm kiếm và chọn "Enable"

## Bước 3: Cấu hình OAuth Consent Screen
1. Trong menu bên trái, chọn "APIs & Services" → "OAuth consent screen"
2. Chọn "External" (nếu ứng dụng dành cho công chúng) hoặc "Internal" (nếu chỉ dùng nội bộ)
3. Nhập các thông tin bắt buộc:
   - Application name: "T-Karaoke App" hoặc tên bạn muốn
   - User support email: Email của bạn
   - Authorized domains: Thêm "hat.risingdragon.vn"
   - Developer contact information: Email của bạn
4. Nhấp "Save and Continue"

## Bước 4: Thêm Scopes (Quyền hạn)
1. Trong phần "Scopes", nhấp "Add or remove scopes"
2. Tìm và thêm các scopes sau:
   - `.../auth/youtube.readonly` - Xem dữ liệu YouTube của người dùng
   - `.../auth/userinfo.profile` - Xem hồ sơ cơ bản của người dùng
   - `.../auth/userinfo.email` - Xem địa chỉ email của người dùng
3. Nhấp "Save and Continue"

## Bước 5: Thêm Test Users (nếu chọn External)
1. Trong phần "Test users", nhấp "Add users"
2. Thêm địa chỉ email của bạn (và bất kỳ ai khác cần thử nghiệm)
3. Nhấp "Save and Continue"

## Bước 6: Hoàn tất OAuth Consent Screen
1. Nhấp "Back to Dashboard" để hoàn tất quá trình thiết lập OAuth consent screen
2. Lưu ý rằng nếu bạn chọn "External", ứng dụng sẽ cần được xác nhận bởi Google để sử dụng rộng rãi

## Bước 7: Tạo OAuth 2.0 Client ID
1. Trong menu bên trái, chọn "APIs & Services" → "Credentials"
2. Nhấp "Create Credentials" → "OAuth 2.0 Client ID"
3. Nếu bạn chưa hoàn tất OAuth consent screen, bạn sẽ được yêu cầu làm vậy trước

## Bước 8: Cấu hình Web Application
1. Chọn "Application type" là "Web application"
2. Nhập "Name" cho ứng dụng (ví dụ: "T-Karaoke Web App")
3. Trong phần "Authorized redirect URIs", thêm:
   - `https://hat.risingdragon.vn/youtube-auth`
4. Nếu phát triển cục bộ, thêm cả:
   - `http://localhost:5173/youtube-auth`
5. Nhấp "Create"

## Bước 9: Sao chép Credentials
1. Sau khi tạo thành công, bạn sẽ thấy:
   - OAuth 2.0 Client ID (chuỗi dài khoảng 24 ký tự)
   - OAuth 2.0 Client Secret (chuỗi dài khoảng 24 ký tự)
2. **QUAN TRỌNG**: Copy và lưu trữ hai giá trị này ở nơi an toàn NGAY LẬP TỨC, vì bạn sẽ không thể xem lại Client Secret sau khi rời khỏi trang này

## Bước 10: Cập nhật ứng dụng
1. Mở file `.env` ở thư mục gốc của ứng dụng
2. Thay thế giá trị cũ bằng giá trị mới:
   ```
   VITE_YOUTUBE_CLIENT_ID="[CLIENT_ID_MỚI_BẠN_VỪA_SAO_CHÉP]"
   ```
3. Mở file `auth-proxy-server/.env`
4. Cập nhật:
   ```
   YOUTUBE_CLIENT_ID=[CLIENT_ID_MỚI_BẠN_VỪA_SAO_CHÉP]
   YOUTUBE_CLIENT_SECRET=[CLIENT_SECRET_MỚI_BẠN_VỪA_SAO_CHÉP]
   ```

## Bước 11: Xử lý lỗi "GeneralOAuthFlows" và "quyền truy cập bị chặn"

Nếu bạn gặp lỗi này, có thể do ứng dụng OAuth chưa được xác nhận. Có một số tùy chọn:

### Tùy chọn 1: Thêm tài khoản vào danh sách Test Users (khuyến nghị cho giai đoạn phát triển)
1. Quay lại "APIs & Services" → "OAuth consent screen"
2. Chọn "Test users" ở menu bên trái
3. Nhấp "Add users" và thêm địa chỉ email của bạn
4. Lưu thay đổi

### Tùy chọn 2: Gửi ứng dụng để xác nhận (cho sản phẩm chính thức)
1. Trở lại "OAuth consent screen"
2. Nhấp vào "Submit for verification"
3. Cung cấp thêm thông tin bảo mật và chính sách quyền riêng tư
4. Quá trình xác nhận có thể mất vài ngày

## Bước 12: Khởi động lại ứng dụng
1. Dừng ứng dụng nếu đang chạy
2. Dừng auth proxy server nếu đang chạy
3. Khởi động lại cả hai:
   - Auth proxy server: `cd auth-proxy-server && npm start` (hoặc `node src/index.ts`)
   - Ứng dụng chính: `npm run dev`
4. Xóa cache trình duyệt và thử đăng nhập lại

## Ghi chú quan trọng:
- Không chia sẻ Client Secret với bất kỳ ai
- Không commit các file chứa credentials vào kho mã nguồn
- Nếu bạn không thể truy cập Google Cloud Console, bạn cần liên hệ với người quản lý tài khoản
- Đối với ứng dụng "External", bạn cần thêm tài khoản vào "Test users" để có thể sử dụng cho đến khi ứng dụng được xác nhận