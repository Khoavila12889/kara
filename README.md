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

## Chi tiết kỹ thuật

### Cấu trúc dự án
*   `TvView.tsx`: Giao diện cho màn hình lớn, chịu trách nhiệm phát video và hiển thị mã QR.
*   `RemoteView.tsx`: Giao diện cho các thiết bị điều khiển, chứa logic tìm kiếm, thêm/xóa/ưu tiên bài hát.
*   `Playlist.tsx`: Component con để hiển thị danh sách bài hát, được sử dụng bởi cả `TvView` và `RemoteView`.
*   `YouTubePlayer.tsx`: Component để nhúng trình phát YouTube và quản lý các sự kiện của nó.
*   `firebase.ts`: Khởi tạo và cấu hình kết nối tới Firebase.
*   `useSearch.ts`: **(Quan trọng)** Hook tùy chỉnh chứa toàn bộ logic tìm kiếm và cache đã được tối ưu.

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
    "playRequestTimestamp": 167...
  }
}
```
*   `queue`: Mảng các đối tượng bài hát.
*   `currentIndex`: Index của bài hát đang phát trong mảng `queue`.
*   `playing`: Trạng thái `true`/`false` của trình phát.
*   `playRequestTimestamp`: Timestamp để buộc trình phát YouTube đồng bộ lại khi có yêu cầu phát mới.

### Phân quyền
Hiện tại, dự án không có hệ thống phân quyền phức tạp. Bất kỳ ai có liên kết đến phòng điều khiển (`remoteUrl`) đều có toàn quyền thêm, xóa, và ưu tiên bài hát.

Trong file `TvView.tsx`, có một hàm `handleSetPriorityDevice` đã bị vô hiệu hóa, cho thấy ý tưởng về một "thiết bị ưu tiên" có thể đã được lên kế hoạch nhưng chưa được triển khai.

## Cài đặt và Chạy dự án

1.  **Cài đặt dependencies**:
    ```bash
    npm install
    ```

2.  **Cấu hình API Key**:
    *   Bạn cần có một API Key từ YouTube Data API v3.
    *   Tạo file `src/config.ts` từ `src/config.example.ts` (nếu có) hoặc tạo mới.
    *   Thêm API key của bạn vào file:
        ```typescript
        // src/config.ts
        export const YOUTUBE_API_KEY = 'YOUR_YOUTUBE_API_KEY_HERE';
        ```
    *   Tương tự, bạn cũng cần cấu hình `firebaseConfig` trong `src/firebase.ts` với thông tin Firebase project của bạn.

3.  **Chạy dự án**:
    ```bash
    npm run dev
    ```
    Ứng dụng sẽ chạy, và bạn có thể truy cập vào các địa chỉ được cung cấp trên terminal. Để sử dụng tính năng QR, hãy truy cập bằng địa chỉ IP mạng.

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
    *   Hiển thị thông báo lỗi thân thiện hơn cho người dùng khi có sự cố (mất kết nối, API lỗi, v.v.).