import React, { forwardRef, useRef, useState, useEffect, useImperativeHandle } from 'react';
import ReactPlayer from 'react-player/youtube';
import { ExtendedSong } from './types';
import { logger } from './logger';
import { useBackgroundPlayback } from './hooks/useBackgroundPlayback';

interface YouTubePlayerProps {
  song: ExtendedSong | undefined;
  playing: boolean;
  playRequestTimestamp?: number;
  onEnded: () => void;
  onError: (error: any) => void;
  onPlayingChange: (playing: boolean) => void;
  onStreamAvailable?: (stream: MediaStream) => void;
  className?: string;
  foregroundOnly?: boolean;
}

export interface YouTubePlayerHandle {
  getCurrentTime(): number;
  seekTo(seconds: number): void;
  play(): void;
  pause(): void;
}

const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(({ song, playing, onEnded, onError, onPlayingChange, className, onStreamAvailable, foregroundOnly }, ref) => {
  const playerRef = useRef<ReactPlayer>(null);
  const [isReady, setIsReady] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const backgroundPlayback = useBackgroundPlayback({
    song, playing, ready: isReady, foregroundOnly,
    getPlayer: () => playerRef.current?.getInternalPlayer(),
    onPlayingChange, onNext: onEnded,
  });

  useImperativeHandle(ref, () => ({
    getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
    seekTo: (seconds: number) => { playerRef.current?.seekTo(seconds, 'seconds'); },
    play: () => { playerRef.current?.getInternalPlayer()?.playVideo?.(); },
    pause: () => { playerRef.current?.getInternalPlayer()?.pauseVideo?.(); },
  }), []);


  useEffect(() => {
    if (!isReady || !playerRef.current) {
      return;
    }

    const internalPlayer = playerRef.current.getInternalPlayer();
    if (!internalPlayer) {
      return;
    }
    
    if (playing) {
      internalPlayer.unMute?.();
      internalPlayer.setVolume?.(100);
      if (typeof internalPlayer.playVideo === 'function') {
        internalPlayer.playVideo();
        logger.log('Playing video via manual control');
      }
    } else {
      setNeedsGesture(false);
      if (typeof internalPlayer.pauseVideo === 'function') {
        internalPlayer.pauseVideo();
        logger.log('Pausing video via manual control');
      }
    }
    const timer = window.setTimeout(() => {
      if (playing && internalPlayer.getPlayerState?.() !== 1) setNeedsGesture(true);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [playing, isReady, song?.id]);

  const handleReady = () => {
    setIsReady(true);
    logger.log('Player is ready!');
    if (playing) {
      const internalPlayer = playerRef.current?.getInternalPlayer();
      if (internalPlayer && typeof internalPlayer.playVideo === 'function') {
        internalPlayer.unMute?.();
        internalPlayer.setVolume?.(100);
        internalPlayer.playVideo();
      }
    }

    // Get the audio stream
    if (playerRef.current && onStreamAvailable) {
      const internalPlayer = playerRef.current.getInternalPlayer();
      if (internalPlayer && typeof internalPlayer.getMediaElement === 'function') {
        const videoElement = internalPlayer.getMediaElement();
        if (videoElement && typeof videoElement.captureStream !== 'function') {
          // @ts-ignore
          videoElement.captureStream = videoElement.captureStream || videoElement.mozCaptureStream;
        }

        if (videoElement && typeof videoElement.captureStream === 'function') {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
          }
          streamRef.current = videoElement.captureStream();
          if (streamRef.current) {
            onStreamAvailable(streamRef.current);
          }
        }
      }
    }
  };

  const handleError = (error: any) => {
    logger.error("YouTube Player Error:", error);
    onError(error);
  };

  if (!song) {
    return (
      <div className="aspect-video w-full bg-black flex items-center justify-center rounded-lg">
        <p className="text-gray-400">Đang chờ bài hát...</p>
      </div>
    );
  }

  return (
    <div className={`${className || 'aspect-video w-full'} relative bg-black rounded-lg overflow-hidden`}>
      <ReactPlayer
        ref={playerRef}
        url={`https://www.youtube.com/watch?v=${song.id}`}
        playing={playing}
        muted={false}
        volume={1}
        playsinline
        onPlay={() => { setNeedsGesture(false); backgroundPlayback.onPlay(); }}
        onPause={backgroundPlayback.onPause}
        controls={false}
        width="100%"
        height="100%"
        onReady={handleReady}
        onEnded={onEnded}
        onError={handleError}
        config={{
          youtube: {
            playerVars: {
              modestbranding: 1,
              rel: 0,
              showinfo: 0
            }
          }
        } as any}
      />
      {needsGesture && playing && <button
        className="absolute inset-0 z-50 bg-black/70 text-white text-xl p-6"
        onClick={() => {
          const player=playerRef.current?.getInternalPlayer();
          player?.unMute?.(); player?.setVolume?.(100); player?.playVideo?.();
          setNeedsGesture(false);
        }}
      >Bấm để bật âm thanh</button>}
    </div>
  );
});

YouTubePlayer.displayName = 'YouTubePlayer';

export default YouTubePlayer;

