---
name: kara-app-css
description: Thiết kế, chỉnh sửa và kiểm tra CSS của Khoavila Music Android và giao diện TV trong dự án kara; dùng cho bố cục cảm ứng, D-pad, focus, safe area và responsive. Không dùng cho website khác hoặc tự triển khai backend.
---

# CSS cho Khoavila Music

Đọc `src/android/MusicApp.tsx`, `src/android/music-app.css` và các selector liên quan trong `src/App.css` trước khi sửa. Kiểm tra git status và AGENTS.md trong checkout hiện tại. Không giả định dự án luôn nằm ở `/home/kara`.

## Quy ước của app

- Giao diện APK nằm trong `.music-app`; dùng tiền tố `music-` và token `--music-*`. Tránh thay đổi global `body`, `button`, `input` hay class Ant Design để sửa một màn hình app. `room-ui.css` quản lý giao diện web TV/remote cũ.
- Giữ bảng màu tối, chữ sáng, tím nhạt cho nút chính và focus. Đổi token thay vì rải thêm mã màu cho cùng vai trò. Chữ thường đạt tương phản ít nhất 4.5:1; biểu tượng điều khiển và viền focus ít nhất 3:1.
- Điện thoại: một cột, video → thông tin/phát → tìm kiếm/hàng đợi. Màn hình rộng: player và thư viện hai cột. Không khóa ngang mặc định; kiểm tra cả landscape thấp và bàn phím mở.
- Nút cảm ứng tối thiểu 48 × 48 CSS px, nút phát 64 px. Input ít nhất 16 px. Dùng `minmax(0, 1fr)`, `min-width: 0`, wrap cho tên bài dài; không che nội dung bằng `overflow-x: hidden` để làm hết lỗi tràn.
- Dùng `dvh` và `env(safe-area-inset-*)`, có fallback. Danh sách có vùng cuộn rõ ràng; phần tử cuối phải tới được bằng cảm ứng và D-pad. Không dùng height cố định theo một mẫu điện thoại.
- Mọi thao tác phải là button/link/input có tên truy cập. Hiển thị `:focus-visible` rõ; không xóa outline. Không cần hover mới xuất hiện nút xóa/thêm. Tránh tabindex dương và nút lồng trong nút.
- D-pad ở `useDpad.ts` chọn phần tử theo vị trí. Sau khi đổi bố cục, kiểm tra cả bốn hướng, Enter, Tab, Back, đóng dialog và quay về focus trước đó. Giữ ←/→ cho con trỏ khi đang nhập văn bản.
- Không remount player khi đổi tab, resize hoặc cập nhật metadata. Không che/tắt video YouTube để giả lập phát audio nền. Không đưa cấu hình kỹ thuật vào luồng nghe nhạc.
- Tôn trọng `prefers-reduced-motion`; không thêm hoạt ảnh nền chạy liên tục. Dùng SVG/CSS cho icon và trang trí hiện có.

## Xác minh phù hợp thay đổi

Chạy `npm run test:android` cho logic queue; `npm run test:android-ui` khi đổi bố cục/hành vi. Kiểm tra ảnh và thao tác ở 320×640, 390×844, 844×390, 1280×720, 1920×1080. Có trạng thái trống, tên dài, nhiều bài, mất mạng, lỗi, dialog QR. Xác nhận không tràn ngang, focus không bị cắt, nút chạm đủ lớn và cuộn tới bài cuối.

Kiểm thử trình duyệt không thay thế kiểm thử APK trên Android/TV thật; báo rõ phần chưa xác minh. Với chỉnh sửa CSS nhỏ, chỉ chạy kiểm tra liên quan. Không tự build APK hoặc restart dịch vụ khi người dùng chỉ giao sửa giao diện.
