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
  const [activeTab, setActiveTab] = useState('trending');
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

    // Thiết lập thời gian chờ kết nối
    const connectionTimeout = setTimeout(() => {
      if (loading && !roomData) {
        setError('Kết nối tới phòng quá lâu. Vui lòng kiểm tra kết nối mạng và thử lại.');
        setLoading(false);
      }
    }, 10000); // 10 giây timeout

    const roomRef = ref(database, 'rooms/' + urlRoomId);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      clearTimeout(connectionTimeout); // Hủy timeout khi kết nối thành công

      if (snapshot.exists()) {
        setRoomData(snapshot.val());
      } else {
        setError(`Phòng '${urlRoomId}' không tồn tại. TV có thể đã mất kết nối.`);
      }
      setLoading(false);
    }, (err) => {
      clearTimeout(connectionTimeout); // Hủy timeout khi có lỗi

      logger.error('Error listening to room changes:', err);
      setError('Không thể kết nối tới phòng. Vui lòng kiểm tra kết nối mạng.');
      setLoading(false);
    });

    // Fetch Trending Songs
    const fetchTrending = async () => {
      if (YOUTUBE_API_KEY === 'YOUR_YOUTUBE_API_KEY_HERE') {
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
          thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default.url,
        }));
        setTrendingSongs(items);
      } catch (err) {
        logger.error("Could not fetch trending songs:", err);
      } finally {
        setTrendingLoading(false);
      }
    };

    fetchTrending();

    return () => {
      clearTimeout(connectionTimeout);
      unsubscribe();
    };
  }, [searchParams]);

  // Player controls
  const handleTogglePlay = () => {
    if (!roomId) return;
    // Đảm bảo nút phát hoạt động chính xác
    set(ref(database, `rooms/${roomId}/playing`), !roomData?.playing);
  };

  const handleNext = () => {
    if (!roomId) return;
    const roomRef = ref(database, 'rooms/' + roomId);
    runTransaction(roomRef, (currentData) => {
      if (!currentData) return null;
      const queue = currentData.queue || [];
      const newIndex = currentData.currentIndex + 1;
      return { 
        ...currentData, 
        currentIndex: newIndex >= queue.length ? -1 : newIndex, 
        playing: newIndex < queue.length 
      };
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
        return { 
          ...currentData, 
          queue: newQueue, 
          currentIndex: currentData.currentIndex === -1 ? 0 : currentData.currentIndex, 
          playing: currentData.currentIndex === -1 ? true : currentData.playing 
        };
      });
      setActiveTab('playlist');
    } catch (err) {
      alert('Thêm bài hát thất bại.');
    }
  };

  const handleSelectSong = (song: Song) => {
    if (!roomId || !roomData?.queue) return;

    // Hiển thị thông báo xác nhận
    const confirmPlay = window.confirm(`Bạn có chắc muốn phát bài "${song.title}" ngay bây giờ không?`);

    if (confirmPlay) {
      const newIndex = roomData.queue.findIndex(s => s.id === song.id);
      if (newIndex !== -1) {
        const roomRef = ref(database, 'rooms/' + roomId);
        runTransaction(roomRef, (currentData) => {
          if (currentData) {
            // Cập nhật chỉ số hiện tại và đảm bảo đang phát
            return {
              ...currentData,
              currentIndex: newIndex,
              playing: true // Đảm bảo bài hát sẽ phát ngay sau khi chọn
            };
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
    if (!query.trim()) return;
    
    setSearchError(null);
    setSearchLoading(true);
    setResults([]);
    setActiveTab('search');
    
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)} karaoke&type=video&key=${YOUTUBE_API_KEY}&maxResults=12`
      );
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      const items = data.items.map((item: any) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default.url,
      }));
      setResults(items);
    } catch (err: any) {
      setSearchError(err.message);
    } finally {
      setSearchLoading(false);
    }
  };

  // Icons
  const PlayIcon = () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );

  const PauseIcon = () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );

  const NextIcon = () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
    </svg>
  );

  const SignalIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17H8v-5h3v5zm2-12h-2V7h2v2zm2 5h-3v-2h3v2z"/>
    </svg>
  );

  const SearchIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );

  const AddIcon = () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
    </svg>
  );

  const currentSong = roomData?.queue?.[roomData.currentIndex];

  const LoadingScreen = () => (
    <div className="bg-gradient-to-br from-gray-900 to-black min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <h1 className="text-2xl font-bold text-white">Đang kết nối phòng...</h1>
        <p className="text-gray-400 mt-2">Vui lòng chờ trong giây lát</p>
      </div>
    </div>
  );

  const ErrorScreen = () => (
    <div className="bg-gradient-to-br from-gray-900 to-black min-h-screen flex items-center justify-center p-4">
      <div className="bg-gray-800/50 backdrop-blur-lg p-8 rounded-2xl border border-gray-700 max-w-md w-full">
        <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white text-center mb-3">Lỗi kết nối</h1>
        <p className="text-gray-300 text-center">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
        >
          Thử lại
        </button>
      </div>
    </div>
  );

  const TabButton = ({ id, label, count, isActive }: { id: string; label: string; count?: number; isActive: boolean }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex-1 py-3 px-4 text-center font-semibold transition-all duration-300 ${
        isActive 
          ? 'bg-gray-800 text-white border-b-2 border-blue-500' 
          : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
      }`}
    >
      {label}
      {count !== undefined && (
        <span className="ml-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
          {count}
        </span>
      )}
    </button>
  );

  const SongCard = ({ song, showAddButton = true }: { song: Song; showAddButton?: boolean }) => (
    <div className="group bg-gray-800/50 hover:bg-gray-800 rounded-xl p-3 transition-all duration-300 hover:scale-[1.02]">
      <div className="flex items-start gap-3">
        <div className="relative flex-shrink-0">
          <img 
            src={song.thumbnail} 
            alt={song.title} 
            className="w-20 h-14 object-cover rounded-lg"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 rounded-lg transition-colors"></div>
        </div>
        <div className="flex-grow min-w-0">
          <p className="font-semibold text-white truncate text-sm">{song.title}</p>
        </div>
        {showAddButton && (
          <button
            onClick={() => handleAddSong(song)}
            className="flex-shrink-0 bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg transition-colors"
            title="Thêm vào danh sách phát"
          >
            <AddIcon />
          </button>
        )}
      </div>
    </div>
  );

  const SongList = ({ songs, loading, error }: { songs: Song[]; loading?: boolean; error?: string | null }) => {
    if (loading) {
      return (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-800/30 animate-pulse rounded-xl p-3">
              <div className="flex items-start gap-3">
                <div className="w-20 h-14 bg-gray-700 rounded-lg"></div>
                <div className="flex-grow space-y-2">
                  <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-8">
          <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-red-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
          </div>
          <p className="text-red-400">{error}</p>
        </div>
      );
    }

    if (songs.length === 0) {
      return (
        <div className="text-center py-8">
          <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
            </svg>
          </div>
          <p className="text-gray-400">Không tìm thấy bài hát nào</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {songs.map((song) => (
          <SongCard key={song.id} song={song} />
        ))}
      </div>
    );
  };

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen />;

  return (
    <div className="bg-gradient-to-br from-gray-900 to-black min-h-screen text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-900/90 backdrop-blur-lg border-b border-gray-800 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">🎤 Karaoke Remote</h1>
            <p className="text-sm text-gray-400">Điều khiển từ xa</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowRoomId(!showRoomId)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                roomId && !error 
                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                  : 'bg-gray-800 text-gray-400'
              }`}
            >
              <SignalIcon />
              {showRoomId && (
                <span className="text-sm font-mono font-bold">{roomId}</span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Now Playing Section */}
      <div className="p-4 bg-gradient-to-r from-gray-800/50 to-gray-900/50 border-b border-gray-800">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 p-4 bg-gray-800/30 backdrop-blur-sm rounded-2xl border border-gray-700">
            <div className="flex-shrink-0">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
              </div>
            </div>
            <div className="flex-grow min-w-0">
              <p className="text-sm text-gray-400 mb-1">Đang phát</p>
              <h3 className="font-bold text-lg truncate">
                {currentSong?.title || 'Chưa có bài hát nào'}
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleTogglePlay}
                className="w-12 h-12 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center transition-colors shadow-lg"
                title={roomData?.playing ? 'Tạm dừng' : 'Phát'}
              >
                {roomData?.playing ? <PauseIcon /> : <PlayIcon />}
              </button>
              <button
                onClick={handleNext}
                className="w-12 h-12 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center transition-colors"
                title="Bài kế tiếp"
              >
                <NextIcon />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-4 sticky top-16 z-40 bg-gray-900/90 backdrop-blur-lg border-b border-gray-800">
        <div className="max-w-2xl mx-auto">
          <div className="flex gap-2">
            <div className="flex-grow relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyUp={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Nhập tên bài hát để tìm kiếm..."
                className="w-full p-3 pl-12 bg-gray-800/50 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <div className="absolute left-4 top-3.5 text-gray-400">
                <SearchIcon />
              </div>
            </div>
            <button
              onClick={handleSearch}
              disabled={searchLoading || !query.trim()}
              className="px-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed font-semibold rounded-xl transition-all flex items-center gap-2"
            >
              {searchLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Đang tìm...</span>
                </>
              ) : (
                <>
                  <SearchIcon />
                  <span>Tìm</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content with fixed header and playing section */}
      <div className="flex flex-col">
        {/* Tabs */}
        <div className="flex mb-4 border-b border-gray-800 bg-gray-900/50 sticky top-24 z-30">
          <TabButton
            id="trending"
            label="Thịnh hành"
            isActive={activeTab === 'trending'}
          />
          <TabButton
            id="search"
            label="Kết quả tìm kiếm"
            isActive={activeTab === 'search'}
          />
          <TabButton
            id="playlist"
            label="Danh sách phát"
            count={roomData?.queue?.length || 0}
            isActive={activeTab === 'playlist'}
          />
        </div>

        {/* Scrollable Tab Content */}
        <div className="flex-grow overflow-y-auto max-h-[calc(100vh-300px)] pr-2 -mr-2">
          {activeTab === 'trending' && (
            <div>
              <h2 className="text-xl font-bold mb-4">🎵 Bài hát thịnh hành</h2>
              <SongList songs={trendingSongs} loading={trendingLoading} />
            </div>
          )}

          {activeTab === 'search' && (
            <div>
              <h2 className="text-xl font-bold mb-4">
                🔍 Kết quả tìm kiếm {results.length > 0 && `(${results.length})`}
              </h2>
              <SongList
                songs={results}
                loading={searchLoading}
                error={searchError}
              />
            </div>
          )}

          {activeTab === 'playlist' && (
            <div>
              <h2 className="text-xl font-bold mb-4">
                📋 Danh sách phát ({roomData?.queue?.length || 0} bài)
              </h2>
              {roomData && (
                <Playlist
                  songs={roomData.queue || []}
                  currentSong={currentSong}
                  onSelectSong={handleSelectSong}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="p-4 border-t border-gray-800 text-center text-sm text-gray-500">
        <p>Kết nối với mã phòng: <span className="font-mono text-blue-400">{roomId}</span></p>
        <p className="mt-1">© 2024 Karaoke Remote Control</p>
      </footer>
    </div>
  );
};

export default RemoteView;