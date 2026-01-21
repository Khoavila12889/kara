export interface RoomData {
  queue: ExtendedSong[];
  currentIndex: number;
  playing: boolean;
  mode?: RoomMode;
  musicSource?: {
    type: 'playlist' | 'channel';
    id: string;
  };
  currentPlaylistId?: string;
  youtubeAuth?: YouTubeAuthData;
}

export interface YouTubeAuthData {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  user_info: {
    id: string;
    name: string;
    email: string;
    picture?: string;
  };
}

export interface BackgroundOption {
  label: string;
  value: string;
  theme: 'dark' | 'light';
}

export interface YouTubePlaylist {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  itemCount: number;
}

export interface Song {
  id: string;
  title: string;
  channelTitle?: string;
  thumbnail?: string;
  duration?: string;
}

export interface ExtendedSong extends Song {
  isPriority?: boolean;
  type?: 'youtube' | 'other';
}

export type RoomMode = 'karaoke' | 'music';