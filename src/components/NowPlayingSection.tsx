import { Button } from 'antd';
import { PlayCircleFilled, PauseCircleFilled, StepBackwardFilled, StepForwardFilled, AudioOutlined } from '@ant-design/icons';
import { ExtendedSong } from '../types';

interface NowPlayingSectionProps {
  currentSong: ExtendedSong | undefined;
  roomData: any;
  handlePlayerControl: (action: 'toggle' | 'next' | 'prev') => void;
}

const NowPlayingSection = ({ currentSong, roomData, handlePlayerControl }: NowPlayingSectionProps) => {
  return (
    <div className="now-playing-section now-playing-fixed p-4 bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 rounded-xl mb-4 shadow-lg backdrop-blur-sm sticky top-0 z-20">
      <div className="text-center">
        {currentSong ? (
          <>
            <p className={`text-sm font-medium mb-1 flex items-center absolute top-1 left-2 gap-4 ${roomData?.playing ? 'text-green-400' : 'text-yellow-400'}`}>
              {roomData?.playing ? <PlayCircleFilled className="animate-pulse" /> : <PauseCircleFilled />}
              {roomData?.playing ? 'Now Playing' : 'Paused'}
            </p>
            <div className="overflow-hidden w-full mt-4 mb-10">
              <div className={`animate-marquee whitespace-nowrap font-bold text-xl leading-tight text-[#1DB954] ${roomData?.playing ? '' : 'pause-marquee'}`}>
                {currentSong.title}
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-white/80 mb-1 flex items-center justify-center gap-2">
              <AudioOutlined /> Danh sách phát trống
            </p>
            <p className="font-semibold text-lg leading-tight text-white">
             Thêm bài hát để bắt đầu!
            </p>
          </>
        )}
      </div>

      <div className="flex justify-center items-center gap-10 mt-4">
        <Button
          type="text"
          shape="circle"
          aria-label="Previous Song"
          onClick={() => handlePlayerControl('prev')}
          disabled={!roomData?.queue?.length}
          className="
            w-12 h-12
            flex items-center justify-center
            bg-[#1DB954]
            text-white
            hover:bg-[#1ED760]
            transition-all duration-200

            disabled:opacity-40
            disabled:brightness-75
            disabled:saturate-50
            disabled:cursor-not-allowed
            disabled:hover:bg-[#1DB954]
          "
        >
          <StepBackwardFilled className="text-2xl text-white" />
        </Button>
        <Button
          type="text"
          shape="circle"
          aria-label={roomData?.playing ? 'Pause' : 'Play'}
          onClick={() => handlePlayerControl('toggle')}
          disabled={!roomData?.queue?.length}
          className="
            w-16 h-16
            flex items-center justify-center
            bg-[#1DB954]
            text-white
            hover:bg-[#1ED760]
            shadow-xl
            hover:scale-110
            transition-all duration-200

            disabled:opacity-50
            disabled:brightness-75
            disabled:saturate-50
            disabled:cursor-not-allowed
            disabled:hover:scale-100
            disabled:hover:bg-[#1DB954]
          "
        >
          {roomData?.playing ? (
            <PauseCircleFilled className="text-6xl text-white" />
          ) : (
            <PlayCircleFilled className="text-6xl text-white " />
          )}
        </Button>
        <Button
          type="text"
          shape="circle"
          aria-label="Next Song"
          onClick={() => handlePlayerControl('next')}
          disabled={!roomData?.queue?.length}
          className="
            w-12 h-12
            flex items-center justify-center
            bg-[#1DB954]
            text-white
            hover:bg-[#1ED760]
            transition-all duration-200

            disabled:opacity-40
            disabled:brightness-75
            disabled:saturate-50
            disabled:cursor-not-allowed
            disabled:hover:bg-[#1DB954]
          "
        >
          <StepForwardFilled className="text-2xl text-white" />
        </Button>
      </div>
    </div>
  );
};

export default NowPlayingSection;