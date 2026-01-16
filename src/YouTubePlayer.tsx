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
  onStreamAvailable?: (stream: MediaStream) => void;
  className?: string;
}

const YouTubePlayer: React.FC<YouTubePlayerProps> = ({ song, playing, onEnded, onError, className, onStreamAvailable }) => {
  const playerRef = useRef<ReactPlayer>(null);
  const [isReady, setIsReady] = useState(false);
  const prevPlayingRef = useRef(playing);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const wasPlaying = prevPlayingRef.current;
    prevPlayingRef.current = playing;

    if (!isReady || !playerRef.current) {
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
  }, [playing, isReady, song]);

  const handleReady = () => {
    setIsReady(true);
    logger.log('Player is ready!');
    if (playing) {
      const internalPlayer = playerRef.current?.getInternalPlayer();
      if (internalPlayer && typeof internalPlayer.playVideo === 'function') {
        internalPlayer.playVideo();
        logger.log('Playing video after ready');
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
    <div className={`${className || 'aspect-video w-full'} bg-black rounded-lg overflow-hidden`}>
      <ReactPlayer
        ref={playerRef}
        url={`https://www.youtube.com/watch?v=${song.id}`}
        playing={playing}
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
    </div>
  );
};

export default YouTubePlayer;

