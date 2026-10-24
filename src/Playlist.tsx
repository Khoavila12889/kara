import React, { useEffect, useRef } from 'react';
import { Button, Empty } from 'antd';
import { StarFilled, DeleteOutlined } from '@ant-design/icons';
import { ExtendedSong } from './types';

interface PlaylistProps {
  songs: ExtendedSong[];
  currentSong?: ExtendedSong;
  onSelectSong?: (song: ExtendedSong) => void;
  onRemoveSong?: (songId: string) => void;
  onSetPriority?: (song: ExtendedSong) => void;
  variant?: 'tv' | 'remote';
  mode?: 'karaoke' | 'music';
}

const Playlist: React.FC<PlaylistProps> = ({
  songs,
  currentSong,
  onSelectSong,
  onRemoveSong,
  onSetPriority,
  mode,
  variant = 'remote',
}) => {
  const currentSongRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const row = currentSongRef.current;
      const scroller = row?.closest('.ant-tabs-content-holder, .tv-queue-scroll') as HTMLElement | null;
      if (!row || !scroller) return;
      const item = row.getBoundingClientRect(), bounds = scroller.getBoundingClientRect();
      if (item.top < bounds.top || item.bottom > bounds.bottom) {
        scroller.scrollTo({top:scroller.scrollTop+item.top-bounds.top-(bounds.height-item.height)/2,
          behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
      }
    },100);
    return () => window.clearTimeout(timer);
  }, [currentSong?.id]);

  if (songs.length === 0) {
    return (
      <div className="room-empty"><span className="room-empty-icon" aria-hidden="true">♫</span><h3>Danh sách đang trống</h3><p>{variant === 'tv' ? 'Quét mã QR bằng điện thoại để chọn bài hát.' : 'Tìm bài hát yêu thích và thêm vào cuộc vui.'}</p></div>
    );
  }

  return (
    <div className="room-song-list">
      {songs.map((song) => {
        const isPlaying = song.id === currentSong?.id;
        return (
          <div
            key={song.id}
            ref={isPlaying ? currentSongRef : null}
            className={`room-song group ${isPlaying ? 'room-song-current' : ''}`}
            onClick={() => onSelectSong?.(song)}
          >
            <img
              src={song.thumbnail}
              className="w-16 h-12 object-cover rounded-md flex-shrink-0 ml-[0.5px] mt-[0.5px]"
              alt={song.title}
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.visibility = 'hidden';
              }}
            />

            <div className="flex-1 min-w-0">
              <p className={`font-semibold break-words ${song.isPriority ? 'text-yellow-600' : 'text-gray-800'}`}>
                {song.title}
              </p>
              <p className="text-xs text-gray-400 truncate">{song.channelTitle || 'YouTube'}</p>
            </div>

            <div className="room-song-actions">
              {onSetPriority && (
                <Button
                  type="text"
                  icon={<StarFilled />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetPriority(song);
                  }}
                  title={song.isPriority ? 'Remove priority' : 'Prioritize'}
                  aria-label={song.isPriority ? 'Remove priority' : 'Prioritize'}
                  className={`icon-only ${song.isPriority ? 'text-yellow-400' : 'text-gray-400 hover:text-white'}`}
                  style={{ color: song.isPriority ? '#9710F6' : '#9710F680' }}
                />
              )}

              {onRemoveSong && (
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveSong(song.id);
                  }}
                  title="Remove from playlist"
                  aria-label="Remove from playlist"
                  className="icon-only text-gray-400 hover:text-red-500"
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Playlist;