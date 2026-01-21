import React, { useState, useCallback } from 'react';
import { Input, Button, List, Card, Tag, Avatar, Spin, Alert, Modal } from 'antd';
import { SearchOutlined, ImportOutlined, PlayCircleOutlined, UserOutlined } from '@ant-design/icons';
import { ExtendedSong, YouTubePlaylist } from '../types';
import { useYouTubeAuth } from '../useYouTubeAuth';
import { logger } from '../logger';

interface MusicSearchProps {
  onImportPlaylist: (playlistId: string, playlistTitle: string) => void;
  onAddTrack: (track: ExtendedSong) => void;
  currentPlaylistId?: string;
}

const MusicSearch: React.FC<MusicSearchProps> = ({ 
  onImportPlaylist, 
  onAddTrack, 
  currentPlaylistId 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<YouTubePlaylist[]>([]);
  const [tracksResults, setTracksResults] = useState<ExtendedSong[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'playlists' | 'tracks'>('playlists');
  
  const { 
    isAuthenticated, 
    userInfo, 
    login, 
    logout 
  } = useYouTubeAuth();

  const searchPlaylists = useCallback(async (query: string) => {
    if (!isAuthenticated || !query.trim()) return;

    setLoading(true);
    try {
      const accessToken = localStorage.getItem('youtube_access_token');
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=playlist&q=${encodeURIComponent(query)}&maxResults=20`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!response.ok) throw new Error('YouTube API error');

      const data = await response.json();
      const playlists: YouTubePlaylist[] = data.items.map((item: any) => ({
        id: item.id.playlistId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
        itemCount: 0
      }));

      setSearchResults(playlists);
    } catch (error) {
      logger.error('Error searching playlists:', error);
      Modal.error({
        title: 'Lỗi',
        content: 'Không thể tìm kiếm playlist. Vui lòng thử lại.'
      });
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const searchTracks = useCallback(async (query: string) => {
    if (!isAuthenticated || !query.trim()) return;

    setLoading(true);
    try {
      const accessToken = localStorage.getItem('youtube_access_token');
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query)}&maxResults=20`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!response.ok) throw new Error('YouTube API error');

      const data = await response.json();
      const tracks: ExtendedSong[] = data.items.map((item: any) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
        duration: '0:00',
        isPriority: false,
        type: 'youtube'
      }));

      setTracksResults(tracks);
    } catch (error) {
      logger.error('Error searching tracks:', error);
      Modal.error({
        title: 'Lỗi',
        content: 'Không thể tìm kiếm bài hát. Vui lòng thử lại.'
      });
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    
    if (activeTab === 'playlists') {
      searchPlaylists(searchQuery);
    } else {
      searchTracks(searchQuery);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const renderPlaylistItem = (playlist: YouTubePlaylist) => (
    <List.Item
      className="cursor-pointer hover:bg-gray-50 p-2 rounded-lg"
      onClick={() => onImportPlaylist(playlist.id, playlist.title)}
    >
      <div className="flex items-center w-full">
        <img
          src={playlist.thumbnail}
          alt={playlist.title}
          className="w-16 h-16 rounded-lg object-cover"
        />
        <div className="ml-4 flex-1">
          <h4 className="font-semibold mb-1 line-clamp-1">{playlist.title}</h4>
          <p className="text-gray-600 text-sm line-clamp-2 mb-2">{playlist.description}</p>
          <div className="flex items-center">
            <Tag color="blue" className="mr-2">
              {playlist.itemCount} bài hát
            </Tag>
            {playlist.id === currentPlaylistId && (
              <Tag color="green">Đang phát</Tag>
            )}
          </div>
        </div>
        <Button type="text" icon={<ImportOutlined />} />
      </div>
    </List.Item>
  );

  const renderTrackItem = (track: ExtendedSong) => (
    <List.Item
      className="cursor-pointer hover:bg-gray-50 p-2 rounded-lg"
      onClick={() => onAddTrack(track)}
    >
      <div className="flex items-center w-full">
        <img
          src={track.thumbnail}
          alt={track.title}
          className="w-16 h-16 rounded-lg object-cover"
        />
        <div className="ml-4 flex-1">
          <h4 className="font-semibold mb-1 line-clamp-1">{track.title}</h4>
          <p className="text-gray-600 text-sm">{track.channelTitle}</p>
        </div>
        <Button type="text" icon={<PlayCircleOutlined />} />
      </div>
    </List.Item>
  );

  if (!isAuthenticated) {
    return (
      <div className="text-center py-8">
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Tìm kiếm nhạc</h3>
          <p className="text-gray-600 mb-6">
            Đăng nhập để tìm kiếm và thêm playlist hoặc bài hát vào danh sách phát
          </p>
          <Button
            type="primary"
            icon={<UserOutlined />}
            onClick={login}
            size="large"
          >
            Đăng nhập YouTube
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            {userInfo?.picture ? (
              <Avatar src={userInfo.picture} size="large" className="mr-3" />
            ) : (
              <Avatar icon={<UserOutlined />} size="large" className="mr-3" />
            )}
            <div>
              <h3 className="font-semibold">{userInfo?.name}</h3>
              <p className="text-gray-600 text-sm">{userInfo?.email}</p>
            </div>
          </div>
          <Button icon={<UserOutlined />} onClick={logout}>
            Đăng xuất
          </Button>
        </div>

        <div className="flex mb-4">
          <Input
            placeholder="Tìm kiếm playlist hoặc bài hát..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 mr-2"
          />
          <Button icon={<SearchOutlined />} onClick={handleSearch} loading={loading}>
            Tìm kiếm
          </Button>
        </div>

        <div className="flex space-x-2 mb-4">
          <Button 
            type={activeTab === 'playlists' ? 'primary' : 'default'}
            onClick={() => setActiveTab('playlists')}
          >
            Playlist
          </Button>
          <Button 
            type={activeTab === 'tracks' ? 'primary' : 'default'}
            onClick={() => setActiveTab('tracks')}
          >
            Bài hát
          </Button>
        </div>
      </div>

      <Spin spinning={loading}>
        {activeTab === 'playlists' ? (
          <div>
            {searchResults.length > 0 ? (
              <List
                dataSource={searchResults}
                renderItem={renderPlaylistItem}
                className="max-h-[calc(100vh-350px)] overflow-y-auto"
              />
            ) : (
              <Alert
                message="Nhập từ khóa để tìm kiếm playlist"
                description="Tìm kiếm playlist công khai từ YouTube"
                type="info"
                showIcon
              />
            )}
          </div>
        ) : (
          <div>
            {tracksResults.length > 0 ? (
              <List
                dataSource={tracksResults}
                renderItem={renderTrackItem}
                className="max-h-[calc(100vh-350px)] overflow-y-auto"
              />
            ) : (
              <Alert
                message="Nhập từ khóa để tìm kiếm bài hát"
                description="Tìm kiếm bài hát công khai từ YouTube"
                type="info"
                showIcon
              />
            )}
          </div>
        )}
      </Spin>
    </div>
  );
};

export default MusicSearch;