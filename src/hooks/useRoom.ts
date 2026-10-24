import { useState, useEffect, useCallback } from 'react';
import { ref, onValue, runTransaction } from '../roomDatabase';
import { database } from '../roomDatabase';
import { RoomData, ExtendedSong } from '../types';
import { logger } from '../logger';

export const useRoom = (roomId: string | null) => {
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRoomData(null);
    setError(null);
    if (!roomId) {setError('Thiếu mã phòng. Hãy quét QR trên TV.');return;}

    const roomRef = ref(database, 'rooms/' + roomId);
    
    const unsubscribe = onValue(
      roomRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const normalizedData = {
            ...data,
            mode: data.mode ?? 'karaoke',
            currentPlaylistId: data.currentPlaylistId || null,
            queue: data.queue || [],
            currentIndex: data.currentIndex ?? -1,
            playing: data.playing ?? false
          };
          
          setRoomData(normalizedData);
          setError(null);
        } else {
          setError(`Phòng '${roomId}' không tồn tại`);
        }
      },
      (err) => {
        setError(err.message || 'Không thể kết nối tới phòng');
        logger.error('Room connection error:', err);
      }
    );

    return () => unsubscribe();
  }, [roomId]);

  const updateQueue = useCallback(async (updater: (queue: ExtendedSong[]) => ExtendedSong[]) => {
    if (!roomId) return;
    
    const roomRef = ref(database, 'rooms/' + roomId);
    await runTransaction(roomRef, (currentData) => {
      if (!currentData) return null;
      const newQueue = updater(currentData.queue || []);
      return { ...currentData, queue: newQueue };
    });
  }, [roomId]);

  const updateRoomData = useCallback(async (updates: Partial<RoomData> | ((current: RoomData) => Partial<RoomData>)) => {
    if (!roomId) return;
    
    const roomRef = ref(database, 'rooms/' + roomId);
    try {
      return await runTransaction(roomRef, current => ({...current, ...(typeof updates === 'function' ? updates(current) : updates)}));
    } catch(err) {setError(err instanceof Error ? err.message : 'Không thể cập nhật phòng.');throw err;}
  }, [roomId]);

  return { roomData, error, updateQueue, updateRoomData };
};