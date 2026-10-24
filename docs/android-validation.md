# Kiểm tra source Android — 2026-10-24

- `npm run test:android`: 4/4 test logic hàng đợi qua.
- `npm run test:android-ui`: 5/5 browser test qua (Chromium; backend riêng, SQLite RAM; YouTube mô phỏng).
- Viewport kiểm tra: 320×640, 390×844, 844×390, 1280×720, 1920×1080; không tràn ngang.
- Kiểm tra thêm: focus D-pad, phím nhập liệu, Back/dialog, QR, kích thước nút, thêm/xóa/phát/dừng, CORS Android, nhận 45 bài qua Socket.IO, cuộn bài cuối và giữ phòng sau reload.
- `npm run android:sync`: TypeScript, Vite mode android và Capacitor sync qua. Không gọi Gradle để build APK.
- XML Android parse hợp lệ; skill `kara-app-css` qua `quick_validate.py`.
- Entry app ~155 kB JS, màn hình MusicApp ~17 kB và shared player ~95 kB trước gzip. Bundle web legacy ~712 kB tải riêng; Vite vẫn cảnh báo kích thước bundle legacy.
- Cấu hình kiểm tra sử dụng origin HTTPS công khai, không sử dụng API key thật. Tìm kiếm trực tiếp trong APK cần điền key trên PC.

Chưa xác minh trên thiết bị Android: Gradle/APK, phát YouTube thật, âm thanh, WebView, keyboard/insets, lifecycle và remote TV thật. Backend production chưa triển khai cấu hình `ANDROID_APP_ORIGINS`.

Ảnh preview dùng dữ liệu giả: [điện thoại](android-preview-phone.png), [màn hình rộng](android-preview-tv.png).
