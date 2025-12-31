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

      const unsubscribe = onValue(roomRef,
        (snapshot) => {
          const data = snapshot.val();
          logger.log('Data received from onValue:', data);

          if (data === null) {
            logger.warn(`Room ${id} not found in Firebase. It might have been deleted. Generating a new room.`);
            localStorage.removeItem('karaokeRoomId');
            window.location.reload();
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
    : 'bg-gray-800 p-4 rounded-lg mb-4';

  const headerClasses = isFullscreen ? 'hidden' : 'bg-gray-800 p-4 flex justify-between items-center';
  const asideClasses = isFullscreen ? 'hidden' : 'w-full md:w-1/3 bg-gray-800 p-4 rounded-lg flex flex-col';


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
    <div className="bg-gray-900 text-white min-h-screen font-sans">
      <header className={headerClasses}>
        <h1 className="text-3xl font-bold text-center text-blue-400">
          T-Karaoke {useFirebase ? "(Trực tuyến)" : "(Ngoại tuyến)"}
        </h1>
        <button
          onClick={handleNewRoom}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Tạo phòng mới
        </button>
      </header>

      <div className="flex flex-col md:flex-row p-4 gap-4">
        <main className="w-full md:w-2/3">
          <div className={playerContainerClasses}>
            {currentSong ? (
              <YouTubePlayer song={currentSong} playing={roomData.playing} onEnded={handleNextSong} onError={handleNextSong} />
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
            <div className="bg-white p-4 rounded-lg flex justify-center">
              {roomId ? (
                <QRCodeCanvas value={remoteUrl} size={128} />
              ) : (
                <p>Đang tạo mã QR...</p>
              )}
            </div>
            <p className="text-center mt-2">Mã phòng: <span className="font-bold text-lg">{roomId}</span></p>
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