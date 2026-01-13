import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ref, onValue, runTransaction, set } from 'firebase/database';
import { database } from './firebase';
import { DatabaseReference } from 'firebase/database';
import Playlist from './Playlist';
import YouTubePlaylistManager from './YouTubePlaylistManager';
import { Song, ExtendedSong, RoomMode } from './types';
import { logger } from './logger';
import { useSearch } from './useSearch';
import { useYouTubeAuth } from './useYouTubeAuth';
import { Button, Input, Tabs, Spin, Alert, Badge, Modal, Row, Col, Tag, Divider, List, Card, Avatar } from 'antd';
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
  LogoutOutlined
} from '@ant-design/icons';

interface RoomData {
  queue: ExtendedSong[];
  currentIndex: number;
  playing: boolean;
  mode?: RoomMode;
  musicSource?: {
    type: 'playlist' | 'channel';
    id: string;
  };
  currentPlaylistId?: string;
}

interface BackgroundOption {
  label: string;
  value: string;
  theme: 'dark' | 'light';
}

interface YouTubePlaylist {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  itemCount: number;
}

const RemoteView = () => {
  const [searchParams] = useSearchParams();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [activeTab, setActiveTab] = useState('playlist'); // Mặc định hiển thị playlist trong music mode
  const [showSettings, setShowSettings] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showYouTubePlaylistManager, setShowYouTubePlaylistManager] = useState(false);
  const [userPlaylists, setUserPlaylists] = useState<YouTubePlaylist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);

  const theme = useMemo(() => {
    const savedTheme = localStorage.getItem('app-theme') || 'light';
    return savedTheme as 'dark' | 'light';
  }, []);

  const background = useMemo(() => {
    const savedBg = localStorage.getItem('app-background') || 'bg-pink-100';
    return savedBg;
  }, []);

  const {
    results: searchResults,
    loading: searchLoading,
    error: searchError,
    nextPageToken,
    search,
    lastKeyword,
    apiUsage,
    clearResults,
  } = useSearch();

  const {
    isAuthenticated,
    userInfo,
    login,
    logout,
    getAccessToken,
    isLoading: authLoading
  } = useYouTubeAuth();

  const recognitionRef = useRef<any>(null);
  const lastSearchRef = useRef(0);
  const roomIdFromUrl = searchParams.get('roomId');

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'vi-VN';
        
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInputValue(transcript);
          
          if (roomData?.mode === 'karaoke') {
            search(transcript);
            setActiveTab('search');
          } else {
            // Tìm kiếm trong chế độ music - ưu tiên tìm playlist
            searchMusicPlaylist(transcript);
          }
        };
        
        recognition.onerror = (event: any) => {
          logger.error('Speech recognition error:', event.error);
          setIsRecording(false);
        };
        
        recognition.onend = () => setIsRecording(false);
        recognitionRef.current = recognition;
      }
    }
  }, [search, roomData?.mode]);

  // Connect to Firebase room
  useEffect(() => {
    if (!roomIdFromUrl) {
      setFirebaseError('Không có mã phòng trong URL. Vui lòng quét mã QR từ màn hình TV.');
      return;
    }

    setRoomId(roomIdFromUrl);
    const roomRef = ref(database as DatabaseReference, 'rooms/' + roomIdFromUrl);
    
    const unsubscribe = onValue(
      roomRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const newRoomData = {
            ...data,
            mode: data.mode ?? 'karaoke',
            currentPlaylistId: data.currentPlaylistId || null
          };
          setRoomData(newRoomData);
          
          // Tự động chuyển tab dựa trên mode
          if (newRoomData.mode === 'music') {
            setActiveTab('playlist');
          } else {
            setActiveTab('search');
          }
        } else {
          setFirebaseError(`Phòng '${roomIdFromUrl}' không tồn tại. TV có thể đã mất kết nối.`);
        }
      },
      (err) => {
        logger.error('Error listening to room changes:', err);
        setFirebaseError('Không thể kết nối tới phòng. Vui lòng kiểm tra kết nối mạng.');
      }
    );

    return () => unsubscribe();
  }, [roomIdFromUrl]);

  // Load user playlists khi đã xác thực
  useEffect(() => {
    if (isAuthenticated && roomData?.mode === 'music') {
      loadUserPlaylists();
    }
  }, [isAuthenticated, roomData?.mode]);

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

  // Import playlist vào queue
  const importPlaylist = useCallback(async (playlistId: string, playlistTitle: string) => {
    if (!roomId || !isAuthenticated) return;

    Modal.confirm({
      title: 'Import Playlist',
      content: `Bạn có chắc muốn import playlist "${playlistTitle}" vào danh sách phát?`,
      okText: 'Import',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          const accessToken = getAccessToken();
          
          // Lấy tất cả video từ playlist
          let videos: ExtendedSong[] = [];
          let nextPageToken = '';
          
          do {
            const response = await fetch(
              `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
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

          // Cập nhật queue trong Firebase
          const roomRef = ref(database as DatabaseReference, 'rooms/' + roomId);
          await runTransaction(roomRef, (currentData) => {
            if (!currentData) return null;
            
            const newQueue = [...videos];
            const newCurrentIndex = currentData.currentIndex === -1 ? 0 : currentData.currentIndex;
            const newPlaying = currentData.currentIndex === -1 ? true : currentData.playing;
            
            return { 
              ...currentData, 
              queue: newQueue, 
              currentIndex: newCurrentIndex, 
              playing: newPlaying,
              currentPlaylistId: playlistId
            };
          });

          Modal.success({
            title: 'Thành công',
            content: `Đã import ${videos.length} bài hát từ playlist.`
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
  }, [roomId, isAuthenticated, getAccessToken]);

  const handleManualSearch = useCallback(() => {
    const now = Date.now();
    if (now - lastSearchRef.current < 800) return;

    lastSearchRef.current = now;
    const keyword = inputValue.trim();
    
    if (!keyword) return;

    if (roomData?.mode === 'karaoke') {
      if (keyword.toLowerCase() !== lastKeyword.toLowerCase()) {
        search(keyword);
      }
      setActiveTab('search');
    } else {
      searchMusicPlaylist(keyword);
    }
  }, [inputValue, lastKeyword, search, roomData?.mode, searchMusicPlaylist]);

  const handleLoadMore = useCallback(() => {
    if (!searchLoading && nextPageToken) {
      search(lastKeyword, nextPageToken);
    }
  }, [searchLoading, nextPageToken, lastKeyword, search]);

  const handleAddSong = useCallback(async (song: ExtendedSong) => {
    if (!roomId) return;
    
    const roomRef = ref(database as DatabaseReference, 'rooms/' + roomId);
    try {
      await runTransaction(roomRef, (currentData) => {
        if (!currentData) return null;
        
        const queue = currentData.queue || [];
        if (queue.some(s => s.id === song.id)) return currentData;
        
        const newQueue = [...queue, song];
        const newCurrentIndex = currentData.currentIndex === -1 ? 0 : currentData.currentIndex;
        const newPlaying = currentData.currentIndex === -1 ? true : currentData.playing;
        
        return { 
          ...currentData, 
          queue: newQueue, 
          currentIndex: newCurrentIndex, 
          playing: newPlaying,
          currentPlaylistId: null // Reset playlist khi thêm bài hát riêng lẻ
        };
      });
    } catch (err) {
      Modal.error({ 
        title: 'Lỗi', 
        content: 'Thêm bài hát thất bại.' 
      });
      logger.error('Failed to add song:', err);
    }
  }, [roomId]);

  const handleSetPriority = useCallback((songToPrioritize: ExtendedSong) => {
    if (!roomId || !roomData) return;
    
    const { queue, currentIndex } = roomData;
    if (!queue) return;

    let newQueue = [...queue];
    const songIndex = newQueue.findIndex(s => s.id === songToPrioritize.id);

    if (songIndex === -1) {
      const nextIndex = currentIndex === -1 ? 0 : currentIndex + 1;
      newQueue.splice(nextIndex, 0, { ...songToPrioritize, isPriority: true });
    } else {
      const [song] = newQueue.splice(songIndex, 1);
      song.isPriority = !song.isPriority;
      
      if (song.isPriority) {
        const nextIndex = currentIndex === -1 ? 0 : currentIndex + 1;
        newQueue.splice(nextIndex, 0, song);
      } else {
        newQueue.splice(songIndex, 0, song);
      }
    }

    // Reset priority for other songs
    newQueue = newQueue.map(song => ({
      ...song,
      isPriority: song.id === songToPrioritize.id ? song.isPriority : false
    }));

    set(ref(database as DatabaseReference, `rooms/${roomId}/queue`), newQueue);
  }, [roomId, roomData]);

  const handleRemoveSong = useCallback((songId: string) => {
    if (!roomId || !roomData?.queue) return;
    
    const { queue, currentIndex } = roomData;
    const newQueue = queue.filter(s => s.id !== songId);
    const removedIndex = queue.findIndex(s => s.id === songId);
    
    let newCurrentIndex = currentIndex;
    
    if (removedIndex < currentIndex) {
      newCurrentIndex--;
    } else if (removedIndex === currentIndex) {
      newCurrentIndex = newQueue.length > 0 ? currentIndex % newQueue.length : -1;
    }

    set(ref(database as DatabaseReference, `rooms/${roomId}`), {
      ...roomData,
      queue: newQueue,
      currentIndex: newCurrentIndex
    });
  }, [roomId, roomData]);

  const handleVoiceSearch = useCallback(() => {
    if (!recognitionRef.current) {
      Modal.error({ 
        title: 'Lỗi', 
        content: 'Trình duyệt của bạn không hỗ trợ tìm kiếm bằng giọng nói.' 
      });
      return;
    }

    try {
      if (isRecording) {
        recognitionRef.current.stop();
      } else {
        recognitionRef.current.start();
        setIsRecording(true);
      }
    } catch (err) {
      logger.error('Could not start speech recognition:', err);
      setIsRecording(false);
    }
  }, [isRecording]);

  const handlePlayerControl = useCallback((action: 'toggle' | 'next' | 'prev') => {
    if (!roomId || !roomData) return;
    
    const { playing, queue, currentIndex } = roomData;
    
    if (action === 'toggle') {
      set(ref(database as DatabaseReference, `rooms/${roomId}/playing`), !playing);
    } else if (action === 'next') {
      if (!queue || queue.length === 0) return;
      const nextIndex = (currentIndex + 1) % queue.length;
      set(ref(database as DatabaseReference, `rooms/${roomId}/currentIndex`), nextIndex);
    } else if (action === 'prev') {
      if (!queue || queue.length === 0) return;
      const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
      set(ref(database as DatabaseReference, `rooms/${roomId}/currentIndex`), prevIndex);
    }
  }, [roomId, roomData]);

  const handleThemeChange = useCallback((newTheme: 'dark' | 'light', newBackground?: string) => {
    localStorage.setItem('app-theme', newTheme);
    if (newBackground) {
      localStorage.setItem('app-background', newBackground);
    }
    window.location.reload();
  }, []);
  

  const SongListItem = useCallback(({ song }: { song: ExtendedSong }) => (
    <div className="song-item group">
      <img
        src={song.thumbnail}
        alt={song.title}
        className="song-thumb"
        loading="lazy"
      />
      <div className="song-info">
        <p className={`song-title ${song.isPriority ? 'priority' : ''}`}>
          {song.title}
        </p>
        <p className="song-channel">{song.channelTitle}</p>
      </div>
      <div className="song-actions">
        {roomData?.mode !== 'music' && (
          <>
            <Button
              type="text"
              icon={<PlusOutlined />}
              onClick={() => handleAddSong(song)}
              title="Thêm vào danh sách"
              className="icon-only"
            />
            <Button
              type="text"
              icon={<StarFilled />}
              onClick={() => handleSetPriority(song)}
              title="Ưu tiên"
              className={`icon-only ${song.isPriority ? 'priority' : ''}`}
            />
          </>
        )}
      </div>
    </div>
  ), [handleAddSong, handleSetPriority, roomData?.mode]);

  const PlaylistItem = useCallback(({ playlist }: { playlist: YouTubePlaylist }) => (
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
  ), [importPlaylist, roomData?.currentPlaylistId]);

  const tabItems = useMemo(() => {
    const items = [];

    if (roomData?.mode === 'karaoke') {
      items.push({ 
        key: 'search', 
        label: (
          <Badge count={searchResults.length} overflowCount={99}>
            <SearchOutlined /> Tìm kiếm
          </Badge>
        ), 
        children: (
          <Spin spinning={searchLoading} tip="Đang tìm...">
            {searchError && <Alert message={searchError} type="error" showIcon />}
            <div className="space-y-2 max-h-[calc(100vh-220px)] pr-2 tabs-content-scrollable">
              {searchResults.map(song => (
                <SongListItem key={song.id} song={song} />
              ))}
            </div>
            {nextPageToken && (
              <Button 
                onClick={handleLoadMore} 
                loading={searchLoading} 
                className="mt-4 w-full"
              >
                Tải thêm
              </Button>
            )}
          </Spin>
        )
      });
    } else if (roomData?.mode === 'music') {
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

    items.push({ 
      key: 'playlist', 
      label: (
        <Badge count={roomData?.queue?.length || 0}>
          <UnorderedListOutlined /> Danh sách phát
        </Badge>
      ), 
      children: (
        <div style={{ height: 'calc(100vh - 280px)' }}>
          {roomData && (
            <Playlist 
              songs={roomData.queue || []} 
              currentSong={roomData.queue?.[roomData.currentIndex]}
              onRemoveSong={handleRemoveSong}
              onSetPriority={handleSetPriority}
              mode={roomData.mode}
              currentPlaylistId={roomData.currentPlaylistId}
              onClearPlaylist={async () => {
                if (!roomId) return;
                await set(ref(database as DatabaseReference, `rooms/${roomId}/queue`), []);
                await set(ref(database as DatabaseReference, `rooms/${roomId}/currentPlaylistId`), null);
              }}
            />
          )}
        </div>
      )
    });

    return items;
  }, [
    roomData, 
    searchResults, 
    searchLoading, 
    searchError, 
    nextPageToken, 
    userPlaylists,
    isAuthenticated,
    userInfo,
    authLoading,
    loadingPlaylists,
    handleLoadMore, 
    SongListItem, 
    PlaylistItem,
    handleRemoveSong, 
    handleSetPriority,
    login,
    logout
  ]);
  
  const backgroundOptions: BackgroundOption[] = useMemo(() => [
    { label: 'Tối', value: 'bg-gray-900', theme: 'dark' },
    { label: 'Xám', value: 'bg-zinc-800', theme: 'dark' },
    { label: 'Xanh đậm', value: 'bg-slate-900', theme: 'dark' },
    { label: 'Hồng', value: 'bg-pink-100', theme: 'light' },
    { label: 'Trắng', value: 'bg-gray-100', theme: 'light' },
  ], []);

  const currentSong = roomData?.queue?.[roomData?.currentIndex ?? -1];

  // ... phần còn lại của component giữ nguyên ...
  // (Now Playing Section, Settings Modal)
  
  return (
    <div className={`min-h-screen ${background} text-white p-4 relative`}>
      <Button
        type="text"
        icon={<MoreOutlined />}
        className="absolute top-0 right-2 z-20"
        onClick={() => setShowSettings(true)}
      />
      
      {/* Now Playing Section */}
      <div className="now-playing-section p-4 bg-gradient-to-r from-purple-600 to-blue-500 rounded-lg mb-1 pt-6">
        {currentSong ? (
          <>
            <p className={`text-sm flex items-center gap-1 font-medium ${
              roomData?.playing ? 'text-green-400' : 'text-gray-400'
            }`}>
              {roomData?.playing ? 'online' : 'offline'}
              {roomData?.playing ? (
                <PlayCircleFilled className="text-green-500 animate-pulse" />
              ) : (
                <PauseCircleFilled className="text-gray-500" />
              )}
            </p>
            <p className="font-bold text-lg leading-tight line-clamp-2">
              {currentSong.title}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-400 flex items-center gap-1 font-medium">
              Chưa có bài hát <AudioOutlined className="text-gray-500" />
            </p>
            <p className="font-bold text-lg leading-tight line-clamp-2 text-gray-500">
              Thêm bài hát đầu tiên để bắt đầu
            </p>
          </>
        )}
        
        <div className="flex justify-center items-center gap-4 mt-2">
          <Button
            type="text"
            shape="circle"
            icon={<StepBackwardFilled />}
            onClick={() => handlePlayerControl('prev')}
            disabled={!roomData?.queue?.length}
            style={{
              width: '56px',
              height: '56px',
              fontSize: '22px',
              color: roomData?.queue?.length ? '#22c55e' : '#9ca3af',
            }}
          />
          <Button
            type="text"
            shape="circle"
            onClick={() => handlePlayerControl('toggle')}
            disabled={!roomData?.queue?.length}
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              color: roomData?.playing ? '#22c55e' : '#9ca3af',
            }}
            icon={
              roomData?.playing ? (
                <PauseCircleFilled
                  style={{ fontSize: '40px', transition: 'all 0.25s ease' }}
                  className="pulse-glow"
                />
              ) : (
                <PlayCircleFilled
                  style={{ fontSize: '40px', transition: 'all 0.25s ease' }}
                />
              )
            }
          />
          <Button
            type="text"
            shape="circle"
            icon={<StepForwardFilled />}
            onClick={() => handlePlayerControl('next')}
            disabled={!roomData?.queue?.length}
            style={{
              width: '56px',
              height: '56px',
              fontSize: '22px',
              color: roomData?.queue?.length ? '#22c55e' : '#9ca3af',
            }}
          />
        </div>
      </div>

      {/* Search Input - chỉ hiển thị trong karaoke mode */}
      {roomData?.mode === 'karaoke' && (
        <div className="sticky top-0 py-0 z-10">
          <Input
            placeholder="Nhập tên bài hát..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onPressEnter={handleManualSearch}
            suffix={
              <>
                <Button 
                  type="text" 
                  icon={<AudioOutlined />} 
                  danger={isRecording} 
                  onClick={handleVoiceSearch} 
                />
                <Button 
                  type="text" 
                  icon={<SearchOutlined />} 
                  onClick={handleManualSearch} 
                />
              </>
            }
          />
        </div>
      )}

      {/* Music Mode Search Input - hiển thị riêng cho music mode */}
      {roomData?.mode === 'music' && (
        <div className="sticky top-0 py-0 z-10 mb-3">
          <Input
            placeholder="Tìm kiếm playlist YouTube..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onPressEnter={handleManualSearch}
            suffix={
              <>
                <Button 
                  type="text" 
                  icon={<AudioOutlined />} 
                  danger={isRecording} 
                  onClick={handleVoiceSearch} 
                />
                <Button 
                  type="text" 
                  icon={<SearchOutlined />} 
                  onClick={handleManualSearch} 
                />
              </>
            }
          />
          <div className="mt-2 flex items-center text-sm text-gray-400">
            <YoutubeOutlined className="mr-1" />
            <span>Tìm kiếm playlist từ YouTube của bạn hoặc từ kho dữ liệu công khai</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        centered
        className="mt-2"
      />

      {/* Settings Modal */}
      <Modal 
        title="Cài đặt" 
        open={showSettings} 
        onCancel={() => setShowSettings(false)} 
        footer={null}
      >
        <div className="space-y-4">
          <p>
            <InfoCircleOutlined /> Trạng thái:{' '}
            <Badge 
              status={roomData ? "success" : "default"} 
              text={roomData ? "Đã kết nối" : "Chưa kết nối"} 
            />
          </p>
          <p>
            <UnorderedListOutlined /> Số bài trong hàng đợi:{' '}
            {roomData?.queue?.length || 0}
          </p>
          <p>
            <WifiOutlined /> Mã phòng:{' '}
            <Tag color="blue">{roomId}</Tag>
          </p>
          <p>
            <ClockCircleFilled /> API Usage:{' '}
            <Tag color={apiUsage > 9000 ? "red" : "green"}>
              {apiUsage} / 10000
            </Tag>
          </p>
          
          <Button 
            type="text" 
            icon={<CopyOutlined />} 
            onClick={() => navigator.clipboard.writeText(window.location.href)}
            className="w-full"
          >
            Sao chép URL điều khiển
          </Button>

          <Divider />
          
          <p className="font-semibold mb-2">
            🎵 Chế độ phát
          </p>
          
          <Row gutter={12}>
            <Col span={12}>
              <Button
                block
                type={roomData?.mode !== 'music' ? 'primary' : 'default'}
                onClick={() => {
                  if (!roomId) return;
                  set(ref(database as DatabaseReference, `rooms/${roomId}/mode`), 'karaoke');
                }}
              >
                🎤 Karaoke
              </Button>
            </Col>
            <Col span={12}>
              <Button
                block
                type={roomData?.mode === 'music' ? 'primary' : 'default'}
                onClick={() => {
                  if (!roomId) return;
                  set(ref(database as DatabaseReference, `rooms/${roomId}/mode`), 'music');
                }}
              >
                🎧 Nghe nhạc
              </Button>
            </Col>
          </Row>
          
          <Divider />
          
          <p className="font-semibold mb-2">
            <SettingOutlined /> Giao diện
          </p>
          
          <Row gutter={12}>
            <Col span={12}>
              <Button
                block
                type={theme === 'dark' ? 'primary' : 'default'}
                onClick={() => handleThemeChange('dark')}
              >
                🌙 Tối
              </Button>
            </Col>
            <Col span={12}>
              <Button
                block
                type={theme === 'light' ? 'primary' : 'default'}
                onClick={() => handleThemeChange('light')}
              >
                ☀️ Sáng
              </Button>
            </Col>
          </Row>

          <Divider />
          
          <p className="font-semibold mb-2">🎨 Màu nền</p>
          
          <Row gutter={8}>
            {backgroundOptions.map(bg => (
              <Col span={12} key={bg.value} className="mb-2">
                <Button
                  block
                  type={background === bg.value ? 'primary' : 'default'}
                  onClick={() => handleThemeChange(bg.theme, bg.value)}
                >
                  {bg.label}
                </Button>
              </Col>
            ))}
          </Row>
        </div>
      </Modal>

      {/* YouTube Playlist Manager Modal */}
      <Modal
        title="Quản lý Playlist YouTube"
        open={showYouTubePlaylistManager}
        onCancel={() => setShowYouTubePlaylistManager(false)}
        width={800}
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
