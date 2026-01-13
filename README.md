# T-Karaoke: Hệ thống Karaoke qua YouTube

Dự án T-Karaoke là một ứng dụng web cho phép người dùng tạo một phòng karaoke ảo, trong đó một màn hình lớn (TV) sẽ phát video karaoke từ YouTube, và nhiều người dùng khác có thể dùng điện thoại của mình làm điều khiển (remote) để tìm kiếm, thêm và quản lý danh sách phát.

## Luồng hoạt động chính

### 1. Kết nối TV và Điều khiển (Remote)

Quy trình kết nối giữa màn hình TV và các điều khiển từ xa được thực hiện thông qua mã QR và một phòng dữ liệu chung trên Firebase.

1.  **TV tạo phòng**:
    *   Khi người dùng truy cập vào trang TV (`/`), ứng dụng (`TvView.tsx`) sẽ kiểm tra `localStorage` để tìm `roomId` đã lưu.
    *   Nếu không có, một `roomId` ngẫu nhiên sẽ được tạo ra và lưu vào `localStorage`. Một phòng mới với `roomId` này sẽ được khởi tạo trên Firebase Realtime Database.
    *   Nếu có `roomId` đã lưu, ứng dụng sẽ kết nối tới phòng đó.

2.  **Hiển thị mã QR**:
    *   Màn hình TV sẽ hiển thị một mã QR. Giá trị của mã QR này là một URL trỏ tới trang điều khiển, ví dụ: `https://<địa-chỉ-web>/remote?roomId=<mã-phòng>`.
    *   **Lưu ý quan trọng**: Nếu màn hình TV được truy cập qua địa chỉ `localhost`, mã QR sẽ không hoạt động trên các thiết bị khác (điện thoại). Người dùng cần truy cập trang TV bằng địa chỉ IP mạng của máy tính (ví dụ: `http://192.168.1.100:5173`) để điện thoại có thể kết nối được. Một cảnh báo về vấn đề này đã được thêm vào giao diện TV.

3.  **Remote kết nối**:
    *   Người dùng dùng điện thoại quét mã QR.
    *   Trang điều khiển (`RemoteView.tsx`) được tải lên, đọc `roomId` từ tham số URL.
    *   `RemoteView` sử dụng `roomId` này để lắng nghe và gửi các thay đổi tới đúng phòng trên Firebase, đồng bộ hóa trạng thái với màn hình TV và các điều khiển khác.

### 2. Tìm kiếm và Thêm bài hát

Chức năng tìm kiếm cho phép người dùng tìm video karaoke trên YouTube và thêm vào danh sách phát của phòng.

1.  **Giao diện tìm kiếm**:
    *   Trên trang điều khiển (`RemoteView.tsx`), người dùng có một ô nhập liệu để gõ tên bài hát.
    *   Có một nút "Tìm" và chức năng tìm khi nhấn phím "Enter".
    *   Ngoài ra còn có nút tìm kiếm bằng giọng nói (Voice Search).

2.  **Logic tìm kiếm**:
    *   Để tiết kiệm API quota của YouTube, chức năng tìm kiếm **không tự động chạy** khi người dùng đang gõ.
    *   API chỉ được gọi khi người dùng chủ động bấm nút "Tìm" hoặc nhấn "Enter".
    *   Hàm `handleSearch` sẽ được thực thi, gửi yêu cầu tới YouTube Data API v3.
    *   Câu lệnh tìm kiếm được tối ưu bằng cách tự động thêm từ khóa "karaoke" và lọc theo `videoCategoryId=10` (Âm nhạc) để tăng độ chính xác.

3.  **Thêm bài hát**:
    *   Kết quả tìm kiếm được hiển thị dưới dạng danh sách.
    *   Mỗi bài hát có nút "Thêm" (`+`).
    *   Khi nhấn nút "Thêm", hàm `handleAddSong` được gọi. Bài hát sẽ được thêm vào cuối mảng `queue` trong Firebase, tuân theo cơ chế FIFO (First-In, First-Out).
    *   Nếu đây là bài hát đầu tiên được thêm vào danh sách trống, nó sẽ tự động được phát.

### 3. Quản lý danh sách phát

1.  **Thứ tự phát mặc định**:
    *   Các bài hát được phát tuần tự theo thứ tự chúng được thêm vào (FIFO).
    *   Khi một bài hát kết thúc, hàm `handleNext` trên TV (`TvView.tsx`) sẽ tự động được gọi. Hàm này xóa bài hát vừa phát khỏi `queue` và cập nhật `currentIndex` để phát bài tiếp theo trong danh sách.

2.  **Chức năng Ưu tiên (Play Next)**:
    *   Trên điều khiển, mỗi bài hát trong danh sách phát có một nút hình ngôi sao (⭐) để ưu tiên.
    *   Khi người dùng bấm vào nút ưu tiên của một bài hát, hàm `handleSetPriority` sẽ được thực thi.
    *   Logic này sẽ **sắp xếp lại** `queue` trên Firebase, đưa bài hát được chọn ưu tiên vào vị trí ngay sau bài hát đang phát (`currentIndex + 1`).
    *   Chỉ một bài hát có thể được đánh dấu ưu tiên tại một thời điểm để đảm bảo rõ ràng về bài hát "tiếp theo" là gì.
    *   **Lưu ý**: Hành động này không làm gián đoạn bài hát đang phát, chỉ thay đổi thứ tự của bài hát sẽ phát kế tiếp.

3.  **Xóa bài hát**:
    *   Mỗi bài hát trong danh sách phát trên điều khiển cũng có một nút hình thùng rác (🗑️).
    *   Nhấn nút này sẽ gọi hàm `handleRemoveSong`, xóa bài hát đó khỏi `queue` trên Firebase.
    *   Logic này cũng xử lý trường hợp bài hát đang phát hoặc bài hát đứng trước bài đang phát bị xóa để đảm bảo `currentIndex` luôn hợp lệ.

## Chế độ Nghe nhạc (Music Mode) - Tính năng mới

Từ phiên bản 1.1, T-Karaoke hỗ trợ thêm chế độ "Nghe nhạc" bên cạnh chế độ "Karaoke" truyền thống.

### 1. Chuyển đổi chế độ
*   Người dùng có thể chuyển đổi giữa hai chế độ: "🎤 Karaoke" và "🎧 Nghe nhạc" trên giao diện điều khiển (`RemoteView.tsx`)
*   Chế độ hiện tại được lưu trữ trong Firebase Realtime Database theo cấu trúc:
```json
"rooms": {
  "<roomId>": {
    ...
    "mode": "karaoke" // hoặc "music"
  }
}
```

### 2. Chế độ Karaoke
*   **Mục tiêu**: Phát các video karaoke (phiên bản không lời)
*   **Tìm kiếm**: Tự động thêm từ khóa "karaoke" vào truy vấn tìm kiếm
*   **Giao diện**: Tập trung vào trải nghiệm hát karaoke

### 3. Chế độ Nghe nhạc
*   **Mục tiêu**: Phát các video âm nhạc (phiên bản có lời)
*   **Tìm kiếm**: Không tự động thêm từ khóa "karaoke", tìm kiếm bài hát có lời
*   **Giao diện**: Tối ưu cho trải nghiệm nghe nhạc

## Cơ chế xác thực OAuth2 (Authentication System)

T-Karaoke sử dụng cơ chế xác thực OAuth2 với PKCE (Proof Key for Code Exchange) để bảo mật việc truy cập YouTube API.

### 1. Cấu trúc hệ thống xác thực
*   **Frontend**: Giao diện người dùng (T-Karaoke app)
*   **Auth Proxy Server**: Máy chủ trung gian xử lý trao đổi mã xác thực (auth-proxy-server)
*   **Google OAuth2**: Dịch vụ xác thực của Google

### 2. Luồng xác thực OAuth2 + PKCE

#### Giai đoạn 1: Khởi tạo yêu cầu xác thực
1.  Người dùng nhấn "Đăng nhập YouTube" trên frontend
2.  Frontend tạo `code_verifier` (chuỗi ngẫu nhiên 128 ký tự) và lưu vào `sessionStorage`
3.  Frontend tạo `code_challenge` bằng cách SHA256 hash `code_verifier` và mã hóa Base64URL
4.  Frontend xây dựng URL xác thực OAuth2 với các tham số:
    *   `client_id`: YouTube OAuth2 Client ID
    *   `redirect_uri`: `https://youtube.goldenfarm.vn/youtube-auth`
    *   `response_type`: `code`
    *   `scope`: `https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email`
    *   `code_challenge`: Mã challenge đã tạo
    *   `code_challenge_method`: `S256`
5.  Frontend chuyển hướng người dùng đến URL xác thực của Google

#### Giai đoạn 2: Xác thực với Google
6.  Người dùng đăng nhập vào tài khoản Google và cấp quyền
7.  Google chuyển hướng người dùng trở lại `https://youtube.goldenfarm.vn/youtube-auth` với `?code=<authorization_code>` trong URL

#### Giai đoạn 3: Trao đổi mã xác thực lấy token
8.  `YouTubeAuthCallback.tsx` nhận `authorization_code` từ URL
9.  Frontend gửi `authorization_code` và `code_verifier` đến Auth Proxy Server tại endpoint `https://youtube.goldenfarm.vn/api/youtube/callback`
10. Auth Proxy Server gửi yêu cầu đến Google OAuth2 token endpoint để đổi `authorization_code` lấy `access_token`
11. Auth Proxy Server sử dụng `access_token` để lấy thông tin người dùng từ Google userinfo endpoint
12. Auth Proxy Server trả về `access_token` và `user_info` cho frontend
13. Frontend lưu `access_token` vào `localStorage` và cập nhật trạng thái xác thực

### 3. Cấu hình xác thực

#### File cấu hình frontend (`.env`):
```env
VITE_YOUTUBE_API_KEY=your_youtube_api_key
VITE_YOUTUBE_CLIENT_ID=your_youtube_client_id
VITE_AUTH_PROXY_URL=https://youtube.goldenfarm.vn/api/youtube/callback
```

#### File cấu hình auth proxy server (`auth-proxy-server/.env`):
```env
YOUTUBE_CLIENT_ID=your_youtube_client_id
YOUTUBE_CLIENT_SECRET=your_youtube_client_secret
FRONTEND_URL=https://youtube.goldenfarm.vn
REDIRECT_URI=https://youtube.goldenfarm.vn/youtube-auth
PORT=3001
NODE_ENV=production
```

### 4. Cơ chế bảo mật
*   **PKCE**: Ngăn chặn tấn công "Authorization Code Interception" trên ứng dụng public client
*   **CORS**: Được cấu hình chặt chẽ chỉ cho phép các domain được tin cậy
*   **Token lưu trữ**: `access_token` được lưu trong `localStorage` của trình duyệt
*   **Token hết hạn**: Hệ thống kiểm tra thời gian hết hạn và tự động xóa token khi hết hạn

## Chi tiết kỹ thuật

### Cấu trúc dự án
*   `TvView.tsx`: Giao diện cho màn hình lớn, chịu trách nhiệm phát video và hiển thị mã QR.
*   `RemoteView.tsx`: Giao diện cho các thiết bị điều khiển, chứa logic tìm kiếm, thêm/xóa/ưu tiên bài hát và chuyển đổi chế độ.
*   `Playlist.tsx`: Component con để hiển thị danh sách bài hát, được sử dụng bởi cả `TvView` và `RemoteView`.
*   `YouTubePlayer.tsx`: Component để nhúng trình phát YouTube và quản lý các sự kiện của nó.
*   `firebase.ts`: Khởi tạo và cấu hình kết nối tới Firebase.
*   `useSearch.ts`: **(Quan trọng)** Hook tùy chỉnh chứa toàn bộ logic tìm kiếm và cache đã được tối ưu.
*   `useYouTubeAuth.ts`: Hook quản lý trạng thái xác thực YouTube với OAuth2 + PKCE.
*   `YouTubeAuthCallback.tsx`: Component xử lý callback từ Google OAuth2 và hoàn tất quá trình xác thực.
*   `auth-proxy-server/`: Thư mục chứa máy chủ xác thực OAuth2 trung gian.

### Cơ sở dữ liệu (Firebase)
Dự án sử dụng Firebase Realtime Database để đồng bộ trạng thái giữa TV và các điều khiển. Dữ liệu được lưu trữ theo cấu trúc:
```json
"rooms": {
  "<roomId>": {
    "queue": [
      { "id": "...", "title": "...", "thumbnail": "...", "isPriority": false },
      { "id": "...", "title": "...", "thumbnail": "...", "isPriority": true }
    ],
    "currentIndex": 0,
    "playing": true,
    "playRequestTimestamp": 167...,
    "mode": "karaoke" // hoặc "music"
  }
}
```
*   `queue`: Mảng các đối tượng bài hát.
*   `currentIndex`: Index của bài hát đang phát trong mảng `queue`.
*   `playing`: Trạng thái `true`/`false` của trình phát.
*   `playRequestTimestamp`: Timestamp để buộc trình phát YouTube đồng bộ lại khi có yêu cầu phát mới.
*   `mode`: Chế độ hiện tại của phòng ("karaoke" hoặc "music").

### Phân quyền
Hiện tại, dự án không có hệ thống phân quyền phức tạp. Bất kỳ ai có liên kết đến phòng điều khiển (`remoteUrl`) đều có toàn quyền thêm, xóa, và ưu tiên bài hát.

Trong file `TvView.tsx`, có một hàm `handleSetPriorityDevice` đã bị vô hiệu hóa, cho thấy ý tưởng về một "thiết bị ưu tiên" có thể đã được lên kế hoạch nhưng chưa được triển khai.

## Cài đặt và Chạy dự án

1.  **Cài đặt dependencies**:
    ```bash
    npm install
    ```

2.  **Cấu hình API Key và xác thực OAuth2**:
    *   Bạn cần có một API Key từ YouTube Data API v3.
    *   Tạo file `src/config.ts` từ `src/config.example.ts` (nếu có) hoặc tạo mới.
    *   Thêm API key của bạn vào file:
        ```typescript
        // src/config.ts
        export const YOUTUBE_API_KEY = 'YOUR_YOUTUBE_API_KEY_HERE';
        ```
    *   Cấu hình OAuth2 Client ID/Secret trong `.env` files (xem phần "Cơ chế xác thực OAuth2" ở trên)
    *   Tương tự, bạn cũng cần cấu hình `firebaseConfig` trong `src/firebase.ts` với thông tin Firebase project của bạn.

3.  **Chạy dự án**:
    ```bash
    # Chạy frontend
    npm run dev

    # Chạy auth proxy server (trong thư mục riêng)
    cd auth-proxy-server
    npm run dev
    ```

4.  **Triển khai sản phẩm**:
    *   Build frontend: `npm run build`
    *   Build auth proxy server: `cd auth-proxy-server && npm run build`
    *   Cấu hình reverse proxy (nginx) để chuyển tiếp `/api/*` đến auth proxy server
    *   Cập nhật cấu hình CORS và URL trong file `.env` cho môi trường sản phẩm

---

## Cơ Chế Tìm Kiếm Tối Ưu (useSearch.ts)

Để mang lại trải nghiệm người dùng tốt hơn và tiết kiệm tài nguyên, hook `useSearch` đã được tích hợp nhiều cơ chế tối ưu:

1.  **Kích hoạt tìm kiếm thủ công**:
    *   API tìm kiếm chỉ được gọi khi người dùng chủ động thực hiện hành động (nhấn "Enter", nút "Search", hoặc kết thúc tìm kiếm bằng giọng nói).
    *   Cơ chế này tránh gọi API liên tục mỗi khi người dùng gõ, giúp tiết kiệm đáng kể API quota.

2.  **Hủy yêu cầu tìm kiếm cũ (AbortController)**:
    *   Nếu người dùng bắt đầu một tìm kiếm mới trong khi một yêu cầu tìm kiếm khác đang chạy, yêu cầu cũ sẽ tự động được hủy.
    *   Điều này ngăn chặn tình trạng "race condition" (kết quả cũ trả về sau kết quả mới) và đảm bảo giao diện luôn hiển thị kết quả cho từ khóa mới nhất.

3.  **Cache kết quả tìm kiếm (LRU Cache)**:
    *   Ứng dụng sử dụng một bộ nhớ đệm trong bộ nhớ (in-memory) theo cơ chế LRU (Least Recently Used) để lưu kết quả của **5** từ khóa tìm kiếm cuối cùng.
    *   Nếu người dùng tìm lại một từ khóa gần đây, kết quả sẽ được tải ngay lập tức từ cache mà không cần gọi API.
    *   Khi cache đầy, từ khóa cũ nhất sẽ bị xóa để nhường chỗ cho từ khóa mới.

4.  **Cache bền vững cho mục "Thịnh hành"**:
    *   Danh sách các bài hát thịnh hành được lưu vào `localStorage` của trình duyệt với thời gian sống là 30 phút.
    *   Điều này giúp giảm các lệnh gọi API không cần thiết khi người dùng tải lại trang, mang lại trải nghiệm nhanh hơn.

5.  **Theo dõi và Đặt lại API Quota hàng ngày**:
    *   Lượng API đã sử dụng được theo dõi và lưu vào `localStorage`.
    *   Ứng dụng sẽ tự động đặt lại bộ đếm này về 0 mỗi ngày mới, giúp việc theo dõi quota trong ngày chính xác hơn.
    *   Một cảnh báo sẽ được hiển thị nếu quota sắp hết.

## Các Chức Năng Có Thể Phát Triển (Còn Thiếu)

Dưới đây là một số ý tưởng và chức năng có thể được phát triển trong tương lai để hoàn thiện ứng dụng:

*   **Hệ thống người dùng và phân quyền**:
    *   Triển khai vai trò "Host" (chủ phòng) và "Guest" (khách).
    *   Host có các quyền đặc biệt như: xóa bài hát của người khác, tạm dừng/phát nhạc, đóng phòng.

*   **Quản lý danh sách phát nâng cao**:
    *   Cho phép người dùng kéo-thả để sắp xếp lại thứ tự bài hát trong danh sách.
    *   Lưu lại danh sách phát để có thể sử dụng lại sau này.
    *   Tạo nhiều danh sách phát khác nhau trong cùng một phòng.

*   **Cải tiến Giao diện và Trải nghiệm người dùng (UI/UX)**:
    *   Thêm các chủ đề (themes) giao diện khác nhau (sáng/tối đã có, có thể mở rộng).
    *   Thêm hiệu ứng chuyển động (animations) để giao diện mượt mà hơn.
    *   Tối ưu hóa hiển thị trên nhiều kích thước màn hình khác nhau.

*   **Tính năng cho Host/Admin**:
    *   Chức năng "cấm" (veto) một bài hát đang phát.
    *   Khả năng "kick" một người dùng ra khỏi phòng.
    *   Bảng điều khiển (dashboard) cho Host để xem thống kê phòng.

*   **Xử lý lỗi và Thông báo**:
    *   Hiển thị thông báo lỗi thân thiện hơn cho người dùng khi có sự cố (mất kết nối, API lỗi, xác thực thất bại, v.v.).

*   **Cải tiến hệ thống xác thực**:
    *   Hỗ trợ refresh token để tự động làm mới access token khi hết hạn.
    *   Cơ chế đăng xuất toàn cục.
    *   Quản lý nhiều tài khoản YouTube.