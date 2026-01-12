import React, { useRef, useState, useEffect } from 'react';
import ReactPlayer from 'react-player/youtube';
import { ExtendedSong } from './types';
import { logger } from './logger';

interface YouTubePlayerProps {
  song: ExtendedSong | undefined;
  playing: boolean;
  playRequestTimestamp?: number;
  onEnded: () => void;
  onError: (error: any) => void;
  className?: string;
}

const YouTubePlayer: React.FC<YouTubePlayerProps> = ({ song, playing, onEnded, onError, className, playRequestTimestamp }) => {
  const playerRef = useRef<ReactPlayer>(null);
  const [isReady, setIsReady] = useState(false);
  const prevPlayingRef = useRef(playing);

  useEffect(() => {
    // This effect manually controls playback to bypass browser autoplay policies
    // Check if playing state changed from false to true (a play request)
    const wasPlaying = prevPlayingRef.current;
    prevPlayingRef.current = playing;

    if (!isReady || !playerRef.current) {
      // If not ready but playing is true, we'll play when ready
      if (playing && !isReady) {
        // We'll handle this in handleReady
      }
      return;
    }

    const internalPlayer = playerRef.current.getInternalPlayer();
    if (!internalPlayer) {
      return;
    }

    if (playing) {
      if (typeof internalPlayer.playVideo === 'function') {
        internalPlayer.playVideo();
        logger.log('Playing video via manual control');
      }
    } else {
      if (typeof internalPlayer.pauseVideo === 'function') {
        internalPlayer.pauseVideo();
        logger.log('Pausing video via manual control');
      }
    }
  }, [playing, isReady, song]); // Depend on song object now

  const handleReady = () => {
    setIsReady(true);
    logger.log('Player is ready!');

    // If playing was requested while loading, play now
    if (playing) {
      const internalPlayer = playerRef.current?.getInternalPlayer();
      if (internalPlayer && typeof internalPlayer.playVideo === 'function') {
        internalPlayer.playVideo();
        logger.log('Playing video after ready');
      }
    }
  };

  const handleError = (error: any) => {
    logger.error("YouTube Player Error:", error);
    // Call the parent's error handler, which should trigger the next song
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
    <div className={`${className || 'aspect-video w-full'} bg-black rounded-lg overflow-hidden`}>
      <ReactPlayer
        ref={playerRef}
        url={`https://www.youtube.com/watch?v=${song.id}`}
        playing={playing} // Still pass playing prop, it's good for initial state
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
        }}
      />
    </div>
  );
};

export default YouTubePlayer;
