import { database, ref, onValue, set, runTransaction, createRoom, remoteRoomUrl } from './roomDatabase';
import { useState, useEffect, useRef } from 'react';



import { QRCodeCanvas } from 'qrcode.react';
import YouTubePlayer from './YouTubePlayer';
import Playlist from './Playlist';
import { ExtendedSong, RoomMode } from './types';
import { logger } from './logger';

interface RoomData {
  queue: ExtendedSong[];
  currentIndex: number;
  playing: boolean;
  playRequestTimestamp?: number;
  mode?: RoomMode;
}


const TvView = () => {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomData, setRoomData] = useState<RoomData>({
    queue: [],
    currentIndex: -1,
    playing: false,
  });
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [useRoomService] = useState(true);
  const [showQR, setShowQR] = useState(true);
  const [sessionStarted, setSessionStarted] = useState(false);

  const currentSong = roomData.queue?.[roomData.currentIndex];
  const isPlaying = !!currentSong && roomData.playing;
  const remoteUrl = roomId ? remoteRoomUrl(roomId) : '';

  // Room connection effect
  useEffect(() => {
    if (!sessionStarted || !useRoomService) {
      if (sessionStarted && !useRoomService) {
        logger.warn('Running in fallback/offline mode. Room service is disabled.');
        setLoading(false);
      }
      return;
    }

    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    setLoading(true);
    setError(null);
    // Bound room creation and subscription by the same timeout.
    const timeout = setTimeout(() => {
      if (disposed) return;
      disposed = true;
      unsubscribe?.();
      setError(new Error('Không thể kết nối máy chủ phòng. Kiểm tra mạng và thử lại.'));
      setLoading(false);
    }, 12000);
    const fail = (err: unknown) => {
      if (disposed) return;
      clearTimeout(timeout);
      disposed = true;
      unsubscribe?.();
      setError(new Error(`Không thể kết nối phòng: ${err instanceof Error ? err.message : 'Máy chủ phòng không khả dụng'}`));
      setLoading(false);
    };
    const initialRoom = { currentIndex: -1, playing: false, mode: 'karaoke' };
    const connectToRoom = (id: string) => {
      if (disposed) return;
      setRoomId(id);
      unsubscribe = onValue(ref(database, 'rooms/' + id), (snapshot) => {
        if (disposed) return;
        const data = snapshot.val();
        if (data === null) {
          // Restore this room instead of creating another subscription/room ID.
          set(ref(database, 'rooms/' + id), initialRoom).catch(fail);
          return;
        }
        clearTimeout(timeout);
        localStorage.setItem('karaokeRoomId', id);
        setRoomData({ queue: [], ...initialRoom, ...data });
        setError(null);
        setLoading(false);
      }, fail);
    };
    const start = async () => {
      try {
        const savedId = localStorage.getItem('karaokeRoomId');
        if (savedId && /^[A-Z0-9]{6}$/.test(savedId) && localStorage.getItem('karaokeRoomKey:'+savedId)) {
          connectToRoom(savedId);
          return;
        }
        const id = await createRoom();
        if (disposed) return;
        setRoomId(id);
        if (!disposed) connectToRoom(id);
      } catch (err) { fail(err); }
    };
    void start();
    return () => {
      disposed = true;
      clearTimeout(timeout);
      unsubscribe?.();
    };
  }, [sessionStarted, useRoomService]);

  // Auto-play effect
  useEffect(() => {
    if (useRoomService && roomId && !roomData.playing && roomData.currentIndex === -1 && roomData.queue?.length > 0) {
      const roomRef = ref(database, 'rooms/' + roomId);
      runTransaction(roomRef, (currentData) => {
        if (!currentData) return;
        if (!currentData.playing && currentData.currentIndex === -1 && currentData.queue?.length > 0) {
          const priorityIndex = currentData.queue.findIndex((song: ExtendedSong) => song.isPriority);
          const nextIndex = priorityIndex !== -1 ? priorityIndex : 0;
          logger.log(`Autoplaying song at index ${nextIndex}. Priority: ${priorityIndex !== -1}`);
          return {
            ...currentData,
            currentIndex: nextIndex,
            playing: true,
            playRequestTimestamp: Date.now(),
          };
        }
        return currentData;
      });
    }
  }, [roomData, useRoomService, roomId]);

  // QR visibility effect
  useEffect(() => {
    setShowQR(!isPlaying && !loading && !!roomId);
  }, [isPlaying, loading, roomId]);

  // Fullscreen effect
  useEffect(() => {
    if (isPlaying && roomData.mode !== 'music' && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch((err) => {
        logger.warn('Failed to enter fullscreen:', err);
      });
    }
  }, [isPlaying, roomData.mode]);

  const handlePlayingChange = (playing: boolean) => {
    if (!useRoomService || !roomId) return;
    set(ref(database, 'rooms/' + roomId + '/playing'), playing).catch((err) => {
      logger.error('Không thể đồng bộ trạng thái phát:', err);
    });
  };

  const handleNextSong = () => {
    if (!useRoomService || !roomId) return;
    const roomRef = ref(database, 'rooms/' + roomId);
    runTransaction(roomRef, (currentData) => {
      if (!currentData) {
        logger.warn('handleNextSong: No current data in transaction.');
        return null;
      }
      const { queue, currentIndex } = currentData;
      if (!queue || queue.length === 0 || currentIndex === -1) {
        return { ...currentData, currentIndex: -1, playing: false };
      }
      const newQueue = queue.filter((_: any, index: number) => index !== currentIndex);
      if (newQueue.length === 0) {
        return { ...currentData, queue: [], currentIndex: -1, playing: false };
      }
      let nextIndex = newQueue.findIndex((song: ExtendedSong) => song.isPriority);
      if (nextIndex === -1) {
        nextIndex = 0;
      }
      logger.log(`handleNextSong: New queue length: ${newQueue.length}. Next index: ${nextIndex}. Priority: ${nextIndex !== 0}`);
      return {
        ...currentData,
        queue: newQueue,
        currentIndex: nextIndex,
        playing: true,
        playRequestTimestamp: Date.now(),
      };
    });
  };

  const handleNewRoom = () => {
    const oldId=localStorage.getItem('karaokeRoomId');
    if(oldId) localStorage.removeItem('karaokeRoomKey:'+oldId);
    localStorage.removeItem('karaokeRoomId');
    window.location.reload();
  };

  const handleSelectSong = (song: ExtendedSong) => {
    if (!useRoomService || !roomId) return;
    const roomRef = ref(database, 'rooms/' + roomId);
    runTransaction(roomRef, (currentData) => {
      if (!currentData || !currentData.queue) return currentData;
      const newIndex = currentData.queue.findIndex((s: ExtendedSong) => s.id === song.id);
      if (newIndex !== -1) {
        if (newIndex === currentData.currentIndex && currentData.playing) {
          return currentData;
        }
        logger.log(`Selecting song: ${song.title} at index ${newIndex}`);
        return { ...currentData, currentIndex: newIndex, playing: true, playRequestTimestamp: Date.now() };
      }
      return currentData;
    });
  };

  const exitFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    if (roomData.playing && currentSong && useRoomService && roomId) {
      set(ref(database, 'rooms/' + roomId + '/playing'), false);
    }
  };

  // Session start screen
  if (!sessionStarted) {
    return (
      <div className="tv-start">
        <header className="tv-start-brand"><span className="tv-start-mark" aria-hidden="true">♫</span>Khoavila</header>
        <main className="tv-start-main"><div><p className="tv-start-kicker">Karaoke & Music</p><h1>Bật nhạc.<br/><span>Kết nối cuộc vui.</span></h1><p className="tv-start-description">Một màn hình, những giai điệu yêu thích. Dùng điện thoại để chọn bài và cùng tận hưởng.</p><button onClick={()=>setSessionStarted(true)} className="tv-start-button">Start Session <span aria-hidden="true">↗</span></button><p className="tv-start-caption">Bắt đầu phiên để hiện mã QR kết nối điện thoại.</p></div><div className="tv-start-art" aria-hidden="true"><div className="tv-start-disc"><span>♫</span></div><div className="tv-start-art-label">YOUR MUSIC. YOUR MOMENT.</div></div></main>
        <footer className="tv-start-steps"><div><span>01</span>Mở phòng trên TV</div><div><span>02</span>Quét QR bằng điện thoại</div><div><span>03</span>Chọn bài & tận hưởng</div></footer>
      </div>
    );
  }

  // Error overlay
  if (error) {
    return (
      <div className="fixed inset-0 bg-red-900/95 text-white flex flex-col items-center justify-center z-[100] p-4">
        <div className="card max-w-md text-center space-y-4">
          <svg className="w-20 h-20 mx-auto text-red-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-3xl font-bold">Connection Error</h2>
          <p className="text-lg">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Loading overlay
  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-center z-[100]">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-purple-500 border-b-transparent rounded-full animate-spin"></div>
          </div>
        </div>
        <p className="text-white text-2xl mt-8 font-light">Connecting to Room...</p>
        <p className="text-gray-400 mt-2">{roomId || 'Creating new room'}</p>
      </div>
    );
  }

  // Main TV View - Normal mode (not playing) - WITH GRADIENT BACKGROUND
  return (
    <div className="tv-view-container tv-shell">
      <div className="tv-room-layout"><header className="tv-room-bar"><div className="tv-room-brand">Khoavila<small>Màn hình phòng</small></div><span className="tv-room-code">PHÒNG {roomId}</span></header>
        
        {/* Content - Grid layout với chiều cao cố định */}
        <div className="content tv-grid">
          
          {/* Left Column - Player (KHÔNG SCROLL) */}
          <div className="tv-player-column">
            {/* Video Player Area - Cố định */}
            <div className={isPlaying ? "fixed inset-0 z-[60] bg-black" : "tv-player-card card"}>
              <div className={isPlaying ? "tv-view-player-container w-full h-full" : "tv-view-player-container aspect-video"}>
                {currentSong ? (
                  <YouTubePlayer
                    song={currentSong}
                    playing={roomData.playing}
                    playRequestTimestamp={roomData.playRequestTimestamp}
                    onEnded={handleNextSong}
                    onError={handleNextSong}
                    onPlayingChange={handlePlayingChange}
                    className="w-full h-full"
                  />
                ) : (
                  <div className="tv-idle"><span aria-hidden="true">♫</span><p>Sân khấu đã sẵn sàng</p><span>Chọn một bài hát từ điện thoại để bắt đầu.</span></div>
                )}
              </div>
              <button hidden={!isPlaying} onClick={exitFullscreen} aria-label="Exit Fullscreen" className="absolute top-6 right-6 z-[70] bg-black/60 text-white rounded-full w-12 h-12 text-3xl">×</button>
            </div>

             </div>

          {/* Right Column - Playlist Container (CHỈ PLAYLIST SCROLL) */}
          <div className="tv-sidebar">
            {/* Playlist Card - Chiếm toàn bộ chiều cao */}
            <div className="card tv-queue-card">
              
              {/* Header cố định - KHÔNG SCROLL */}
              <div className="tv-queue-header">
                <div className="tv-queue-topline"><h2>Danh sách phát</h2>
                  
                  {roomData.queue?.length > 0 && (
                    <span className="tv-queue-count">
                      <span className="stat-value text-xl text-white">{roomData.queue.length}</span>
                      <span className="stat-label text-xs ml-1 text-gray-300">bài hát</span>
                    </span>
                  )}
                </div>
                
                {/* QR Code - Larger in sidebar header */}
                {showQR && (
                  <div className="tv-room-qr">
                    <div className="tv-room-qr-grid">
                      <div className="bg-white p-2 rounded-lg flex-shrink-0">
                        <QRCodeCanvas value={remoteUrl} size={144} />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-400 mb-1">Mã phòng</p>
                        <p className="text-3xl font-mono font-bold text-green-400 tracking-wider">{roomId}</p>
                        <p className="text-xs text-gray-400 mt-2">Quét mã QR để thêm bài hát</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Thông tin phòng và nút New Room - Cố định */}
                
                 
                  <button
                    onClick={handleNewRoom}
                    className="tv-new-room"
                  >
                    <span className="text-xs">Tạo phòng mới</span>
                  </button>
                
              </div>
              
              {/* Playlist content - CHỈ PHẦN NÀY ĐƯỢC SCROLL */}
              <div className="tv-queue-scroll">
                <div className="p-4">
                  <Playlist
                    songs={roomData.queue || []}
                    currentSong={currentSong}
                    onSelectSong={handleSelectSong}
                    variant="tv"
                    mode={roomData.mode}
                  />
                  

                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TvView;
