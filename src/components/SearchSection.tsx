import { Input, Button } from 'antd';
import { SearchOutlined, AudioOutlined, YoutubeOutlined, InfoCircleOutlined } from '@ant-design/icons';

interface SearchSectionProps {
  roomData: any;
  query: string;
  handleQueryChange: (value: string) => void;
  handleManualSearch: () => void;
  isRecording: boolean;
  handleVoiceSearch: () => void;
}

const SearchSection = ({
  roomData,
  query,
  handleQueryChange,
  handleManualSearch,
  isRecording,
  handleVoiceSearch
}: SearchSectionProps) => {
  return (
    <>
      {/* Search Input - only for karaoke mode */}
      {roomData?.mode === 'karaoke' && (
        <div className="remote-search">
          <Input
            aria-label="Tìm bài hát karaoke"
            placeholder="Nhập bài hát..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onPressEnter={handleManualSearch}
            size="large"
            className="
              search-input
              text-inherit
              border border-white/20
              rounded-xl
              backdrop-blur-sm
            "
            prefix={<SearchOutlined />}
            suffix={
              <Button
                type="text"
                aria-label="Voice Search"
                title="Tìm bằng giọng nói"
                className="hover:bg-white/10"
                icon={<AudioOutlined />}
                danger={isRecording}
                onClick={handleVoiceSearch}
              />
            }
          />
        </div>
      )}

      {/* Music Mode Search Input - specific for music mode */}
      {roomData?.mode === 'music' && (
        <div className="remote-search">
          <Input
            aria-label="Tìm bài hát hoặc playlist"
            placeholder="bài hát hoặc playlists..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onPressEnter={handleManualSearch}
            size="large"
            className="search-input"
            prefix={<YoutubeOutlined />}
            suffix={
              <Button
                type="text"
                aria-label="Voice Search"
                icon={<AudioOutlined />}
                danger={isRecording}
                onClick={handleVoiceSearch}
              />
            }
          />
        </div>
      )}
    </>
  );
};

export default SearchSection;