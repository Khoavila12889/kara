import React from 'react';
import { Button } from 'antd';
import { ExtendedSong } from './types';

interface PlaylistProps {
  songs: ExtendedSong[];
  currentSong?: ExtendedSong;
  onSelectSong?: (song: ExtendedSong) => void;
  onRemoveSong?: (songId: string) => void;
  onSetPriority?: (song: ExtendedSong) => void;
}

const Playlist: React.FC<PlaylistProps> = ({
  songs,
  currentSong,
  onSelectSong,
  onRemoveSong,
  onSetPriority,
}) => {
  const isCurrent = (song: ExtendedSong) => song.id === currentSong?.id;

  // Icons from the original component
  const StarIcon = ({ isActive = false }: { isActive?: boolean }) => (
    <svg
      className={`w-4 h-4 transition-colors ${isActive ? 'text-yellow-400' : 'text-white'}`}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );

  const TrashIcon = () => (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
    </svg>
  );

  if (songs.length === 0) {
    return (
      <div className="py-8 text-center text-gray-400 text-sm">
        Danh sách phát đang trống.<br />
        Thêm bài hát từ ô tìm kiếm nhé!
      </div>
    );
  }

  return (
    <div
      className="space-y-1"
      style={{ height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
    >
      {songs.map((song) => {
        const isPlaying = isCurrent(song);
        return (
          <div
            key={song.id}
            className={`playlist-item cursor-pointer ${isPlaying ? 'bg-[rgba(59,130,246,0.2)]' : ''}`}
            onClick={() => onSelectSong?.(song)}
          >
            <img
              src={song.thumbnail}
              className="playlist-thumb"
              alt={song.title}
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/64x48';
              }}
            />

            <div className="flex-1 min-w-0">
              <p className={`playlist-title ${song.isPriority ? 'text-yellow-300' : 'text-white'}`}>
                {song.title}
              </p>
              <p className="text-xs text-gray-400">YouTube</p>
            </div>

            <div className="playlist-actions">
              {onSetPriority && (
                <Button
                  type="text"
                  icon={<StarIcon isActive={song.isPriority} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetPriority(song);
                  }}
                  title={song.isPriority ? 'Bỏ ưu tiên' : 'Ưu tiên'}
                  className="icon-only"
                  style={{ color: song.isPriority ? '#fbbf24' : 'white' }}
                />
              )}

              {onRemoveSong && (
                <Button
                  type="text"
                  icon={<TrashIcon />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveSong(song.id);
                  }}
                  title="Xóa khỏi danh sách"
                  aria-label="Xóa bài hát"
                  className="icon-only"
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