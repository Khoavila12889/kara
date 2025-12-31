import React, { useState } from 'react';
import { YOUTUBE_API_KEY } from './config';
import { Song } from './types';

interface SearchProps {
  onAddSong: (song: Song) => void;
  onAddPriority: (song: Song) => void;
}

const Search: React.FC<SearchProps> = ({ onAddSong, onAddPriority }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (YOUTUBE_API_KEY === 'YOUR_YOUTUBE_API_KEY_HERE') {
      setError('Please add your YouTube API key to src/config.ts to enable search.');
      return;
    }
    setError(null);
    setLoading(true);
    setResults([]);

    try {
      const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query} karaoke&type=video&key=${YOUTUBE_API_KEY}&maxResults=10`);
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      const items = data.items.map((item: any) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.default.url,
      }));
      setResults(items);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Search for a Song</h2>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter song name..."
          className="flex-grow p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyUp={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button
          onClick={handleSearch}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Search
        </button>
      </div>

      {error && <div className="bg-red-500 text-white p-3 rounded-md my-4">{error}</div>}
      
      {loading && <p>Searching...</p>}

      <ul className="space-y-2">
        {results.map((song) => (
          <li key={song.id} className="flex items-center gap-4 p-2 rounded-md hover:bg-gray-700">
            <img src={song.thumbnail} alt={song.title} className="w-24 h-16 object-cover rounded" />
            <div className="flex-grow">
              <p className="font-semibold">{song.title}</p>
            </div>
            <div className="flex flex-col gap-2">
               <button
                onClick={() => onAddSong(song)}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded text-sm"
              >
                + Add
              </button>
              <button
                onClick={() => onAddPriority(song)}
                className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-1 px-3 rounded text-sm"
              >
                Priority
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Search;
