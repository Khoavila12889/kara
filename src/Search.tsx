import React from 'react';
import { useSearch } from './useSearch';
import { Song } from './types';

interface SearchProps {
  onAddSong: (song: Song) => void;
  onAddPriority: (song: Song) => void;
}

const Search: React.FC<SearchProps> = ({ onAddSong, onAddPriority }) => {
  const { 
    query, 
    setQuery, 
    results, 
    loading, 
    error, 
    nextPageToken, 
    search,
    lastKeyword,
  } = useSearch();

  const handleSearch = () => {
    if (loading) return;
    if (query.trim().length < 3) return;

    // If the current query is the same as the last searched keyword, do nothing
    if (query.trim().toLowerCase() === lastKeyword.toLowerCase()) {
        return;
    }

    search(query);
  };

  const handleLoadMore = () => {
    if (loading || !nextPageToken) return;
    search(lastKeyword, nextPageToken);
  };

  const handleClear = () => {
    setQuery('');
    // The hook will clear the results automatically when the query changes
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">🎤 Karaoke Search</h2>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearch();
          }}
          placeholder="Nhập đầy đủ tên bài hát rồi nhấn Enter"
          className="flex-grow p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 rounded"
        >
          🔍 Search
        </button>
        <button
          onClick={handleClear}
          className="bg-gray-600 hover:bg-gray-700 text-white px-4 rounded"
        >
          Clear
        </button>
      </div>

      {error && (
        <div className="bg-red-500 text-white p-3 rounded-md my-4">
          {error}
        </div>
      )}

      {loading && <p>Searching...</p>}

      <ul className="space-y-2">
        {results.map((song) => (
          <li
            key={song.id}
            className="flex items-center gap-4 p-2 rounded-md hover:bg-gray-700"
          >
            <img
              src={song.thumbnail}
              alt={song.title}
              className="w-24 h-16 object-cover rounded"
            />
            <div className="flex-grow">
              <p className="font-semibold">{song.title}</p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => onAddSong(song)}
                className="bg-green-600 hover:bg-green-700 text-white py-1 px-3 rounded text-sm"
              >
                + Add
              </button>
              <button
                onClick={() => onAddPriority(song)}
                className="bg-yellow-500 hover:bg-yellow-600 text-white py-1 px-3 rounded text-sm"
              >
                ⭐ Priority
              </button>
            </div>
          </li>
        ))}
      </ul>

      {nextPageToken && !loading && (
        <button
          onClick={handleLoadMore}
          className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded mt-4"
        >
          Load More
        </button>
      )}
    </div>
  );
};

export default Search;