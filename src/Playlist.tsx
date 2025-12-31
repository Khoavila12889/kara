import React from 'react';
import { Song } from './types';

interface PlaylistProps {
  songs: Song[];
  currentSong: Song | undefined;
  onSelectSong?: (song: Song) => void;
}

const Playlist: React.FC<PlaylistProps> = ({ songs, currentSong, onSelectSong }) => {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4 border-b border-gray-700 pb-2">Danh sách phát</h2>
      {songs.length === 0 ? (
        <p className="text-gray-400">Danh sách phát đang trống. Thêm bài hát từ ô tìm kiếm.</p>
      ) : (
        <ul className="space-y-2 max-h-[40rem] overflow-y-auto pr-2">
          {songs.map((song) => (
            <li
              key={song.id}
              onClick={() => onSelectSong && onSelectSong(song)}
              className={`flex items-center gap-4 p-2 rounded-md transition-colors ${
                song.id === currentSong?.id ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
              } ${onSelectSong ? 'cursor-pointer' : ''}`}
            >
              <img src={song.thumbnail} alt={song.title} className="w-16 h-12 object-cover rounded" />
              <div className="flex-grow">
                <p className={`font-semibold ${song.id === currentSong?.id ? 'text-white' : 'text-gray-200'}`}>
                  {song.title}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Playlist;
