import { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

// Mock Song interface for testing
interface Song {
  id: string;
  title: string;
  thumbnail: string;
}

interface RoomData {
  queue: Song[];
  currentIndex: number;
  playing: boolean;
}

const generateRoomId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

const TvViewTest = () => {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomData, setRoomData] = useState<RoomData>({
    queue: [],
    currentIndex: -1,
    playing: false,
  });
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true); // Add loading state

  useEffect(() => {
    try {
      // Simulate initialization without Firebase
      const id = generateRoomId();
      setRoomId(id);
      
      // Simulate some async operation
      setTimeout(() => {
        setLoading(false);
      }, 1000);
    } catch (e: any) {
      console.error("Caught error during init:", e);
      setError(e);
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="bg-gray-900 text-white min-h-screen font-sans p-8 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">T-Karaoke</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900 text-white min-h-screen font-sans p-8">
        <h1 className="text-3xl font-bold mb-4">An Error Occurred</h1>
        <h2 className="text-xl font-semibold mb-2">Error Message:</h2>
        <pre className="bg-gray-800 p-4 rounded-lg whitespace-pre-wrap text-lg">
          <code>{error.message}</code>
        </pre>
      </div>
    );
  }

  const currentSong = roomData.queue[roomData.currentIndex];
  const remoteUrl = `${window.location.origin}/remote?roomId=${roomId}`;

  return (
    <div className="bg-gray-900 text-white min-h-screen font-sans">
      <header className="bg-gray-800 p-4">
        <h1 className="text-3xl font-bold text-center text-blue-400">
          T-Karaoke (Test Version)
        </h1>
      </header>

      <div className="flex flex-col md:flex-row p-4 gap-4">
        <main className="w-full md:w-2/3">
          <div className="bg-gray-800 p-4 rounded-lg mb-4">
            <div className="aspect-video w-full bg-black flex items-center justify-center rounded-lg">
              <p className="text-gray-400">Test Player Area</p>
            </div>
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
            <div className="bg-gray-700 p-4 rounded">
              <h3 className="text-xl font-semibold mb-2">Playlist</h3>
              <p>No songs in queue</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default TvViewTest;