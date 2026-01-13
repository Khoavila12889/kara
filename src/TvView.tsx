import { useState, useEffect } from 'react';
import { ref, onValue, set, runTransaction } from 'firebase/database';
import { database } from './firebase';
import { DatabaseReference } from 'firebase/database';
import { QRCodeCanvas } from 'qrcode.react';

import YouTubePlayer from './YouTubePlayer';
import Playlist from './Playlist';
import { Song, ExtendedSong } from './types';
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
      const roomRef = ref(database as DatabaseReference, 'rooms/' + id);

      // Thiết lập timeout cho việc kết nối
      const connectionTimeout = setTimeout(() => {
        if (loading) {
          logger.warn('Connection timeout. Room might not exist or network is slow.');
          setError(new Error('Kết nối tới phòng thất bại do timeout. Vui lòng kiểm tra mạng và thử lại.'));
          setLoading(false);
        }
      }, 10000); // 10 giây timeout

      const unsubscribe = onValue(roomRef,
        (snapshot) => {
          clearTimeout(connectionTimeout); // Hủy timeout khi kết nối thành công

          const data = snapshot.val();
          logger.log('Data received from onValue:', data);

          if (data === null) {
            logger.warn(`Room ${id} not found in Firebase. It might have been deleted.`);
            // Thay vì reload, tạo phòng mới
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
          clearTimeout(connectionTimeout); // Hủy timeout khi có lỗi

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

      const roomRef = ref(database as DatabaseReference, 'rooms/' + newId);
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

  useEffect(() => {
    // Autoplay feature: if the player is stopped but there are songs in the queue, start playing the first one.
    // This now correctly prioritizes priority songs.
    if (useFirebase && roomId && !roomData.playing && roomData.currentIndex === -1 && roomData.queue?.length > 0) {
      const roomRef = ref(database as DatabaseReference, 'rooms/' + roomId);
      runTransaction(roomRef, (currentData) => {
        if (!currentData) return;
        // Check again inside transaction to prevent race conditions
        if (!currentData.playing && currentData.currentIndex === -1 && currentData.queue?.length > 0) {
            const priorityIndex = currentData.queue.findIndex(song => song.isPriority);
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


  const handleNextSong = () => {
    if (!useFirebase || !roomId) return;

    const roomRef = ref(database as DatabaseReference, 'rooms/' + roomId);
    runTransaction(roomRef, (currentData) => {
      if (!currentData) {
        logger.warn('handleNextSong: No current data in transaction.');
        return null;
      }

      const { queue, currentIndex } = currentData;
      
      // If queue is empty or no song was playing, do nothing.
      if (!queue || queue.length === 0 || currentIndex === -1) {
        return {
          ...currentData,
          currentIndex: -1,
          playing: false,
        };
      }
      
      // Create a new queue by removing the song that just finished.
      const newQueue = queue.filter((_, index) => index !== currentIndex);

      // If the new queue is empty, stop playback.
      if (newQueue.length === 0) {
        return {
          ...currentData,
          queue: [],
          currentIndex: -1,
          playing: false,
        };
      }

      // Find the next song to play from the new queue.
      // 1. Find the first priority song.
      let nextIndex = newQueue.findIndex(song => song.isPriority);
      
      // 2. If no priority song, play the first song in the new queue.
      if (nextIndex === -1) {
        nextIndex = 0;
      }
      
      logger.log(`handleNextSong: New queue length: ${newQueue.length}. Next index: ${nextIndex}. Priority: ${nextIndex !== 0}`);

      return {
        ...currentData,
        queue: newQueue,
        currentIndex: nextIndex,
        playing: true,
        playRequestTimestamp: Date.now()
      };
    });
  };

  const handleNewRoom = () => {
    localStorage.removeItem('karaokeRoomId');
    window.location.reload();
  };

  // Hàm để cấp quyền ưu tiên cho thiết bị hiện tại (Tạm thời vô hiệu hóa)
  const handleSetPriorityDevice = () => {
    // if (useFirebase && roomId) {
    //   const roomRef = ref(database, 'rooms/' + roomId);
    //   set(roomRef, {
    //     ...roomData,
    //     priorityDeviceId: deviceId // 'deviceId' is not defined
    //   });
    //   logger.log('Đã thiết lập thiết bị này là thiết bị ưu tiên');
    //   alert('Thiết bị này đã được thiết lập là thiết bị ưu tiên');
    // }
     alert('Chức năng này đang được phát triển.');
  };

  const handleSelectSong = (song: ExtendedSong) => {
    if (!useFirebase || !roomId) return;

    const roomRef = ref(database as DatabaseReference, 'rooms/' + roomId);
    runTransaction(roomRef, (currentData) => {
      if (!currentData || !currentData.queue) return currentData;

      const newIndex = currentData.queue.findIndex(s => s.id === song.id);
      if (newIndex !== -1) {
        // If the selected song is the one currently playing, do nothing.
        if (newIndex === currentData.currentIndex && currentData.playing) {
          return currentData;
        }
        logger.log(`Selecting song: ${song.title} at index ${newIndex}`);
        return {
          ...currentData,
          currentIndex: newIndex,
          playing: true,
          playRequestTimestamp: Date.now()
        };
      }
      return currentData;
    });
  };

  const currentSong = roomData.queue?.[roomData.currentIndex];
  const remoteUrl = `${window.location.origin}/remote?roomId=${roomId}`;

  // Fullscreen Logic
  const isPlayingAndHasSong = !!currentSong && roomData.playing;

  useEffect(() => {
    // Request fullscreen when a song is playing and there's a current song
    if (isPlayingAndHasSong) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch((err) => {
          logger.warn('Failed to enter fullscreen:', err);
        });
      }
      setShowQRPopup(false);
    } else {
      // Exit fullscreen when playback stops or no song is selected
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


  const playerContainerClasses = isPlayingAndHasSong
    ? 'fixed top-0 left-0 w-screen h-screen z-50 bg-black'
    : 'p-4 rounded-lg mb-4 group relative';

  const headerClasses = isPlayingAndHasSong ? 'hidden' : 'bg-gray-800 p-4 flex justify-between items-center';
  const asideClasses = isPlayingAndHasSong ? 'hidden' : 'w-full md:w-1/3 bg-gray-800 p-4 rounded-lg flex flex-col';

  const exitFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch((err) => {
        logger.warn('Failed to exit fullscreen manually:', err);
      });
    }

    if (roomData.playing && currentSong) {
      if (useFirebase && roomId) {
        set(ref(database as DatabaseReference, 'rooms/' + roomId + '/playing'), false);
      }
    }
  };

  // Function to show QR popup (can be called manually by user)
  const showQRPopupHandler = () => {
    setShowQRPopup(true);
  };


  if (!sessionStarted) {
    return (
      <div className="bg-gray-900 text-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-5xl font-bold mb-8 text-blue-400">T-Karaoke</h1>
          <button
            onClick={() => setSessionStarted(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-full text-2xl transition-transform transform hover:scale-105"
          >
            Bắt đầu
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 text-white min-h-screen font-sans p-8 flex flex-col items-center justify-center text-center">
        <h1 className="text-3xl font-bold mb-4 text-red-500">Đã xảy ra lỗi</h1>
        <p className="max-w-md">{error.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors"
        >
          Tải lại trang
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-gray-900 text-white min-h-screen font-sans p-8 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4 text-blue-400">T-Karaoke</h1>
          <p>Đang tải và kết nối...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${loading ? '' : 'relative'} tv-view-container bg-gray-900 text-white min-h-screen font-sans`}>
      {!loading && roomId && !isPlayingAndHasSong && showQRPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full border border-gray-700 transform transition-all">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4 text-blue-400">Quét để kết nối</h2>
              <p className="text-gray-300 mb-4">Dùng điện thoại quét mã QR để điều khiển từ xa</p>

              <div className="bg-white p-4 rounded-lg flex justify-center mb-4">
                <QRCodeCanvas value={remoteUrl} size={128} />
              </div>

              {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
                <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-200 p-3 rounded-lg text-sm mb-4">
                  <p className="font-bold">Lưu ý: Bạn đang dùng localhost.</p>
                  <p>Mã QR này có thể không hoạt động trên thiết bị khác. Hãy thử truy cập trang TV này bằng địa chỉ IP mạng của máy tính bạn.</p>
                </div>
              )}

              <p className="text-center mb-2">Mã phòng: <span className="font-bold text-lg text-blue-400">{roomId}</span></p>

              <div className="mt-4 flex flex-col gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(remoteUrl);
                    alert(`Đã sao chép URL: ${remoteUrl}`);
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                >
                  Sao chép URL phòng
                </button>

                <button
                  onClick={() => {
                    setShowQRPopup(false);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                  Đã kết nối, đóng cửa sổ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <header className={headerClasses}>
        <h1 className="text-3xl font-bold text-center text-blue-400">
          T-Karaoke {useFirebase ? "(Trực tuyến)" : "(Ngoại tuyến)"}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={showQRPopupHandler}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
          >
            Kết nối điện thoại
          </button>
          <button
            onClick={handleNewRoom}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Tạo phòng mới
          </button>
        </div>
      </header>

      <div className="flex flex-col md:flex-row p-4 gap-4">
        <main className="w-full md:w-2/3">
          <div className={`${playerContainerClasses} group relative`}>
            {currentSong ? (
              <>
                {isPlayingAndHasSong && (
                  <div className="absolute top-4 right-4 z-50 flex gap-2">
                    <button
                      onClick={showQRPopupHandler}
                      className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-full"
                      title="Kết nối điện thoại"
                    >
                      📱
                    </button>
                    <button
                      onClick={exitFullscreen}
                      className="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-2 rounded-full w-8 h-8 flex items-center justify-center text-lg"
                      title="Thoát toàn màn hình"
                    >
                      ×
                    </button>
                  </div>
                )}
                <div className={`${isPlayingAndHasSong ? 'tv-view-fullscreen' : 'w-full aspect-video'} relative tv-view-player-container`}>
                  <YouTubePlayer
                    song={currentSong}
                    playing={roomData.playing}
                    playRequestTimestamp={roomData.playRequestTimestamp}
                    onEnded={handleNextSong}
                    onError={handleNextSong}
                    className={isPlayingAndHasSong ? 'w-full h-full' : 'w-full h-full'}
                  />
                </div>
              </>
            ) : (
              <div className="aspect-video flex items-center justify-center bg-black text-gray-400">
                <p className="text-xl">Thêm một bài hát !</p>
              </div>
            )}
          </div>
        </main>

        <aside className={asideClasses}>
          <div className="mb-4">
            <h2 className="text-2xl font-bold mb-2">Quét để kết nối</h2>
            <div className=" p-4 rounded-lg flex justify-center">
              {roomId ? (
                <QRCodeCanvas value={remoteUrl} size={200} />
              ) : (
                <p>Đang tạo mã QR...</p>
              )}
            </div>
             {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
                <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-200 p-2 rounded-md text-xs mt-2">
                  <strong>Lưu ý:</strong> QR có thể không hoạt động trên localhost. Hãy dùng IP mạng của máy tính.
                </div>
              )}
            <p className="text-center mt-2">Mã phòng: <span className="font-bold text-lg">{roomId}</span></p>

            <div className="mt-4 text-center">
              <button
                onClick={() => {
                  const currentRemoteUrl = `${window.location.origin}/remote?roomId=${roomId}`;
                  navigator.clipboard.writeText(currentRemoteUrl);
                  alert(`Đã sao chép URL: ${currentRemoteUrl}\nBạn có thể chia sẻ URL này hoặc quét lại mã QR`);
                }}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded text-sm"
              >
                Sao chép URL phòng
              </button>
            </div>
          </div>
          <div className="flex-grow">
            <Playlist
              songs={roomData.queue || []}
              currentSong={currentSong}
              onSelectSong={handleSelectSong}
            />
          </div>
        </aside>
      </div>
    </div>
  );
};

export default TvView;
