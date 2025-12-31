import React, { useRef, useState, useEffect } from 'react';
import ReactPlayer from 'react-player/youtube';
import { Song } from './types';
import { logger } from './logger';

interface YouTubePlayerProps {
  song: Song | undefined;
  playing: boolean;
  onEnded: () => void;
  onError: (error: any) => void;
  className?: string;
}

const YouTubePlayer: React.FC<YouTubePlayerProps> = ({ song, playing, onEnded, onError, className }) => {
  const playerRef = useRef<ReactPlayer>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (isReady && song) {
      // The 'playing' prop should handle this automatically.
    }
  }, [isReady, song, playing]);

  const handleReady = () => {
    setIsReady(true);
    logger.log('Player is ready!');
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
        playing={playing}
        controls={true}
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
