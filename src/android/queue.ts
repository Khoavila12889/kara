import type { RoomData, ExtendedSong } from '../types';

// Pure transitions shared by touch, D-pad, player-ended and remote actions.
export function enqueue(state: RoomData, song: ExtendedSong): RoomData {
  const queue = state.queue.some(item => item.id === song.id) ? state.queue : [...state.queue, song];
  if (queue.length > 1000) throw new Error('Hàng đợi đã đủ 1000 bài.');
  return { ...state, queue, mode: 'music', currentIndex: state.currentIndex < 0 ? 0 : state.currentIndex,
    playing: state.currentIndex < 0 ? true : state.playing };
}

export function removeSong(state: RoomData, id: string): RoomData {
  const current = state.queue[state.currentIndex];
  const queue = state.queue.filter(song => song.id !== id);
  let currentIndex = current ? queue.findIndex(song => song.id === current.id) : -1;
  if (current?.id === id && queue.length) {
    currentIndex = queue.findIndex(song => song.isPriority);
    if (currentIndex < 0) currentIndex = Math.min(state.currentIndex, queue.length - 1);
  }
  return { ...state, queue, currentIndex, playing: currentIndex >= 0 && state.playing };
}

export function nextSong(state: RoomData): RoomData {
  const current = state.queue[state.currentIndex];
  return current ? removeSong(state, current.id) : state;
}
