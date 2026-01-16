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
  mode?: 'karaoke' | 'music';
}

const Playlist: React.FC<PlaylistProps> = ({
  songs,
  currentSong,
  onSelectSong,
  onRemoveSong,
  onSetPriority,
  mode,
}) => {
  const currentSongRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to the current song when it changes
    if (currentSongRef.current) {
      // Using a setTimeout to ensure DOM is updated before scrolling
      setTimeout(() => {
        currentSongRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 100);
    }
  }, [currentSong]);

  if (songs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Empty
          description={
            <span className="text-gray-400">
              Danh sách phát trống.
              <br />
              Thêm bài hát từ tab tìm kiếm!
            </span>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-2 p-1 h-full overflow-y-auto">
      {songs.map((song) => {
        const isPlaying = song.id === currentSong?.id;
        return (
          <div
            key={song.id}
            ref={isPlaying ? currentSongRef : null}
            className={`group flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-all duration-200
              ${isPlaying ? 'bg-blue-500/30' : 'bg-white hover:bg-gray-100'}`}
            onClick={() => onSelectSong?.(song)}
          >
            <img
              src={song.thumbnail}
              className="w-16 h-12 object-cover rounded-md flex-shrink-0 ml-[0.5px] mt-[0.5px]"
              alt={song.title}
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/64x48';
              }}
            />

            <div className="flex-1 min-w-0">
              <p className={`font-semibold break-words ${song.isPriority ? 'text-yellow-600' : 'text-gray-800'}`}>
                {song.title}
              </p>
              <p className="text-xs text-gray-400 truncate">{song.channelTitle || 'YouTube'}</p>
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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