
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';



import Playlist from './Playlist';
import YouTubePlaylistManager from './YouTubePlaylistManager';
import { RoomData, ExtendedSong, RoomMode, BackgroundOption, YouTubePlaylist, Song } from './types';
import { logger } from './logger';
import { useSearch } from './useSearch';
import { useYouTubeAuth } from './useYouTubeAuth';
import { Button, Input, Tabs, Spin, Alert, Badge, Modal, Row, Col, Tag, Divider, List, Card, Avatar, Switch, Segmented } from 'antd';
import {
  SearchOutlined,
  AudioOutlined,
  StarFilled,
  PlusOutlined,
  SettingOutlined,
  PauseCircleFilled,
  PlayCircleFilled,
  StepBackwardFilled,
  StepForwardFilled,
  CopyOutlined,
  InfoCircleOutlined,
  WifiOutlined,
  UnorderedListOutlined,
  MoreOutlined,
  ClockCircleFilled,
  YoutubeOutlined,
  PlaySquareOutlined,
  UserOutlined,
  ImportOutlined,
  LogoutOutlined,
  SkinOutlined,
  DesktopOutlined,
  ToolOutlined
} from '@ant-design/icons';
import { debounce } from 'lodash';
import NowPlayingSection from './components/NowPlayingSection';
import SearchSection from './components/SearchSection';
import SettingsModal from './components/SettingsModal';
import { useRoom } from './hooks/useRoom';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import SearchTab from './components/SearchTab';
import RemoteHeader from './components/RemoteHeader';
import { animationStyles } from './styles/animationStyles';

const RemoteView = () => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'youtube-playlists' ? 'youtube-playlists' : 'playlist');
  const [showSettings, setShowSettings] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);

  const [showYouTubePlaylistManager, setShowYouTubePlaylistManager] = useState(false);
  const [userPlaylists, setUserPlaylists] = useState<YouTubePlaylist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);

  const { roomData, error: roomConnectionError, updateRoomData } = useRoom(searchParams.get('roomId'));
  const roomId = searchParams.get('roomId');

  const [background, setBackground] = useState(() => {
    const savedBgValue = localStorage.getItem('app-background') || 'bg-gray-50';
    const bgClassMap: Record<string, string> = {
      'bg-1': 'custom-bg-#f8cdcd',  // light pink
      'bg-2': 'custom-bg-#9617f7',  // purple
      'bg-3': 'custom-bg-#fcaff5',  // light pinkish
      'bg-4': 'custom-bg-#49f803',  // green
    };
    return bgClassMap[savedBgValue] || 'bg-gray-50'; // default fallback
  });


  const {
    query,
    setQuery,
    results: searchResults,
    loading: searchLoading,
    error: searchError,
    nextPageToken,
    search,
    lastKeyword,
    apiUsage,
    usageStats,
    canMakeRequest,
    clearResults,
    loadMore,
    setMode: setSearchMode,
    currentMode
  } = useSearch('karaoke');

  // Show connection and room access errors.
  useEffect(() => {
    if (roomConnectionError) {
      setRoomError(roomConnectionError);
    }
    else setRoomError(null);
  }, [roomConnectionError]);

  // Handle room mode changes, tab switching and debug search state
  useEffect(() => {
    if (!roomData) return;

    // Update search mode when room mode changes
    if (roomData.mode && roomData.mode !== currentMode) {
      setSearchMode(roomData.mode);
    }

    // Set initial tab based on mode if no tab is selected yet
    if (activeTab === 'playlist' && roomData.mode === 'music') {
      // Giữ nguyên tab playlist nếu đang ở tab playlist
    } else if (activeTab === 'playlist' && roomData.mode === 'karaoke') {
      // Giữ nguyên tab playlist nếu đang ở tab playlist
    }

    // Handle tab switching when mode changes
    if (roomData.mode === 'music') {
      // Trong chế độ music, không chuyển tab tự động
    } else if (roomData.mode === 'karaoke') {
      // Trong chế độ karaoke, không chuyển tab tự động
    }

    // Debug search state
    logger.debug('Search state:', {
      query,
      results: searchResults.length,
      loading: searchLoading,
      error: searchError,
      apiUsage,
      usageStats,
      lastKeyword
    });
  }, [roomData, activeTab, query, searchResults, searchLoading, searchError, apiUsage, usageStats, lastKeyword, currentMode, setSearchMode]);

  const {
    isAuthenticated,
    userInfo,
    login,
    logout,
    getAccessToken,
    isLoading: authLoading
  } = useYouTubeAuth();

  const lastSearchRef = useRef(0);

  // Tìm kiếm playlist trong chế độ music
  const searchMusicPlaylist = useCallback(async (keyword: string) => {
    if (!isAuthenticated) {
      Modal.warning({
        title: 'Yêu cầu đăng nhập',
        content: 'Vui lòng đăng nhập YouTube để tìm kiếm playlist.',
        okText: 'Đăng nhập',
        onOk: login
      });
      return;
    }

    setActiveTab('youtube-playlists');
    setLoadingPlaylists(true);

    try {
      const accessToken = getAccessToken();
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=playlist&q=${encodeURIComponent(keyword)}&maxResults=20`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
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

      setUserPlaylists(playlists);
    } catch (error) {
      logger.error('Error searching playlists:', error);
      Modal.error({
        title: 'Lỗi',
        content: 'Không thể tìm kiếm playlist. Vui lòng thử lại.'
      });
    } finally {
      setLoadingPlaylists(false);
    }
  }, [isAuthenticated, getAccessToken, login]);

  const handleVoiceResult = useCallback((transcript: string) => {
    setQuery(transcript);
    if (roomData?.mode === 'karaoke') {
      search(transcript);
      setActiveTab('search');
    } else {
      // Tìm kiếm trong chế độ music - ưu tiên tìm playlist
      searchMusicPlaylist(transcript);
    }
  }, [roomData?.mode, search, searchMusicPlaylist]);

  const { isRecording, startRecording, stopRecording } = useSpeechRecognition(handleVoiceResult);

  // Load user playlists khi đã xác thực
  useEffect(() => {
    if (isAuthenticated && roomData?.mode === 'music') {
      loadUserPlaylists();
    }
  }, [isAuthenticated, roomData?.mode]);

  // Load danh sách playlist của user
  const loadUserPlaylists = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoadingPlaylists(true);
    
    try {
      const accessToken = getAccessToken();
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&mine=true&maxResults=50`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
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
      setLoadingPlaylists(false);
    }
  }, [isAuthenticated, getAccessToken]);

  // Extract function to fetch playlist videos
  const fetchPlaylistVideos = useCallback(async (playlistId: string, accessToken: string): Promise<ExtendedSong[]> => {
    let videos: ExtendedSong[] = [];
    let nextPageToken = '';

    try {
      do {
        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!response.ok) throw new Error('YouTube API error');

        const data = await response.json();
        nextPageToken = data.nextPageToken || '';

        const playlistVideos: ExtendedSong[] = data.items.map((item: any) => ({
          id: item.snippet.resourceId.videoId,
          title: item.snippet.title,
          channelTitle: item.snippet.channelTitle,
          thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
          duration: '0:00',
          isPriority: false,
          type: 'youtube'
        }));

        videos = [...videos, ...playlistVideos];
      } while (nextPageToken);
    } catch (error) {
      logger.error('Error fetching playlist videos:', error);
      throw error;
    }

    return videos;
  }, []);

  // Import playlist vào queue
  const importPlaylist = useCallback(async (playlistId: string, playlistTitle: string) => {
    if (!roomId || !isAuthenticated || !roomData) return;

    Modal.confirm({
      title: 'Thêm playlist',
      content: `Thêm "${playlistTitle}" vào danh sách phát?`,
      okText: 'Thêm',
      icon: null,
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          const accessToken = getAccessToken();
          const videos = await fetchPlaylistVideos(playlistId, accessToken);

          await updateRoomData(current => {
            const oldQueue = current.queue || [];
            const isPlayingSomething = oldQueue.length > 0 && current.currentIndex !== -1;
            return {
              queue: [...oldQueue, ...videos],
              currentIndex: isPlayingSomething ? current.currentIndex : 0,
              playing: isPlayingSomething ? current.playing : true,
              currentPlaylistId: isPlayingSomething ? current.currentPlaylistId : playlistId
            };
          });

          Modal.success({
            title: 'Thành công',
            content: `Đã thêm ${videos.length} bài hát từ playlist.`
          });
        } catch (error) {
          logger.error('Error importing playlist:', error);
          Modal.error({
            title: 'Lỗi',
            content: 'Không thể import playlist. Vui lòng thử lại.'
          });
        }
      }
    });
  }, [roomId, roomData, isAuthenticated, getAccessToken, updateRoomData, fetchPlaylistVideos]);

  // Create debounced search function
  const debouncedSearch = useCallback(
    debounce((keyword: string) => {
      // Kiểm tra từ khóa
      if (!keyword) {
        logger.warn('Không có từ khóa tìm kiếm');
        return;
      }

      logger.debug('HandleManualSearch called with keyword:', keyword, 'and roomData mode:', roomData?.mode);

      // Luôn đảm bảo cập nhật tab trước khi tìm kiếm
      setActiveTab('search');

      // Trong cả hai chế độ, người dùng có thể tìm kiếm video
      // Nếu người dùng muốn tìm kiếm playlist cụ thể, họ có thể chuyển sang tab 'youtube-playlists'
      logger.debug('Executing video search for:', keyword);

      // Kiểm tra xem API có khả dụng không trước khi tìm kiếm
      if (canMakeRequest && typeof canMakeRequest === 'function') {
        const canSearch = canMakeRequest('search');
        logger.debug('Can make search request:', canSearch);

        if (!canSearch) {
          logger.warn('Không thể tìm kiếm do đã đạt giới hạn API');
          Modal.warning({
            title: 'Đã đạt giới hạn API',
            content: 'Bạn đã đạt đến giới hạn tìm kiếm trong ngày. Vui lòng thử lại vào ngày mai.',
          });
          return;
        }
      }

      // Gọi tìm kiếm video
      // Thêm logging để theo dõi việc gọi search
      logger.debug('Calling search function with keyword:', keyword);
      search(keyword); // useSearch hook only accepts 2 parameters: rawQuery and pageToken
    }, 300),
    [search, roomData, canMakeRequest]
  );

  const handleManualSearch = useCallback(() => {
    const keyword = query.trim();
    debouncedSearch(keyword);
  }, [query, debouncedSearch]);

  // Handle query change with debouncing
  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    if (value.trim()) {
      debouncedSearch(value.trim());
    }
  }, [setQuery, debouncedSearch]);

  const handleAddSong = useCallback(async (song: ExtendedSong) => {
    if (!roomId || !roomData) return;

    try {
      await updateRoomData(current => {
        const queue = current.queue || [];
        if (queue.some(s => s.id === song.id)) return {};
        return {queue:[...queue,song],currentIndex:current.currentIndex === -1 ? 0 : current.currentIndex,
          playing:current.currentIndex === -1 ? true : current.playing,currentPlaylistId:undefined};
      });
    } catch (err) {
      Modal.error({
        title: 'Lỗi',
        content: 'Thêm bài hát thất bại.'
      });
      logger.error('Failed to add song:', err);
    }
  }, [roomId, roomData, updateRoomData]);

  const handleSetPriority = useCallback((songToPrioritize: ExtendedSong) => {
    if (!roomId) return;
    void updateRoomData(current => {
      const queue = [...(current.queue || [])];
      const playingId = queue[current.currentIndex]?.id;
      const index = queue.findIndex(song => song.id === songToPrioritize.id);
      if (index === current.currentIndex && index !== -1) return {};
      const chosen = index === -1 ? {...songToPrioritize,isPriority:true} : {...queue.splice(index,1)[0]};
      if (index !== -1) chosen.isPriority = !chosen.isPriority;
      const playingIndex = playingId ? queue.findIndex(song => song.id === playingId) : -1;
      queue.splice(chosen.isPriority ? Math.max(0,playingIndex+1) : Math.max(0,index),0,chosen);
      return {queue:queue.map(song=>({...song,isPriority:song.id===chosen.id?chosen.isPriority:false})),
        currentIndex:playingId ? queue.findIndex(song=>song.id===playingId) : -1};
    }).catch(()=>{});
  }, [roomId, updateRoomData]);

  const handleRemoveSong = useCallback((songId: string) => {
    if (!roomId) return;
    void updateRoomData(current => {
      const queue = current.queue || [];
      const removedIndex = queue.findIndex(song => song.id === songId);
      if (removedIndex === -1) return {};
      const next = queue.filter(song=>song.id!==songId);
      let index = current.currentIndex;
      if (removedIndex < index) index--;
      else if (removedIndex === index) index = next.length ? index % next.length : -1;
      return {queue:next,currentIndex:index,playing:next.length>0&&current.playing};
    }).catch(()=>{});
  }, [roomId, updateRoomData]);

  const handleVoiceSearch = useCallback(() => {
    if (typeof (window as any).SpeechRecognition === 'undefined' &&
        typeof (window as any).webkitSpeechRecognition === 'undefined') {
      Modal.error({
        title: 'Lỗi',
        content: 'Trình duyệt của bạn không hỗ trợ tìm kiếm bằng giọng nói.'
      });
      return;
    }

    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const handlePlayerControl = useCallback((action: 'toggle' | 'next' | 'prev') => {
    if (!roomId) return;
    void updateRoomData(current => {
      if (action === 'toggle') return {playing:!current.playing};
      const queue=current.queue || [];
      if(!queue.length) return {};
      return {currentIndex:(current.currentIndex+(action==='next'?1:-1)+queue.length)%queue.length};
    }).catch(()=>{});
  }, [roomId, updateRoomData]);

  const handlePlaySong = useCallback(async (song: ExtendedSong) => {
    if (!roomId) return;
    try {
      await updateRoomData(current => ({queue:[...(current.queue||[]),song],
        currentIndex:current.currentIndex===-1?0:current.currentIndex,
        playing:current.currentIndex===-1?true:current.playing,currentPlaylistId:undefined}));
      setActiveTab('playlist');
      Modal.success({title:'Đã thêm vào danh sách phát',content:`"${song.title}" sẽ sớm được phát.`});
    } catch (err) {Modal.error({title:'Lỗi',content:'Không thể thêm bài hát vào danh sách phát.'});}
  }, [roomId, updateRoomData]);


  const SongListItemComponent = ({ song }: { song: ExtendedSong }) => (
    <div
      className="room-search-song playlist-item group"
      onClick={() => handlePlaySong(song)} // Added onClick handler
    >
      <img
        src={song.thumbnail}
        alt={song.title}
        className="playlist-thumb"
        loading="lazy"
      />
      <div className="flex-1 min-w-0">
        <p className={`font-semibold break-words ${song.isPriority ? 'text-yellow-600' : 'text-gray-800'}`}>
          {song.title}
        </p>
        <p className="text-sm truncate text-gray-600">{song.channelTitle}</p>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="text"
          icon={<PlusOutlined />}
          onClick={(e) => { e.stopPropagation(); handleAddSong(song); }} // Stop propagation
          title="Add to queue"
          aria-label="Add to queue"
          className="icon-only"
          style={{ color: '#9710F6' }}
        />
        <Button
          type="text"
          icon={<StarFilled />}
          onClick={(e) => { e.stopPropagation(); handleSetPriority(song); }} // Stop propagation
          title="Prioritize"
          aria-label="Prioritize"
          className={`icon-only ${song.isPriority ? 'text-yellow-400' : ''}`}
          style={{ color: song.isPriority ? '#9710F6' : '#9710F680' }}
        />
      </div>
    </div>
  );

  const SongListItem = useMemo(() => React.memo(SongListItemComponent), [handleAddSong, handleSetPriority, handlePlaySong, roomData?.mode]);

  const PlaylistItemComponent = ({ playlist }: { playlist: YouTubePlaylist }) => (
    <Card
      hoverable
      className="mb-3"
      onClick={() => importPlaylist(playlist.id, playlist.title)}
    >
      <div className="flex items-center">
        <img
          src={playlist.thumbnail}
          alt={playlist.title}
          className="w-16 h-16 rounded-lg object-cover mr-4"
        />
        <div className="flex-1">
          <h4 className="font-semibold mb-1 line-clamp-1">{playlist.title}</h4>
          <p className="text-gray-500 text-sm line-clamp-2">{playlist.description}</p>
          <div className="flex items-center mt-2">
            <Tag color="blue">{playlist.itemCount} bài hát</Tag>
            {playlist.id === roomData?.currentPlaylistId && (
              <Tag color="green" className="ml-2">Đang phát</Tag>
            )}
          </div>
        </div>
        <Button type="text" icon={<ImportOutlined />} />
      </div>
    </Card>
  );

  const PlaylistItem = useMemo(() => React.memo(PlaylistItemComponent), [importPlaylist, roomData?.currentPlaylistId]);

  const tabItems = useMemo(() => {
    const items = [];

    // Tab tìm kiếm cho cả chế độ karaoke và music
    if (roomData?.mode === 'karaoke' || roomData?.mode === 'music') {
      items.push({
        key: 'search',
        label: (
          <Badge count={searchResults.length} overflowCount={99}>
            <SearchOutlined /> Tìm kiếm
          </Badge>
        ),
        children: (
          <SearchTab
            searchResults={searchResults}
            searchLoading={searchLoading}
            searchError={searchError}
            nextPageToken={nextPageToken}
            loadMore={loadMore}
            SongListItem={SongListItem}
          />
        )
      });
    }

    // Tab playlist YouTube cho chế độ music
    if (roomData?.mode === 'music') {
      items.push({
        key: 'youtube-playlists',
        label: (
          <Badge count={userPlaylists.length}>
            <YoutubeOutlined /> Playlist
          </Badge>
        ),
        children: (
          <div className="max-h-[calc(100vh-220px)] pr-2 tabs-content-scrollable">
            <div className="mb-4">
              {isAuthenticated ? (
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    {userInfo?.picture && (
                      <Avatar src={userInfo.picture} className="mr-2" />
                    )}
                    <span>{userInfo?.name}</span>
                  </div>
                  <Button
                    type="text"
                    icon={<LogoutOutlined />}
                    onClick={logout}
                    danger
                  >
                    Đăng xuất
                  </Button>
                </div>
              ) : (
                <Button
                  type="primary"
                  icon={<YoutubeOutlined />}
                  onClick={login}
                  loading={authLoading}
                  className="w-full mb-4"
                >
                  Đăng nhập YouTube
                </Button>
              )}
            </div>

            <Spin spinning={loadingPlaylists}>
              <div className="space-y-3">
                {userPlaylists.map(playlist => (
                  <PlaylistItem key={playlist.id} playlist={playlist} />
                ))}
              </div>
              {userPlaylists.length === 0 && isAuthenticated && (
                <Alert
                  message="Chưa có playlist"
                  description="Bạn chưa có playlist nào hoặc không có quyền truy cập."
                  type="info"
                  showIcon
                />
              )}
            </Spin>
          </div>
        )
      });
    }

    // Luôn có tab danh sách phát bất kể chế độ nào
    items.push({
      key: 'playlist',
      label: (
        <Badge count={roomData?.queue?.length || 0}>
          <UnorderedListOutlined /> Danh sách
        </Badge>
      ),
      children: (
        <div className="max-h-[calc(100vh-220px)] pr-2 tabs-content-scrollable">
          {roomData ? (
            <Playlist
              songs={roomData.queue || []}
              currentSong={roomData.queue?.[roomData.currentIndex]}
              onRemoveSong={handleRemoveSong}
              onSetPriority={handleSetPriority}
              mode={roomData.mode}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p>Đang tải danh sách phát...</p>
            </div>
          )}
        </div>
      )
    });

    return items;
  }, [
    roomData?.mode,
    roomData?.queue?.length,
    roomData?.currentIndex,
    roomData?.currentPlaylistId,
    searchResults.length,
    searchLoading,
    searchError,
    nextPageToken,
    userPlaylists.length,
    isAuthenticated,
    userInfo,
    authLoading,
    loadingPlaylists,
    loadMore,
    SongListItem,
    PlaylistItem,
    handleRemoveSong,
    handleSetPriority,
    login,
    logout,
    importPlaylist
  ]);

  const getBackgroundClass = (bgValue: string): string => {
    const bgClassMap: Record<string, string> = {
      'bg-1': 'custom-bg-#f8cdcd',  // light pink
      'bg-2': 'custom-bg-#9617f7',  // purple
      'bg-3': 'custom-bg-#fcaff5',  // light pinkish
      'bg-4': 'custom-bg-#49f803',  // green
    };
    return bgClassMap[bgValue] || 'bg-gray-50'; // default fallback
  };

  const handleThemeChange = useCallback((newTheme: string, newBackground?: string) => {
    if (newBackground) {
      localStorage.setItem('app-background', newBackground);
      setBackground(getBackgroundClass(newBackground));
    }
  }, [getBackgroundClass]);

  const handleResetApiUsage = useCallback(() => {
    localStorage.removeItem('ytApiUsage');
    localStorage.removeItem('lastApiReset');
    // Xóa tất cả các cache tìm kiếm
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('yt_search_cache_')) {
        localStorage.removeItem(key);
      }
    });
    window.location.reload(); // Reload để cập nhật lại trạng thái
  }, []);

  const backgroundOptions: BackgroundOption[] = useMemo(() => [
    { label: 'bg1', value: 'bg-1', theme: 'dark' },
    { label: 'bg2', value: 'bg-2', theme: 'dark' },
    { label: 'bg3', value: 'bg-3', theme: 'light' },
    { label: 'bg4', value: 'bg-4', theme: 'light' },
  ], []);

  // State to manage guide visibility
  const [showGuide, setShowGuide] = useState(false);

  // Listen for changes to app-background in localStorage from other tabs/windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'app-background' && e.newValue) {
        setBackground(getBackgroundClass(e.newValue));
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [getBackgroundClass]);

  // Animation effect for buttons
  useEffect(() => {
    const styleId = 'remote-view-animations';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = animationStyles;
      document.head.appendChild(style);
    }

    // Clean up
    return () => {
      const style = document.getElementById(styleId);
      if (style) {
        document.head.removeChild(style);
      }
    };
  }, []);

  const currentSong = roomData?.queue?.[roomData?.currentIndex ?? -1];

  return (
    <div
      data-theme={localStorage.getItem('app-theme') || 'light'}
      className={`remote-view-container text-gray-800 p-2 ${background.startsWith('custom-bg-') ? 'custom-background' : background}`}
      style={background.startsWith('custom-bg-') ? { backgroundColor: background.replace('custom-bg-', '') } : {}}
    >
      {roomError && <Alert type="error" showIcon message={roomError} style={{marginBottom:12}} />}
      <RemoteHeader setShowSettings={setShowSettings} roomId={roomId} mode={roomData?.mode} />
      
      {/* Now Playing Section */}
      <NowPlayingSection
        currentSong={currentSong}
        roomData={roomData}
        handlePlayerControl={handlePlayerControl}
      />

      <SearchSection
        roomData={roomData}
        query={query}
        handleQueryChange={handleQueryChange}
        handleManualSearch={handleManualSearch}
        isRecording={isRecording}
        handleVoiceSearch={handleVoiceSearch}
      />

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        centered
        className="remote-tabs flex-grow flex flex-col"
        tabBarStyle={{ flexShrink: 0 }}
      />
      
      {/* Settings Modal */}
      <SettingsModal
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        backgroundOptions={backgroundOptions}
        background={background}
        handleThemeChange={handleThemeChange}
        roomData={roomData}
        roomId={roomId}
        apiUsage={apiUsage}
        handleResetApiUsage={handleResetApiUsage}
        setActiveTab={setActiveTab}
        search={search}
        query={query}
      />

      {/* YouTube Playlist Manager Modal */}
      <Modal
        title="YouTube Playlist Manager"
        open={showYouTubePlaylistManager}
        onCancel={() => setShowYouTubePlaylistManager(false)}
        width="90%"
        style={{ maxWidth: 800 }}
        footer={null}
      >
        <YouTubePlaylistManager
          isAuthenticated={isAuthenticated}
          userInfo={userInfo}
          onLogin={login}
          onLogout={logout}
          onImportPlaylist={importPlaylist}
          currentPlaylistId={roomData?.currentPlaylistId}
        />
      </Modal>
    </div>
  );
};

export default RemoteView;
