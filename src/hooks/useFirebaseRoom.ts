import { useState, useEffect, useCallback } from 'react';
import { ref, onValue, runTransaction, set, DatabaseReference } from 'firebase/database';
import { database } from '../firebase';
import { RoomData, ExtendedSong } from '../types';
import { logger } from '../logger';

export const useFirebaseRoom = (roomId: string | null) => {
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) return;

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
        setError('Không thể kết nối tới phòng');
        logger.error('Firebase error:', err);
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

  const updateRoomData = useCallback(async (updates: Partial<RoomData>) => {
    if (!roomId) return;
    
    const roomRef = ref(database, 'rooms/' + roomId);
    await set(roomRef, { ...roomData, ...updates });
  }, [roomId, roomData]);

  return { roomData, error, updateQueue, updateRoomData };
};