import { useState, useEffect } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { database } from './firebase';
import { QRCodeCanvas } from 'qrcode.react';

import YouTubePlayer from './YouTubePlayer';
import Playlist from './Playlist';
import { Song } from './types';
import { logger } from './logger';

interface RoomData {
  queue: Song[];
  currentIndex: number;
  playing: boolean;
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

  useEffect(() => {
    if (!useFirebase) {
      logger.warn('Running in fallback/offline mode. Firebase is disabled.');
      setLoading(false);
      return;
    }

    const connectToRoom = (id: string) => {
      logger.log(`Connecting to room: ${id}`);
      setRoomId(id);
      const roomRef = ref(database, 'rooms/' + id);

      // Thiết lập timeout cho việc kết nối
      const connectionTimeout = setTimeout(() => {
        if (loading) {
          logger.warn('Connection timeout. Room might not exist or network is slow.');
          // Không tự động tạo phòng mới ở đây để tránh vòng lặp
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
          setError(err);
          setUseFirebase(false);
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
      await set(roomRef, {
        queue: [],
        currentIndex: -1,
        playing: false,
      });
      logger.log('Initial room state set.');
      return connectToRoom(newId);
    };

    const savedRoomId = localStorage.getItem('karaokeRoomId');

    let unsubscribe: (() => void) | undefined;

    if (savedRoomId) {
      logger.log(`Found saved room ID: ${savedRoomId}`);
      unsubscribe = connectToRoom(savedRoomId);
    } else {
      createNewRoom().then(unsub => unsubscribe = unsub);
    }

    return () => {
      if (unsubscribe) {
        logger.log('Cleaning up: Unsubscribing from onValue listener.');
        unsubscribe();
      }
    };
  }, [useFirebase]);

  const handleNextSong = () => {
    if (useFirebase && roomId) {
      const newIndex = (roomData.currentIndex + 1);
      if (newIndex >= (roomData.queue?.length || 0)) {
        set(ref(database, 'rooms/' + roomId), {
          ...roomData,
          currentIndex: -1,
          playing: false,
        });
      } else {
        set(ref(database, 'rooms/' + roomId + '/currentIndex'), newIndex);
      }
    }
  };

  const handleNewRoom = () => {
    localStorage.removeItem('karaokeRoomId');
    window.location.reload();
  };

  const handleSelectSong = (song: Song) => {
    if (!useFirebase || !roomId || !roomData.queue) return;

    if (window.confirm(`Bạn có chắc muốn phát bài "${song.title}" ngay bây giờ không?`)) {
      const newIndex = roomData.queue.findIndex(s => s.id === song.id);
      if (newIndex !== -1) {
        const roomRef = ref(database, 'rooms/' + roomId);
        set(roomRef, {
          ...roomData,
          currentIndex: newIndex,
          playing: true,
        });
      }
    }
  };

  const currentSong = roomData.queue?.[roomData.currentIndex];
  const remoteUrl = `${window.location.origin}/remote?roomId=${roomId}`;

  // Fullscreen Logic
  const isFullscreen = !!currentSong && roomData.playing;

  const playerContainerClasses = isFullscreen
    ? 'fixed top-0 left-0 w-screen h-screen z-50 bg-black'
    : 'p-4 rounded-lg mb-4 group relative';

  const headerClasses = isFullscreen ? 'hidden' : 'bg-gray-800 p-4 flex justify-between items-center';
  const asideClasses = isFullscreen ? 'hidden' : 'w-full md:w-1/3 bg-gray-800 p-4 rounded-lg flex flex-col';

  const exitFullscreen = () => {
    // First try to exit document fullscreen
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if ((document as any).mozCancelFullScreen) { /* Firefox */
      (document as any).mozCancelFullScreen();
    } else if ((document as any).webkitExitFullscreen) { /* Chrome, Safari & Opera */
      (document as any).webkitExitFullscreen();
    } else if ((document as any).msExitFullscreen) { /* IE/Edge */
      (document as any).msExitFullscreen();
    }

    // Also try to exit any possible element fullscreen (like iframe)
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }

    // Additionally, we can pause the video if it's playing fullscreen
    // This is handled by the YouTube player component, but we can trigger a state change
    if (roomData.playing && currentSong) {
      // We'll update the room state to stop playing, which should exit fullscreen
      if (useFirebase && roomId) {
        set(ref(database, 'rooms/' + roomId + '/playing'), false);
      }
    }
  };

  // Function to show QR popup
  const showQRPopupHandler = () => {
    setShowQRPopup(true);
  };


  if (error) {
    return (
      <div className="bg-red-900 text-white min-h-screen font-sans p-8">
        <h1 className="text-3xl font-bold mb-4">An Error Occurred</h1>
        <p>{error.message}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-gray-900 text-white min-h-screen font-sans p-8 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4 text-blue-400">T-Karaoke</h1>
          <p>Đang kết nối...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${loading ? '' : 'relative'} tv-view-container bg-gray-900 text-white min-h-screen font-sans`}>
      {!loading && roomId && !isFullscreen && showQRPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full border border-gray-700 transform transition-all">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4 text-blue-400">Quét để kết nối</h2>
              <p className="text-gray-300 mb-4">Dùng điện thoại quét mã QR để điều khiển từ xa</p>

              <div className="bg-white p-4 rounded-lg flex justify-center mb-4">
                <QRCodeCanvas value={remoteUrl} size={128} />
              </div>

              <p className="text-center mb-2">Mã phòng: <span className="font-bold text-lg text-blue-400">{roomId}</span></p>

              <div className="mt-4 flex flex-col gap-2">
                <button
                  onClick={() => {
                    // Sao chép URL vào clipboard
                    navigator.clipboard.writeText(remoteUrl);
                    alert(`Đã sao chép URL: ${remoteUrl}`);
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                >
                  Sao chép URL phòng
                </button>

                <button
                  onClick={() => {
                    // Đóng popup
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
                {isFullscreen && (
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
                <div className={`${isFullscreen ? 'tv-view-fullscreen' : 'w-full aspect-video'} relative tv-view-player-container`}>
                  <YouTubePlayer
                    song={currentSong}
                    playing={roomData.playing}
                    onEnded={handleNextSong}
                    onError={handleNextSong}
                    className={isFullscreen ? 'w-full h-full' : 'w-full h-full'}
                  />
                </div>
              </>
            ) : (
              <div className="aspect-video flex items-center justify-center bg-black text-gray-400">
                <p className="text-xl">Thêm một bài hát để bắt đầu!</p>
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
            <p className="text-center mt-2">Mã phòng: <span className="font-bold text-lg">{roomId}</span></p>

            {/* Button để quét lại QR nếu cần */}
            <div className="mt-4 text-center">
              <button
                onClick={() => {
                  // Tạo lại URL với roomId hiện tại để người dùng có thể quét lại
                  const currentRemoteUrl = `${window.location.origin}/remote?roomId=${roomId}`;
                  // Sao chép URL vào clipboard để người dùng có thể chia sẻ
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
            <Playlist songs={roomData.queue || []} currentSong={currentSong} onSelectSong={handleSelectSong} />
          </div>
        </aside>
      </div>
    </div>
  );
};

export default TvView;
