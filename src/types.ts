export interface Song {
  id: string;
  title: string;
  thumbnail: string;
}

export interface ExtendedSong extends Song {
  addedBy?: string; // ID của thiết bị đã thêm bài hát
  addedAt?: number; // Thời gian thêm bài hát
  isPriority?: boolean; // Đánh dấu bài hát có ưu tiên hay không
}
