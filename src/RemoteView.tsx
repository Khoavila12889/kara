import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ref, onValue, runTransaction, set } from 'firebase/database';
import { database } from './firebase';
import Playlist from './Playlist';
import { Song, ExtendedSong } from './types';
import { logger } from './logger';
import { useSearch } from './useSearch';
import { Button, Input, Tabs, Spin, Alert, Badge, Modal, Row, Col, Tag, Divider } from 'antd';
import { SearchOutlined, AudioOutlined, StarFilled, PlusOutlined, SettingOutlined, PauseCircleFilled, PlayCircleFilled, StepBackwardFilled, StepForwardFilled, CopyOutlined, CloseCircleFilled, InfoCircleOutlined, WifiOutlined, CustomerServiceOutlined, FireFilled, ClockCircleFilled, UnorderedListOutlined, MoreOutlined } from '@ant-design/icons';

interface RoomData {
  queue: ExtendedSong[];
  currentIndex: number;
  playing: boolean;
}

const RemoteView = () => {
  const [searchParams] = useSearchParams();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [activeTab, setActiveTab] = useState('trending');
  const [showSettings, setShowSettings] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const savedTheme = localStorage.getItem('app-theme') || 'light';
    return savedTheme as 'dark' | 'light';
  });

  const [background, setBackground] = useState(() => {
    const savedBg = localStorage.getItem('app-background') || 'bg-pink-100';
    return savedBg;
  });

  const [inputValue, setInputValue] = useState('');

  const {
    results: searchResults,
    loading: searchLoading,
    error: searchError,
    trendingError,
    nextPageToken,
    search,
    lastKeyword,
    trendingSongs,
    trendingLoading,
    fetchTrending,
    apiUsage,
  } = useSearch();

  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const lastSearchRef = useRef(0);

  // useEffect(() => {
  //   fetchTrending();
  // }, [fetchTrending]);

  useEffect(() => {
    const urlRoomId = searchParams.get('roomId');
    if (!urlRoomId) {
      setFirebaseError('Không có mã phòng trong URL. Vui lòng quét mã QR từ màn hình TV.');
      return;
    }
    setRoomId(urlRoomId);
    const roomRef = ref(database, 'rooms/' + urlRoomId);
    const unsubscribe = onValue(roomRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setRoomData(snapshot.val());
        } else {
          setFirebaseError(`Phòng '${urlRoomId}' không tồn tại. TV có thể đã mất kết nối.`);
        }
      },
      (err) => {
        logger.error('Error listening to room changes:', err);
        setFirebaseError('Không thể kết nối tới phòng. Vui lòng kiểm tra kết nối mạng.');
      }
    );

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'vi-VN';
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(transcript);
        search(transcript); // 🔥 trigger search tại đây
        setActiveTab('search');
      };
      recognition.onerror = (event: any) => { logger.error('Speech recognition error:', event.error); setIsRecording(false); };
      recognition.onend = () => setIsRecording(false);
      recognitionRef.current = recognition;
    }
    return () => unsubscribe();
  }, [searchParams]);

  const handleManualSearch = () => {
    const now = Date.now();
    if (now - lastSearchRef.current < 800) return;

    lastSearchRef.current = now;

    const keyword = inputValue.trim();
    if (!keyword) return;

    if (keyword.toLowerCase() !== lastKeyword.toLowerCase()) {
      search(keyword);
    }
    setActiveTab('search');
  }

  const handleLoadMore = () => {
    if (!searchLoading && nextPageToken) {
        search(lastKeyword, nextPageToken);
    }
  };

  const handleAddSong = useCallback(async (song: ExtendedSong) => {
    if (!roomId) return;
    const roomRef = ref(database, 'rooms/' + roomId);
    try {
      await runTransaction(roomRef, (currentData) => {
        if (!currentData) return null;
        const queue = currentData.queue || [];
        if (queue.some(s => s.id === song.id)) return;
        const newQueue = [...queue, song];
        return { ...currentData, queue: newQueue, currentIndex: currentData.currentIndex === -1 ? 0 : currentData.currentIndex, playing: currentData.currentIndex === -1 ? true : currentData.playing, };
      });
    } catch (err) {
      Modal.error({ title: 'Lỗi', content: 'Thêm bài hát thất bại.' });
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
        
        newQueue = newQueue.map((s) => (s.id === songToPrioritize.id ? s : { ...s, isPriority: false }));

        set(ref(database, `rooms/${roomId}/queue`), newQueue);
    }, [roomId, roomData]);

  const handleRemoveSong = useCallback((songId: string) => {
    if (!roomId || !roomData?.queue) return;
    const { queue, currentIndex } = roomData;
    const newQueue = queue.filter(s => s.id !== songId);
    let newCurrentIndex = currentIndex;
    const removedIndex = queue.findIndex(s => s.id === songId);
    if(removedIndex < currentIndex) {
        newCurrentIndex--;
    } else if(removedIndex === currentIndex) {
        newCurrentIndex = newQueue.length > 0 ? currentIndex % newQueue.length : -1;
    }
    set(ref(database, `rooms/${roomId}`), { ...roomData, queue: newQueue, currentIndex: newCurrentIndex });
  }, [roomId, roomData]);

  const handleVoiceSearch = () => {
    if (!recognitionRef.current) {
      Modal.error({ title: 'Lỗi', content: 'Trình duyệt của bạn không hỗ trợ tìm kiếm bằng giọng nói.' });
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
  };
  
  const handlePlayerControl = (action: 'toggle' | 'next' | 'prev') => {
      if (!roomId || !roomData) return;
      const { playing, queue, currentIndex } = roomData;
      
      if (action === 'toggle') {
          set(ref(database, `rooms/${roomId}/playing`), !playing);
      } else if (action === 'next') {
          if (!queue || queue.length === 0) return;
          const nextIndex = (currentIndex + 1) % queue.length;
          set(ref(database, `rooms/${roomId}/currentIndex`), nextIndex);
      } else if (action === 'prev') {
          if (!queue || queue.length === 0) return;
          const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
          set(ref(database, `rooms/${roomId}/currentIndex`), prevIndex);
      }
  }

  const currentSong = roomData?.queue?.[roomData.currentIndex];

  const SongListItem = ({ song }: { song: ExtendedSong }) => (
    <div className="song-item group">
      <img
        src={song.thumbnail}
        alt={song.title}
        className="song-thumb"
      />
      <div className="song-info">
        <p className={`song-title ${song.isPriority ? 'priority' : ''}`}>
          {song.title}
        </p>
      </div>
      <div className="song-actions">
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
      </div>
    </div>
  );

  const tabItems = [
    { key: 'search', label: <Badge count={searchResults.length || 0} overflowCount={99}><SearchOutlined /> Tìm kiếm</Badge>, children: (
      <Spin spinning={searchLoading} tip="Đang tìm...">
          {searchError && <Alert message={searchError} type="error" showIcon />}
          <div className="space-y-2 max-h-[calc(100vh-220px)] pr-2 tabs-content-scrollable">
            {searchResults.map(song => <SongListItem key={song.id} song={song} />)}
          </div>
          {nextPageToken && <Button onClick={handleLoadMore} loading={searchLoading} className="mt-4 w-full">Tải thêm</Button>}
      </Spin>
    )},

    { key: 'playlist', label: <Badge count={roomData?.queue?.length || 0}><UnorderedListOutlined /> Danh sách phát</Badge>, children: (
      <Spin spinning={false}>
        <div style={{ height: 'calc(100vh - 280px)' }}>
          {roomData && <Playlist songs={roomData.queue || []} currentSong={currentSong} onRemoveSong={handleRemoveSong} onSetPriority={handleSetPriority} />}
        </div>
      </Spin>
    )},
  ];


  if (firebaseError) return <div className="h-screen flex justify-center items-center"><Alert message="Lỗi" description={firebaseError} type="error" showIcon closable onClose={() => setFirebaseError(null)} /></div>;
  if (trendingError) return <div className="h-screen flex justify-center items-center"><Alert message="Lỗi" description={trendingError} type="error" showIcon closable /></div>;
  
  return (
    <div className={`min-h-screen ${background} text-white p-4 relative`}>
      <Button
        type="text"
        icon={<MoreOutlined />}
        className="absolute top-0 right-2 z-20"
        onClick={() => setShowSettings(true)}
      />
      {currentSong ? (
        <div className="now-playing-section p-4 bg-[linear-gradient(to_right,_#6a11cb,_#2575fc)] rounded-lg mb-1 pt-6">
          <p
            className={`text-sm flex items-center gap-1 font-medium ${
              roomData?.playing
                ? 'text-green-400'
                : 'text-gray-400'
            }`}
          >
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
          <div className="flex justify-center items-center gap-4 mt-2">
            <Button
              type="text"
              shape="circle"
              icon={<StepBackwardFilled />}
              onClick={() => handlePlayerControl('prev')}
              style={{
                width: '56px',
                height: '56px',
                fontSize: '22px',
                color: roomData?.playing ? '#22c55e' : '#9ca3af',
              }}
            />
            <Button
              type="text"
              shape="circle"
              onClick={() => handlePlayerControl('toggle')}
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
              style={{
                width: '56px',
                height: '56px',
                fontSize: '22px',
                color: roomData?.playing ? '#22c55e' : '#9ca3af',
              }}
            />
          </div>
        </div>
      ) : (
        <div className="now-playing-section p-4 bg-[linear-gradient(to_right,_#6a11cb,_#2575fc)] rounded-lg mb-1 pt-6">
          <p className="text-sm text-gray-400 flex items-center gap-1 font-medium">
            Chưa có bài hát <AudioOutlined className="text-gray-500" />
          </p>
          <p className="font-bold text-lg leading-tight line-clamp-2 text-gray-500">
            Thêm bài hát đầu tiên để bắt đầu
          </p>
          <div className="flex justify-center items-center gap-4 mt-2">
            <Button
              type="text"
              shape="circle"
              icon={<StepBackwardFilled />}
              disabled
              style={{ width: '56px', height: '56px', fontSize: '22px', color: '#9ca3af' }}
            />
            <Button
              type="text"
              shape="circle"
              icon={<PlayCircleFilled style={{ fontSize: '40px' }} />}
              disabled
              style={{ width: '72px', height: '72px', borderRadius: '50%', color: '#9ca3af' }}
            />
            <Button
              type="text"
              shape="circle"
              icon={<StepForwardFilled />}
              disabled
              style={{ width: '56px', height: '56px', fontSize: '22px', color: '#9ca3af' }}
            />
          </div>
        </div>
      )}
      <div className="sticky top-0  py-0 z-10">
        <Input
          placeholder="Nhập tên bài hát..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onPressEnter={handleManualSearch}
          suffix={
            <>
              <Button type="text" icon={<AudioOutlined />} danger={isRecording} onClick={handleVoiceSearch} />
              <Button type="text" icon={<SearchOutlined />} onClick={handleManualSearch} />
            </>
          }
        />
      </div>
      <Tabs defaultActiveKey="search" activeKey={activeTab} onChange={setActiveTab} items={tabItems} centered className="mt-2" />
      <Modal title="Cài đặt" open={showSettings} onCancel={() => setShowSettings(false)} footer={null}>
        <p><InfoCircleOutlined /> Trạng thái: <Badge status={roomData ? "success" : "default"} text={roomData ? "Đã kết nối" : "Chưa kết nối"} /></p>
        <p><UnorderedListOutlined /> Số bài trong hàng đợi: {roomData?.queue?.length || 0}</p>
        <p><WifiOutlined /> Mã phòng: <Tag color="blue">{roomId}</Tag></p>
        <p><ClockCircleFilled /> API Usage: <Tag color={apiUsage > 9000 ? "red" : "green"}>{apiUsage} / 10000</Tag></p>
        <Button type="text" icon={<CopyOutlined />} onClick={() => navigator.clipboard.writeText(window.location.href)} className="mt-4">Sao chép URL điều khiển</Button>
        <Divider />
        <p className="font-semibold mb-2">
          <SettingOutlined /> Giao diện
        </p>
        <Row gutter={12}>
          <Col span={12}>
            <Button
              block
              type={theme === 'dark' ? 'primary' : 'default'}
              onClick={() => {
                setTheme('dark');
                localStorage.setItem('app-theme', 'dark');
                window.location.reload();
              }}
            >
              🌙 Tối
            </Button>
          </Col>
          <Col span={12}>
            <Button
              block
              type={theme === 'light' ? 'primary' : 'default'}
              onClick={() => {
                setTheme('light');
                localStorage.setItem('app-theme', 'light');
                window.location.reload();
              }}
            >
              ☀️ Sáng
            </Button>
          </Col>
        </Row>
        <Divider />
        <p className="font-semibold mb-2">
          🎨 Màu nền
        </p>
        <Row gutter={8}>
          {[
            { label: 'Tối', value: 'bg-gray-900' },
            { label: 'Xám', value: 'bg-zinc-800' },
            { label: 'Xanh đậm', value: 'bg-slate-900' },
            { label: 'Hồng', value: 'bg-pink-100' },
            { label: 'Trắng', value: 'bg-gray-100' },
          ].map(bg => (
            <Col span={12} key={bg.value}>
              <Button
                block
                type={background === bg.value ? 'primary' : 'default'}
                onClick={() => {
                  setBackground(bg.value);
                  localStorage.setItem('app-background', bg.value);
                  if (bg.value === 'bg-gray-100' || bg.value === 'bg-pink-100') setTheme('light');
                  else setTheme('dark');
                  localStorage.setItem('app-theme', theme);
                  window.location.reload();
                }}
              >
                {bg.label}
              </Button>
            </Col>
          ))}
        </Row>
      </Modal>
    </div>
  );
};

export default RemoteView;
