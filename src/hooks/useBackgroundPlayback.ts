import { useEffect, useRef } from 'react';
import { ExtendedSong } from '../types';

interface PlaybackOptions {
  song?: ExtendedSong;
  playing: boolean;
  ready: boolean;
  getPlayer: () => any;
  onPlayingChange: (playing: boolean) => void;
  onNext: () => void;
}

// A Media Session exposes the embedded player to lock-screen/headset controls.
// It cannot prevent the browser or operating system from suspending a tab.
export function useBackgroundPlayback(options: PlaybackOptions) {
  const latest = useRef(options);
  latest.current = options;
  const resumeOnBackgroundPause = useRef(false);

  useEffect(() => {
    if (!options.playing) resumeOnBackgroundPause.current = false;
  }, [options.playing, options.song?.id]);

  useEffect(() => {
    resumeOnBackgroundPause.current = false;
    if (!options.song || !options.ready) return;
    const visibilityChanged = () => {
      const { playing, getPlayer } = latest.current;
      const player = getPlayer();
      if (document.visibilityState === 'hidden') {
        resumeOnBackgroundPause.current = playing && player?.getPlayerState?.() === 1;
      } else {
        const resume = resumeOnBackgroundPause.current;
        resumeOnBackgroundPause.current = false;
        if (resume && playing && player?.getPlayerState?.() === 2) player.playVideo?.();
      }
    };
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => {
      resumeOnBackgroundPause.current = false;
      document.removeEventListener('visibilitychange', visibilityChanged);
    };
  }, [options.song?.id, options.ready]);

  useEffect(() => {
    if (!options.song || !options.ready || !('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;
    if (typeof MediaMetadata !== 'undefined') {
      session.metadata = new MediaMetadata({
        title: options.song.title,
        artist: options.song.channelTitle || 'Khoavila',
        artwork: options.song.thumbnail ? [{ src: options.song.thumbnail }] : [],
      });
    }
    const changePlaying = (playing: boolean) => {
      resumeOnBackgroundPause.current = false;
      const { getPlayer, onPlayingChange } = latest.current;
      // Apply immediately during the media gesture, then sync the shared room.
      const player = getPlayer();
      if (playing) player?.playVideo?.();
      else player?.pauseVideo?.();
      onPlayingChange(playing);
    };
    const handlers: Partial<Record<MediaSessionAction, MediaSessionActionHandler>> = {
      play: () => changePlaying(true),
      pause: () => changePlaying(false),
      stop: () => changePlaying(false),
      nexttrack: () => {
        resumeOnBackgroundPause.current = false;
        latest.current.onNext();
      },
    };
    const installed: MediaSessionAction[] = [];
    for (const [action, handler] of Object.entries(handlers)) {
      try {
        session.setActionHandler(action as MediaSessionAction, handler);
        installed.push(action as MediaSessionAction);
      } catch { /* Some mobile browsers support only a subset of actions. */ }
    }
    return () => {
      for (const action of installed) session.setActionHandler(action, null);
      session.metadata = null;
      session.playbackState = 'none';
    };
  }, [options.song?.id, options.song?.title, options.song?.channelTitle, options.song?.thumbnail, options.ready]);

  const onPlay = () => {
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
  };
  const onPause = () => {
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    // Retry once per background transition, never on a timer. An explicit
    // lock-screen/remote pause disarms this before it reaches the player.
    if (document.visibilityState === 'hidden' && resumeOnBackgroundPause.current && latest.current.playing) {
      resumeOnBackgroundPause.current = false;
      latest.current.getPlayer()?.playVideo?.();
    }
  };
  return { onPlay, onPause };
}
