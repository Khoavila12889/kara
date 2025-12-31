import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ref, onValue, runTransaction, set } from 'firebase/database';
import { database } from './firebase';
import Playlist from './Playlist';
import { Song } from './types';
import { logger } from './logger';
import { YOUTUBE_API_KEY } from './config';

interface RoomData {
  queue: Song[];
  currentIndex: number;
  playing: boolean;
}

const RemoteView = () => {
  const [searchParams] = useSearchParams();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('trending'); // trending, search, or playlist
  const [showRoomId, setShowRoomId] = useState(false);

  // State for Search
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  // State for Trending
  const [trendingSongs, setTrendingSongs] = useState<Song[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);

  useEffect(() => {
    // Connect to Firebase Room
    const urlRoomId = searchParams.get('roomId');
    if (!urlRoomId) {
      setError('Không có mã phòng trong URL. Vui lòng quét mã QR từ màn hình TV.');
      setLoading(false);
      return;
    }
    setRoomId(urlRoomId);
    const roomRef = ref(database, 'rooms/' + urlRoomId);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        setRoomData(snapshot.val());
      } else {
        setError(`Phòng '${urlRoomId}' không tồn tại. TV có thể đã mất kết nối.`);
      }
      setLoading(false);
    }, (err) => {
      logger.error('Error listening to room changes:', err);
      setError('Không thể kết nối tới phòng. Vui lòng kiểm tra kết nối mạng.');
      setLoading(false);
    });
    
    // Fetch Trending Songs
    const fetchTrending = async () => {
      if (YOUTUBE_API_KEY === 'YOUR_YOUTUBE_API_KEY_HERE') {
        // Silently fail, don't show error for this
        setTrendingLoading(false);
        return;
      }
      try {
        const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&regionCode=VN&videoCategoryId=10&maxResults=15&key=${YOUTUBE_API_KEY}`);
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        const items = data.items.map((item: any) => ({
          id: item.id,
          title: item.snippet.title,
          thumbnail: item.snippet.thumbnails.default.url,
        }));
        setTrendingSongs(items);
      } catch (err) {
        logger.error("Could not fetch trending songs:", err);
      } finally {
        setTrendingLoading(false);
      }
    };
    
    fetchTrending();

    return () => unsubscribe();
  }, [searchParams]);

  // Player controls
  const handleTogglePlay = () => {
    if (!roomId) return;
    set(ref(database, `rooms/${roomId}/playing`), !roomData?.playing);
  };
  const handleNext = () => {
    if (!roomId) return;
    const roomRef = ref(database, 'rooms/' + roomId);
    runTransaction(roomRef, (currentData) => {
      if (!currentData) return null;
      const queue = currentData.queue || [];
      const newIndex = currentData.currentIndex + 1;
      return { ...currentData, currentIndex: newIndex >= queue.length ? -1 : newIndex, playing: newIndex < queue.length };
    });
  };

  // Song management
  const handleAddSong = async (song: Song) => {
    if (!roomId) return;
    const roomRef = ref(database, 'rooms/' + roomId);
    try {
      await runTransaction(roomRef, (currentData) => {
        if (!currentData) return null;
        const queue = currentData.queue || [];
        if (queue.some(s => s.id === song.id)) return;
        const newQueue = [...queue, song];
        return { ...currentData, queue: newQueue, currentIndex: currentData.currentIndex === -1 ? 0 : currentData.currentIndex, playing: currentData.currentIndex === -1 ? true : currentData.playing };
      });
      alert(`Đã thêm "${song.title}"`);
      setActiveTab('playlist');
    } catch (err) {
      alert('Thêm bài hát thất bại.');
    }
  };
  const handleSelectSong = (song: Song) => {
    if (!roomId || !roomData?.queue) return;

    if (window.confirm(`Bạn có chắc muốn phát bài "${song.title}" ngay bây giờ không?`)) {
      const newIndex = roomData.queue.findIndex(s => s.id === song.id);
      if (newIndex !== -1) {
        const roomRef = ref(database, 'rooms/' + roomId);
        runTransaction(roomRef, (currentData) => {
          if (currentData) {
            return { ...currentData, currentIndex: newIndex, playing: true };
          }
          return currentData;
        });
      }
    }
  };
  
  // Search logic
  const handleSearch = async () => {
    if (YOUTUBE_API_KEY === 'YOUR_YOUTUBE_API_KEY_HERE') {
      setSearchError('Vui lòng thêm YouTube API key vào file src/config.ts để tìm kiếm.');
      return;
    }
    setSearchError(null);
    setSearchLoading(true);
    setResults([]);
    setActiveTab('search'); // Switch to search tab on search
    try {
      const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query} karaoke&type=video&key=${YOUTUBE_API_KEY}&maxResults=10`);
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      const items = data.items.map((item: any) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.default.url,
      }));
      setResults(items);
    } catch (err: any) {
      setSearchError(err.message);
    } finally {
      setSearchLoading(false);
    }
  };

  const currentSong = roomData?.queue?.[roomData.currentIndex];
  const PlayIcon = () => <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>;
  const PauseIcon = () => <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>;
  const NextIcon = () => <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>;
  const SignalIcon = () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17H8v-5h3v5zm2-12h-2V7h2v2zm2 5h-3v-2h3v2z"/></svg>;
  
  if (loading) return <div className="bg-gray-900 text-white min-h-screen flex items-center justify-center"><h1 className="text-3xl font-bold">Đang kết nối phòng...</h1></div>;
  if (error) return <div className="bg-gray-900 text-white min-h-screen flex items-center justify-center"><div className="bg-gray-800 p-8 rounded-lg"><h1 className="text-3xl font-bold mb-4 text-center">Lỗi kết nối</h1><p className="text-center">{error}</p></div></div>;

  const tabButtonClasses = "flex-1 py-2 px-4 text-center font-semibold rounded-t-lg transition-colors focus:outline-none";
  const activeTabClasses = "bg-gray-800 text-white";
  const inactiveTabClasses = "bg-gray-700 text-gray-400 hover:bg-gray-600";
  
  const SongList = ({ songs }: { songs: Song[] }) => (
    <ul className="space-y-2">
      {songs.map((song) => (
        <li key={song.id} className="flex items-center gap-4 p-2 rounded-md hover:bg-gray-700">
          <img src={song.thumbnail} alt={song.title} className="w-24 h-16 object-cover rounded" />
          <div className="flex-grow"><p className="font-semibold">{song.title}</p></div>
          <div className="flex flex-col gap-2">
            <button onClick={() => handleAddSong(song)} className="bg-green-600 text-white font-bold py-1 px-3 rounded text-sm">+ Thêm</button>
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="bg-gray-900 text-white min-h-screen">
      <header className="p-4 flex justify-between items-center">
        <h1 className="text-3xl font-bold">Điều khiển Karaoke</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowRoomId(!showRoomId)} className={`w-8 h-8 rounded-full flex items-center justify-center ${roomId && !error ? 'bg-green-500' : 'bg-gray-500'} text-white`}><SignalIcon /></button>
          {showRoomId && <span className="text-blue-400 font-bold">{roomId}</span>}
        </div>
      </header>
      
      <div className="sticky top-0 z-10 p-4 bg-gray-800 rounded-b-lg shadow-lg">
        <div className="text-center mb-4">
          <p className="text-sm text-gray-400">Đang phát</p>
          <h3 className="font-bold text-lg truncate h-6">{currentSong?.title || 'Chưa có bài hát nào'}</h3>
        </div>
        <div className="flex justify-center items-start gap-8 mb-4">
          <div className="flex flex-col items-center gap-2"><button onClick={handleTogglePlay} className="bg-blue-600 w-16 h-16 rounded-full flex items-center justify-center">{roomData?.playing ? <PauseIcon /> : <PlayIcon />}</button><span className="text-xs font-semibold">{roomData?.playing ? 'Tạm dừng' : 'Phát'}</span></div>
          <div className="flex flex-col items-center gap-2"><button onClick={handleNext} className="bg-gray-700 w-16 h-16 rounded-full flex items-center justify-center"><NextIcon /></button><span className="text-xs font-semibold">Bài kế</span></div>
        </div>
        <div className="flex gap-2">
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nhập tên bài hát..." className="flex-grow p-2 rounded bg-gray-700 border-gray-600" onKeyUp={(e) => e.key === 'Enter' && handleSearch()} />
          <button onClick={handleSearch} className="bg-blue-600 font-bold py-2 px-4 rounded">Tìm</button>
        </div>
      </div>

      <div className="p-4">
        <div className="flex">
          <button onClick={() => setActiveTab('trending')} className={`${tabButtonClasses} ${activeTab === 'trending' ? activeTabClasses : inactiveTabClasses}`}>Thịnh hành</button>
          <button onClick={() => setActiveTab('search')} className={`${tabButtonClasses} ${activeTab === 'search' ? activeTabClasses : inactiveTabClasses}`}>Kết quả</button>
          <button onClick={() => setActiveTab('playlist')} className={`${tabButtonClasses} ${activeTab === 'playlist' ? activeTabClasses : inactiveTabClasses}`}>Danh sách phát ({roomData?.queue?.length || 0})</button>
        </div>
        <div className="bg-gray-800 p-4 rounded-b-lg">
          {activeTab === 'trending' && (
            <div>
              {trendingLoading && <p>Đang tải danh sách thịnh hành...</p>}
              <SongList songs={trendingSongs} />
            </div>
          )}
          {activeTab === 'search' && (
            <div>
              {searchError && <div className="bg-red-500 p-3 rounded-md my-4">{searchError}</div>}
              {searchLoading && <p>Đang tìm kiếm...</p>}
              <SongList songs={results} />
            </div>
          )}
          {activeTab === 'playlist' && (
            roomData && <Playlist songs={roomData.queue || []} currentSong={currentSong} onSelectSong={handleSelectSong} />
          )}
        </div>
      </div>
    </div>
  );
};

export default RemoteView;
