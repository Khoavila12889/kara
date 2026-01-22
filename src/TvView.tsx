import { useState, useEffect, useRef } from 'react';
import { ref, onValue, set, runTransaction } from 'firebase/database';
import { database } from './firebase';
import { DatabaseReference } from 'firebase/database';
import { QRCodeCanvas } from 'qrcode.react';
import YouTubePlayer from './YouTubePlayer';
import Playlist from './Playlist';
import { ExtendedSong } from './types';
import { logger } from './logger';

interface RoomData {
  queue: ExtendedSong[];
  currentIndex: number;
  playing: boolean;
  playRequestTimestamp?: number;
}

const generateRoomId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

const TvView = () => {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomData, setRoomData] = useState<RoomData>({
    queue: [],
    currentIndex: -1,
    playing: false,
  });
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [useFirebase, setUseFirebase] = useState(true);
  const [showQRPopup, setShowQRPopup] = useState(true);
  const [sessionStarted, setSessionStarted] = useState(false);

  useEffect(() => {
    if (!sessionStarted || !useFirebase) {
      if (sessionStarted && !useFirebase) {
        logger.warn('Running in fallback/offline mode. Firebase is disabled.');
        setLoading(false);
      }
      return;
    }

    const connectToRoom = (id: string) => {
      logger.log(`Connecting to room: ${id}`);
      setRoomId(id);
      const roomRef = ref(database, 'rooms/' + id);

      const connectionTimeout = setTimeout(() => {
        if (loading) {
          logger.warn('Connection timeout. Room might not exist or network is slow.');
          setError(new Error('Kết nối tới phòng thất bại do timeout. Vui lòng kiểm tra mạng và thử lại.'));
          setLoading(false);
        }
      }, 10000);

      const unsubscribe = onValue(roomRef,
        (snapshot) => {
          clearTimeout(connectionTimeout);
          const data = snapshot.val();
          logger.log('Data received from onValue:', data);

          if (data === null) {
            logger.warn(`Room ${id} not found in Firebase. It might have been deleted.`);
            localStorage.removeItem('karaokeRoomId');
            createNewRoom();
            return;
          }

          const completeData = {
            queue: [],
            currentIndex: -1,
            playing: false,
            ...data,
          };
          setRoomData(completeData);
          setLoading(false);
        },
        (err) => {
          clearTimeout(connectionTimeout);
          logger.error('Firebase onValue listener error:', err);
          setError(new Error(`Lỗi kết nối Firebase: ${err.message}`));
          setLoading(false);
        }
      );
      return unsubscribe;
    };

    const createNewRoom = async () => {
      logger.log('No saved room found. Creating a new room.');
      const newId = generateRoomId();
      setRoomId(newId);
      localStorage.setItem('karaokeRoomId', newId);

      const roomRef = ref(database, 'rooms/' + newId);
      logger.log('Setting initial room state in Firebase...');
      try {
        await set(roomRef, {
          queue: [],
          currentIndex: -1,
          playing: false,
        });
        logger.log('Initial room state set.');
        return connectToRoom(newId);
      } catch (error: any) {
        logger.error('Error creating room:', error);
        setError(new Error(`Không thể tạo phòng mới: ${error.message}`));
        setLoading(false);
        return null;
      }
    };

    const savedRoomId = localStorage.getItem('karaokeRoomId');
    let unsubscribe: (() => void) | undefined;

    if (savedRoomId) {
      logger.log(`Found saved room ID: ${savedRoomId}`);
      unsubscribe = connectToRoom(savedRoomId);
    } else {
      createNewRoom().then(unsub => {
        if (unsub) unsubscribe = unsub;
      }).catch((error: any) => {
        logger.error('Error during room creation:', error);
        setError(new Error(`Lỗi trong quá trình tạo phòng: ${error.message}`));
        setLoading(false);
      });
    }

    return () => {
      if (unsubscribe) {
        logger.log('Cleaning up: Unsubscribing from onValue listener.');
        unsubscribe();
      }
    };
  }, [sessionStarted, useFirebase]);

  const currentSong = roomData.queue?.[roomData.currentIndex];
  const isPlayingAndHasSong = !!currentSong && roomData.playing;

  useEffect(() => {
    if (useFirebase && roomId && !roomData.playing && roomData.currentIndex === -1 && roomData.queue?.length > 0) {
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
            playRequestTimestamp: Date.now()
          };
        }
        return currentData;
      });
    }
  }, [roomData, useFirebase, roomId]);
  
  useEffect(() => {
    if (isPlayingAndHasSong) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch((err) => {
          logger.warn('Failed to enter fullscreen:', err);
        });
      }
      setShowQRPopup(false);
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch((err) => {
          logger.warn('Failed to exit fullscreen:', err);
        });
      }
      if (!currentSong && !roomData.playing) {
        setShowQRPopup(true);
      }
    }
  }, [isPlayingAndHasSong, currentSong, roomData.playing]);

  const handleNextSong = () => {
    if (!useFirebase || !roomId) return;
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
      return { ...currentData, queue: newQueue, currentIndex: nextIndex, playing: true, playRequestTimestamp: Date.now() };
    });
  };

  const handleNewRoom = () => {
    localStorage.removeItem('karaokeRoomId');
    window.location.reload();
  };

  const handleSelectSong = (song: ExtendedSong) => {
    if (!useFirebase || !roomId) return;
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

  const remoteUrl = `${window.location.origin}/remote?roomId=${roomId}`;
  
  const playerContainerClasses = isPlayingAndHasSong
    ? 'fixed top-0 left-0 w-screen h-screen z-50 bg-black'
    : 'p-4 rounded-lg mb-4 group relative';

  const headerClasses = isPlayingAndHasSong ? 'hidden' : '';
  const asideClasses = isPlayingAndHasSong ? 'hidden' : 'w-full md:w-1/3 bg-gray-800 p-4 rounded-lg flex flex-col';

  const exitFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch((err) => {
        logger.warn('Failed to exit fullscreen manually:', err);
      });
    }
    if (roomData.playing && currentSong) {
      if (useFirebase && roomId) {
        set(ref(database, 'rooms/' + roomId + '/playing'), false);
      }
    }
  };
  
  const showQRPopupHandler = () => {
    setShowQRPopup(true);
  };

  if (!sessionStarted) {
    return (
      <div className="bg-gray-900 text-white min-h-screen flex items-center justify-center text-center p-4">
        <div className="animate-fadeIn">
          <h1 className="text-6xl md:text-8xl font-bold mb-4 text-white tracking-wider">
             Music for life
          </h1>
          
          <button
            onClick={() => setSessionStarted(true)}
            className="bg-pink-600 hover:bg-pink-700 text-white font-bold py-4 px-10 rounded-full text-2xl 
                       transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-pink-500/50"
          >
            Start 
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`tv-view-container bg-gray-900 text-white font-sans transition-all duration-300 ${!isPlayingAndHasSong ? 'p-4' : ''}`}>
      {error && (
        <div className="fixed inset-0 bg-red-900/90 text-white flex flex-col items-center justify-center z-[100] p-4 text-center">
            <h2 className="text-3xl font-bold mb-4">An Error Occurred</h2>
            <p className="mb-4">{error.message}</p>
            <button
                onClick={() => window.location.reload()}
                className="bg-white text-red-900 font-bold py-2 px-6 rounded-lg"
            >
                Refresh Page
            </button>
        </div>
      )}
      {loading && (
          <div className="fixed inset-0 bg-gray-900/90 flex items-center justify-center z-[100]">
              <div className="text-white text-2xl">Connecting to Room...</div>
          </div>
      )}

      {!loading && roomId && !isPlayingAndHasSong && showQRPopup && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-lg z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-gray-800/50 rounded-2xl p-8 max-w-md w-full border border-gray-700 shadow-2xl">
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-2 text-[#10F615]">Quét mã QR kết nối </h2>
              <p className="text-gray-300 mb-6">Điện thoại dùng  Camera, Zalo hoặc apps QR quét mã QR</p>

              <div className="bg-white p-4 rounded-lg inline-block mb-4">
                <QRCodeCanvas value={remoteUrl} size={192} />
              </div>

              {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
                <div className="bg-yellow-900/30 border border-yellow-700 text-yellow-200 p-3 rounded-lg text-sm mb-4">
                  <p className="font-bold">You are running on localhost.</p>
                  <p>This QR code might not work on other devices. Use your computer's network IP address for the TV screen.</p>
                </div>
              )}

              <p className="mb-6">
                <span className="text-gray-400">Room ID: </span>
                <span className="font-bold text-2xl text-[#10F615]tracking-widest">{roomId}</span>
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(remoteUrl);
                    alert(`URL Copied: ${remoteUrl}`);
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105"
                >
                  Copy URL giả lập remote
                </button>
                <button
                  onClick={() => setShowQRPopup(false)}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`bg-gray-800 p-4 flex justify-between items-center mb-4 ${headerClasses}`}>
        <h1 className="text-2xl font-bold text-pink-400">
         Music for life <span className="text-sm font-normal text-gray-400">{useFirebase ? "Online" : "Offline"}</span>
        </h1>
        <div className="flex gap-3">
          <button
            onClick={showQRPopupHandler}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-5 rounded-lg transition-transform transform hover:scale-105"
          >
            Connect 
          </button>
          <button
            onClick={handleNewRoom}
            className="bg-pink-600 hover:bg-pink-700 text-white font-bold py-2 px-5 rounded-lg transition-transform transform hover:scale-105"
          >
            New Room
          </button>
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row gap-4 flex-grow">
        <main className="w-full md:w-2/3 flex flex-col">
          <div className={`${playerContainerClasses} group relative flex-grow`}>
            {currentSong ? (
              <>
                {isPlayingAndHasSong && (
                  <div className="absolute top-4 right-4 z-50 flex gap-2">
                    <button
                      onClick={showQRPopupHandler}
                      className="bg-green-600/80 hover:bg-green-700/80 backdrop-blur-md text-white font-bold w-10 h-10 flex items-center justify-center rounded-full transition-transform transform hover:scale-110"
                      title="Show QR Code"
                      aria-label="Show QR Code"
                    >
                      📱
                    </button>
                    <button
                      onClick={exitFullscreen}
                      className="bg-red-600/80 hover:bg-red-700/80 backdrop-blur-md text-white font-bold w-10 h-10 flex items-center justify-center rounded-full text-xl transition-transform transform hover:scale-110"
                      title="Exit Fullscreen"
                      aria-label="Exit Fullscreen"
                    >
                      ×
                    </button>
                  </div>
                )}
                <div className={`${isPlayingAndHasSong ? 'tv-view-fullscreen' : 'w-full aspect-video'} relative tv-view-player-container rounded-lg overflow-hidden`}>
                  <YouTubePlayer
                    song={currentSong}
                    playing={roomData.playing}
                    playRequestTimestamp={roomData.playRequestTimestamp}
                    onEnded={handleNextSong}
                    onError={handleNextSong}
                    className="w-full h-full"
                  />
                </div>
              </>
            ) : (
              <div className="aspect-video flex flex-col items-center justify-center bg-black rounded-lg text-gray-500 h-full">
                <p className="text-3xl font-semibold">Add a song to get started!</p>
                <p className="mt-2">Scan the QR code to connect your remote.</p>
              </div>
            )}
          </div>
        </main>
        
        <aside className={`${asideClasses} flex-shrink-0`}>
          <div className="h-full overflow-y-auto max-h-[calc(100vh-200px)]">
            <Playlist
              songs={roomData.queue || []}
              currentSong={currentSong}
              onSelectSong={handleSelectSong}
              onRemoveSong={undefined} // TV view không có nút xóa
              onSetPriority={undefined} // TV view không có nút ưu tiên
              mode={roomData.mode}
            />
          </div>
        </aside>
      </div>
    </div>
  );
};

export default TvView;