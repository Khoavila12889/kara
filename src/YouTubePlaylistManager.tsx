import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Input, List, Avatar, Tag, Spin, Alert, Modal, Tabs } from 'antd';
import {
  YoutubeOutlined,
  PlaySquareOutlined,
  ImportOutlined,
  SearchOutlined,
  UserOutlined,
  LogoutOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { YouTubePlaylist } from './types';
import { useYouTubeAuth } from './useYouTubeAuth';
import { logger } from './logger';

interface YouTubePlaylistManagerProps {
  isAuthenticated: boolean;
  userInfo: any;
  onLogin: () => void;
  onLogout: () => void;
  onImportPlaylist: (playlistId: string, playlistTitle: string) => void;
  currentPlaylistId?: string;
}

const YouTubePlaylistManager: React.FC<YouTubePlaylistManagerProps> = ({
  isAuthenticated,
  userInfo,
  onLogin,
  onLogout,
  onImportPlaylist,
  currentPlaylistId
}) => {
  const [userPlaylists, setUserPlaylists] = useState<YouTubePlaylist[]>([]);
  const [searchResults, setSearchResults] = useState<YouTubePlaylist[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('my-playlists');

  const loadUserPlaylists = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    try {
      const accessToken = localStorage.getItem('youtube_access_token');
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&mine=true&maxResults=50`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!response.ok) throw new Error('YouTube API error');

      const data = await response.json();
      const playlists: YouTubePlaylist[] = data.items.map((item: any) => ({
        id: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
        itemCount: item.contentDetails.itemCount
      }));

      setUserPlaylists(playlists);
    } catch (error) {
      logger.error('Error loading playlists:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

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
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && activeTab === 'my-playlists') {
      loadUserPlaylists();
    }
  }, [isAuthenticated, activeTab, loadUserPlaylists]);

  const handleSearch = useCallback(() => {
    if (searchQuery.trim()) {
      searchPlaylists(searchQuery);
      setActiveTab('search-results');
    }
  }, [searchQuery, searchPlaylists]);

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

  if (!isAuthenticated) {
    return (
      <div className="text-center py-8">
        <YoutubeOutlined className="text-4xl text-red-600 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Kết nối với YouTube</h3>
        <p className="text-gray-600 mb-6">
          Đăng nhập để truy cập playlist của bạn và import vào hệ thống
        </p>
        <Button
          type="primary"
          danger
          icon={<YoutubeOutlined />}
          onClick={onLogin}
          size="large"
        >
          Đăng nhập YouTube
        </Button>
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
          <Button icon={<LogoutOutlined />} onClick={onLogout}>
            Đăng xuất
          </Button>
        </div>

        <div className="flex mb-4">
          <Input
            placeholder="Tìm kiếm playlist..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onPressEnter={handleSearch}
            className="flex-1 mr-2"
          />
          <Button icon={<SearchOutlined />} onClick={handleSearch}>
            Tìm kiếm
          </Button>
        </div>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <Tabs.TabPane
          tab={
            <span>
              <PlaySquareOutlined /> Playlist của tôi
            </span>
          }
          key="my-playlists"
        >
          <Spin spinning={loading}>
            {userPlaylists.length > 0 ? (
              <List
                dataSource={userPlaylists}
                renderItem={renderPlaylistItem}
                className="max-h-96 overflow-y-auto"
              />
            ) : (
              <Alert
                message="Không có playlist"
                description="Bạn chưa có playlist nào trên YouTube"
                type="info"
                showIcon
              />
            )}
          </Spin>
        </Tabs.TabPane>

        <Tabs.TabPane
          tab={
            <span>
              <SearchOutlined /> Kết quả tìm kiếm
            </span>
          }
          key="search-results"
        >
          <Spin spinning={loading}>
            {searchResults.length > 0 ? (
              <List
                dataSource={searchResults}
                renderItem={renderPlaylistItem}
                className="max-h-96 overflow-y-auto"
              />
            ) : (
              <Alert
                message="Nhập từ khóa để tìm kiếm playlist"
                description="Tìm kiếm playlist công khai từ YouTube"
                type="info"
                showIcon
              />
            )}
          </Spin>
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default YouTubePlaylistManager;