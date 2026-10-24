# Khoavila Music APK

Nhánh Android giữ frontend web TV/remote hiện có, thêm giao diện app ở `/app`.
Trên Android giao diện này mở mặc định. Source và Gradle wrapper đã có trong `android/`;
không cần chạy lại `cap add android`.

## Build trên PC

1. Cài Node.js 24 LTS, Android Studio 2025.2.1 trở lên, SDK Platform 36. Dùng JDK 21 của Android Studio cho Gradle.
2. Checkout nhánh `android`, chạy `npm ci` tại thư mục dự án.
3. Sao chép `.env.android.example` thành `.env.android.local`. Điền:
   - `VITE_API_ORIGIN`: origin HTTPS của backend phòng, ví dụ `https://khoavila.io.vn` (không thêm `/api`).
   - `VITE_PUBLIC_WEB_ORIGIN`: origin HTTPS của web `/remote`, dùng trong mã QR.
   - `VITE_YOUTUBE_API_KEY`: public API key có quyền YouTube Data API v3 cho tìm kiếm. Nếu bỏ trống, app vẫn nhận bài qua remote; tìm trực tiếp sẽ thông báo chưa cấu hình. Đây là dữ liệu công khai trong APK, không điền client secret hay refresh token.
4. Chạy:

```sh
npm run android:sync
npm run android:open
```

`android:sync` kiểm tra cấu hình, kiểm tra TypeScript, build **web assets** và đồng bộ Capacitor.
Đây chưa phải bước biên dịch APK. Trong Android Studio, chờ Gradle sync rồi chọn
Build → Generate App Bundles or APKs → Generate APKs (tên menu có thể khác theo phiên bản).

Hoặc build debug bằng terminal sau khi đã cài SDK/JDK và cấu hình `android/local.properties`:

```powershell
# Windows PowerShell
cd android
.\gradlew.bat assembleDebug
```

```sh
# Linux/macOS
cd android
./gradlew assembleDebug
```

APK nằm ở `android/app/build/outputs/apk/debug/app-debug.apk`.
Để phát hành, dùng Generate Signed App Bundle / APK, giữ keystore riêng ngoài Git.
Mỗi lần cập nhật source hoặc `.env.android.local`, chạy lại `npm run android:sync` trước khi build.

## Backend cần cho APK

Giao diện nằm trong APK, origin Android là `https://localhost`; API và Socket.IO chạy trên backend HTTPS.
Source backend đã hỗ trợ biến tùy chọn:

```dotenv
FRONTEND_URL=https://khoavila.io.vn
ANDROID_APP_ORIGINS=https://localhost
```

Biến này phải được truyền vào **process phục vụ `/api/rooms`** (service `frontend` trong Compose hiện tại),
không chỉ service `auth`. Khi triển khai sau này, thêm vào `services.frontend.environment` rồi chỉ build/recreate
service frontend. Không dùng wildcard CORS. Chưa cấu hình biến này thì APK sẽ bị backend từ chối origin.
Thay đổi này không được tự triển khai/restart trong công việc chuẩn bị source Android.
Proxy HTTPS phải chuyển tiếp cả HTTP API và WebSocket tại `/api/rooms/socket.io`.

## Cách dùng và giới hạn

- Bấm Bắt đầu nghe nhạc để mở/khôi phục phòng. Tìm kiếm chỉ gửi khi bấm Tìm hoặc Enter.
- Bài đầu tiên tự chọn để phát; nếu WebView yêu cầu tương tác, bấm nút bật âm thanh trên player.
- Tìm, thêm, phát/dừng, chuyển và xóa bài cùng màn hình. Chuyển bài bỏ bài hiện tại khỏi hàng đợi.
- QR cho phép điện thoại khác điều khiển. Mã phòng lưu riêng cho app; không dùng nhầm phòng TV web cũ.
- Android TV có Leanback launcher, icon/banner, không bắt buộc touchscreen. D-pad và Enter dùng được cho các nút; Back đóng dialog hoặc hỏi trước khi thoát.
- Giao diện thích ứng portrait/landscape, không khóa hướng điện thoại. Activity giữ màn hình sáng khi đang hiển thị.
- Nguồn phát là YouTube nhúng; cần mạng và video được phép nhúng. Không tải nhạc offline, không tách audio, không hứa hẹn phát khi khóa màn hình. App tạm dừng khi vào nền.
- Bản đầu không cung cấp đăng nhập/import playlist Google bên trong WebView. Remote web hiện có vẫn hoạt động riêng.

## Kiểm thử

```sh
npm run test:android
npm --prefix auth-proxy-server ci
npx playwright install chromium
npm run test:android-ui
```

Browser suite dùng backend riêng trên cổng 4387, SQLite trong RAM và Vite trên 5187; mock YouTube search/player,
không sử dụng quota hay database production. Ảnh nằm trong `test-results/` (không commit).
Suite kiểm tra mobile/TV, QR dialog, thao tác phím, HTTP/Socket.IO đồng bộ hàng đợi và CORS.
Vẫn cần kiểm thử APK thật: video/âm thanh, YouTube WebView, bàn phím Android, Back, Home/Resume,
safe area trên thiết bị và remote TV. Không coi browser pass là chứng nhận APK pass.

## Skill CSS

Skill đi kèm repo: `.agents/skills/kara-app-css/SKILL.md`.
Dùng `$kara-app-css` trong Codex tại checkout này. Có thể copy thư mục `kara-app-css` vào
`~/.codex/skills/` trên PC để dùng ngoài repository.

Tham khảo chính thức: [Capacitor Android](https://capacitorjs.com/docs/android),
[môi trường build](https://capacitorjs.com/docs/getting-started/environment-setup),
[điều hướng TV](https://developer.android.com/training/tv/get-started/navigation).
