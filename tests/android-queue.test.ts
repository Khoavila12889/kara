import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enqueue, removeSong, nextSong } from '../src/android/queue.ts';

const song = (id: string, isPriority = false) => ({ id, title: id, isPriority });
const state = () => ({ queue: [song('a'), song('b'), song('c')], currentIndex: 1, playing: true, mode: 'music' as const });
test('first addition starts music and duplicates do not reset playback', () => {
  const empty = { ...state(), queue: [], currentIndex: -1, playing: false };
  const added = enqueue(empty, song('a'));
  assert.equal(added.currentIndex, 0); assert.equal(added.playing, true);
  assert.deepEqual(enqueue(added, song('a')), added);
  assert.equal(empty.queue.length, 0);
});
test('removing an earlier song preserves the selected track', () => {
  const result = removeSong(state(), 'a');
  assert.equal(result.currentIndex, 0); assert.equal(result.queue[0].id, 'b'); assert.equal(result.playing, true);
});
test('next selects priority and stops when queue is exhausted', () => {
  const result = nextSong({ ...state(), queue: [song('a'), song('b'), song('c', true)] });
  assert.equal(result.queue[result.currentIndex].id, 'c');
  const last = nextSong({ ...state(), queue: [song('a')], currentIndex: 0 });
  assert.deepEqual(last.queue, []); assert.equal(last.currentIndex, -1); assert.equal(last.playing, false);
});
test('removing paused current track does not unexpectedly start playback', () => {
  const result = removeSong({ ...state(), playing: false }, 'b');
  assert.equal(result.playing, false); assert.equal(result.queue[result.currentIndex].id, 'c');
});
