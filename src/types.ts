export type RoomMode = 'karaoke' | 'music';

export interface Song {
  id: string;
  title: string;
  thumbnail: string;
}

export interface ExtendedSong extends Song {
  addedBy?: string; // ID của thiết bị đã thêm bài hát
  addedAt?: number; // Thời gian thêm bài hát
  isPriority?: boolean; // Đánh dấu bài hát có ưu tiên hay không
  duration?: string; // ISO 8601 duration (e.g., "PT4M33S")
  viewCount?: string; // Total view count
  type?: 'youtube' | 'local';
  channelTitle?: string;
}

export interface YouTubePlaylist {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  itemCount: number;
}
