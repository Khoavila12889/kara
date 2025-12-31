import { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

import YouTubePlayer from './YouTubePlayer';
import Playlist from './Playlist';
import { Song } from './types';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Generate room ID
    const id = generateRoomId();
    setRoomId(id);
    
    // Simulate loading completion
    setTimeout(() => {
      setLoading(false);
    }, 500);
  }, []);

  const handleNextSong = () => {
    if (roomData.queue.length > 0 && roomData.currentIndex < roomData.queue.length - 1) {
      setRoomData(prev => ({
        ...prev,
        currentIndex: prev.currentIndex + 1
      }));
    }
  };

  const currentSong = roomData.queue[roomData.currentIndex];
  const remoteUrl = `${window.location.origin}/remote?roomId=${roomId}`;

  if (loading) {
    return (
      <div className="bg-gray-900 text-white min-h-screen font-sans p-8 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4 text-blue-400">T-Karaoke</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 text-white min-h-screen font-sans">
      <header className="bg-gray-800 p-4">
        <h1 className="text-3xl font-bold text-center text-blue-400">
          T-Karaoke (Simple Mode)
        </h1>
      </header>

      <div className="flex flex-col md:flex-row p-4 gap-4">
        <main className="w-full md:w-2/3">
          <div className="bg-gray-800 p-4 rounded-lg mb-4">
            <YouTubePlayer song={currentSong} playing={roomData.playing} onEnded={handleNextSong} />
          </div>
        </main>

        <aside className="w-full md:w-1/3 bg-gray-800 p-4 rounded-lg flex flex-col">
          <div className="mb-4">
            <h2 className="text-2xl font-bold mb-2">Scan to Connect</h2>
            <div className="bg-white p-4 rounded-lg flex justify-center">
              {roomId ? (
                <QRCodeCanvas value={remoteUrl} size={128} />
              ) : (
                <p>Generating QR Code...</p>
              )}
            </div>
            <p className="text-center mt-2">Room ID: <span className="font-bold text-lg">{roomId}</span></p>
          </div>
          <div className="flex-grow">
            <Playlist songs={roomData.queue} currentSong={currentSong} />
          </div>
        </aside>
      </div>
    </div>
  );
};

export default TvView;