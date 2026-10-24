import { useCallback, useEffect, useRef, useState } from 'react';
import { App as NativeApp } from '@capacitor/app';
import { QRCodeCanvas } from 'qrcode.react';
import { createRoom, database, ref, roomToken, runTransaction, remoteRoomUrl } from '../roomDatabase';
import { useRoom } from '../hooks/useRoom';
import { RoomData, ExtendedSong } from '../types';
import YouTubePlayer, { type YouTubePlayerHandle } from '../YouTubePlayer';
import { isNativeApp, apiOrigin } from '../platform';
import { NativeAudio } from '../plugins/nativeAudio';
import { useDpad } from './useDpad';
import { useMusicSearch } from './useMusicSearch';
import { enqueue, nextSong, removeSong } from './queue';
import './music-app.css';

const roomStorage = 'khoavilaAndroidRoom';
type Dialog = 'connect' | 'new-room' | 'exit' | null;

function Icon({ name }: { name: 'play' | 'pause' | 'next' | 'search' | 'queue' | 'link' | 'plus' | 'close' }) {
  const paths = {
    play: 'M8 5v14l11-7z', pause: 'M8 5v14M16 5v14', next: 'm5 5 10 7-10 7zM19 5v14',
    search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    queue: 'M4 6h16M4 12h16M4 18h10', link: 'm10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M13 17a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-1 1',
    plus: 'M12 5v14M5 12h14', close: 'm6 6 12 12M18 6 6 18',
  };
  return <svg viewBox="0 0 24 24" fill={name === 'play' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export default function MusicApp() {
  const root = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [busy, setBusy] = useState(false);
  const mutating = useRef(false);
  const startingRef = useRef(false);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [panel, setPanel] = useState<'search' | 'queue'>('search');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [slow, setSlow] = useState(false);
  const playerHandle = useRef<YouTubePlayerHandle>(null);
  const nativeModeRef = useRef(false);
  const nativeSongRef = useRef<string | null>(null);
  const [nativeMode, setNativeMode] = useState(false);
  const { roomData, error: roomError } = useRoom(roomId);
  const search = useMusicSearch();
  const currentSong = roomData?.queue[roomData.currentIndex];
  const latest = useRef({ roomId, roomData, dialog });
  latest.current = { roomId, roomData, dialog };
  useDpad(root);

  const mutate = useCallback(async (update: (state: RoomData) => RoomData) => {
    const id = latest.current.roomId;
    if (!id || mutating.current) return false;
    mutating.current = true; setBusy(true); setActionError('');
    try {
      await runTransaction(ref(database, `rooms/${id}`), (state: RoomData | null) => {
        if (!state) throw new Error('Phòng không còn hoạt động. Hãy tạo phòng mới.');
        return update(state);
      });
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không thể cập nhật phòng.');
      return false;
    } finally { mutating.current = false; setBusy(false); }
  }, []);

  // Remote clients can append to an idle room without selecting a track.
  useEffect(() => {
    if (busy || !roomData || !online || actionError || roomError) return;
    if (roomData.queue.length && roomData.currentIndex === -1 && !roomData.playing) {
      void mutate(state => {
        if (state.currentIndex !== -1 || state.playing || !state.queue.length) return state;
        const priority = state.queue.findIndex(song => song.isPriority);
        return { ...state, currentIndex: priority < 0 ? 0 : priority, playing: true };
      });
    }
  }, [roomData, busy, online, actionError, roomError, mutate]);

  // Native background audio: keep video in the WebView while the app is
  // visible, switch to the Media3 player when it is not, then sync back.
  const switchToNative = useCallback(async () => {
    const state = latest.current.roomData;
    const song = state ? state.queue[state.currentIndex] : undefined;
    if (!state?.playing || !song || nativeModeRef.current) return;
    const positionMs = Math.max(0, Math.round((playerHandle.current?.getCurrentTime() ?? 0) * 1000));
    nativeModeRef.current = true;
    nativeSongRef.current = song.id;
    setNativeMode(true);
    playerHandle.current?.pause();
    try {
      await NativeAudio.setTrack({
        url: `${apiOrigin}/api/stream/${song.id}`,
        title: song.title,
        artist: song.channelTitle || 'Khoavila',
        artwork: song.thumbnail,
        positionMs,
      });
    } catch {
      nativeModeRef.current = false;
      nativeSongRef.current = null;
      setNativeMode(false);
      setActionError('Không thể phát nhạc ở nền.');
    }
  }, []);

  const switchToWeb = useCallback(async () => {
    if (!nativeModeRef.current) return;
    nativeModeRef.current = false;
    nativeSongRef.current = null;
    setNativeMode(false);
    let positionMs = 0;
    try { positionMs = (await NativeAudio.getStatus()).positionMs; } catch { /* ignore */ }
    await NativeAudio.stop().catch(() => {});
    playerHandle.current?.seekTo(positionMs / 1000);
    if (latest.current.roomData?.playing) playerHandle.current?.play();
  }, []);

  useEffect(() => {
    if (!isNativeApp) return;
    let disposed = false;
    const handles: { remove: () => Promise<void> }[] = [];
    void (async () => {
      const ended = await NativeAudio.addListener('ended', () => {
        if (nativeModeRef.current) void mutate(nextSong);
      });
      const stateChange = await NativeAudio.addListener('stateChange', ({ playing }) => {
        if (!nativeModeRef.current || playing) return;
        void mutate(state => (state.playing ? { ...state, playing: false } : state));
      });
      if (disposed) { void ended.remove(); void stateChange.remove(); }
      else handles.push(ended, stateChange);
    })();
    return () => {
      disposed = true;
      handles.forEach(handle => void handle.remove());
    };
  }, [mutate]);

  // Load the next track into the native player while it owns playback.
  useEffect(() => {
    if (!nativeMode || !roomData?.playing) return;
    const song = roomData.queue[roomData.currentIndex];
    if (!song || nativeSongRef.current === song.id) return;
    nativeSongRef.current = song.id;
    void NativeAudio.setTrack({
      url: `${apiOrigin}/api/stream/${song.id}`,
      title: song.title,
      artist: song.channelTitle || 'Khoavila',
      artwork: song.thumbnail,
      positionMs: 0,
    }).catch(() => {});
  }, [nativeMode, roomData?.playing, roomData?.currentIndex, roomData?.queue]);

  const start = async (fresh = false) => {
    if (startingRef.current) return;
    startingRef.current = true; setStarting(true); setActionError('');
    try {
      let id = fresh ? null : localStorage.getItem(roomStorage);
      if (id) { try { roomToken(id); } catch { id = null; } }
      if (!id || !/^[A-Z0-9]{6}$/.test(id)) id = await createRoom();
      await runTransaction(ref(database, `rooms/${id}`), (state: RoomData) => ({ ...state, mode: 'music' }));
      localStorage.setItem(roomStorage, id);
      setRoomId(id); setDialog(null);
    } catch (err) { setActionError(err instanceof Error ? err.message : 'Không thể mở phòng.'); }
    finally { startingRef.current = false; setStarting(false); }
  };

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  useEffect(() => {
    setSlow(false);
    if (!roomId || roomData) return;
    const timer = window.setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(timer);
  }, [roomId, roomData]);

  useEffect(() => {
    const element = dialogRef.current;
    if (!element) return;
    if (dialog && !element.open) element.showModal();
    if (!dialog && element.open) element.close();
  }, [dialog]);

  useEffect(() => {
    const back = () => {
      if (latest.current.dialog) setDialog(null);
      else setDialog('exit');
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !latest.current.dialog) { event.preventDefault(); back(); }
    };
    window.addEventListener('keydown', key);
    if (!isNativeApp) return () => window.removeEventListener('keydown', key);
    let disposed = false;
    const listeners = [
      NativeApp.addListener('backButton', back),
      NativeApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) void switchToWeb();
        else void switchToNative();
      }),
    ];
    void Promise.all(listeners).then(handles => { if (disposed) handles.forEach(handle => void handle.remove()); });
    return () => {
      disposed = true; window.removeEventListener('keydown', key);
      void Promise.all(listeners).then(handles => handles.forEach(handle => void handle.remove()));
    };
  }, [mutate, switchToNative, switchToWeb]);

  const add = async (song: ExtendedSong) => {
    if (await mutate(state => enqueue(state, song))) setNotice(`Đã thêm “${song.title}” vào hàng đợi.`);
  };
  const exit = async () => {
    if (latest.current.roomData?.playing && !await mutate(state => ({ ...state, playing: false }))) return;
    if (isNativeApp) await NativeApp.exitApp();
    else { setDialog(null); setRoomId(null); }
  };
  const createFreshRoom = async () => {
    if (latest.current.roomData?.playing && !await mutate(state => ({ ...state, playing: false }))) return;
    await start(true);
  };

  return <div className="music-app" ref={root}>
    <header className="music-header">
      <a className="music-brand" href="#main"><span className="music-brand-mark" aria-hidden="true">♫</span><span>Khoavila<small>Không gian âm nhạc của bạn</small></span></a>
      <div className="music-header-actions">
        <span className={`music-connection ${!online || (roomId && roomError) ? 'is-offline' : ''}`} role="status"><i />{!online ? 'Mất mạng' : roomId && roomError ? 'Đang kết nối lại' : roomData ? `Phòng ${roomId}` : 'Music & TV'}</span>
        {roomId && <button className="music-button music-button-quiet" aria-label="Kết nối" onClick={() => setDialog('connect')}><Icon name="link" /><span>Kết nối</span></button>}
      </div>
    </header>

    <main id="main" className="music-main">
      {(actionError || (roomId && roomError) || !online) && <div className="music-alert" role="alert">{actionError || roomError || 'Mất kết nối mạng. Các thao tác sẽ khả dụng khi mạng trở lại.'}</div>}
      {!roomId ? <section className="music-welcome">
        <div className="music-welcome-copy"><p className="music-eyebrow">CHẠM ĐỂ NGHE · BẤM ĐỂ CHỌN</p><h1>Nhạc hay.<br /><span>Ngay trong tầm tay.</span></h1><p>Mở một phòng nhạc, tìm bài yêu thích và tận hưởng. Điều khiển ngay trên app hoặc kết nối điện thoại bằng mã QR.</p><div className="music-welcome-actions"><button autoFocus className="music-button music-button-primary" disabled={starting || !online} onClick={() => void start()}><Icon name="play" />{starting ? 'Đang mở phòng…' : 'Bắt đầu nghe nhạc'}</button>{actionError && <button className="music-button" disabled={starting || !online} onClick={() => void start(true)}>Tạo phòng mới</button>}</div><span className="music-hint">Chạm màn hình hoặc dùng phím mũi tên và OK</span></div>
        <div className="music-welcome-art" aria-hidden="true"><div className="music-vinyl"><span>♫</span></div><div className="music-art-caption"><i />YOUR MUSIC. YOUR MOMENT.</div></div>
      </section> : !roomData ? <section className="music-empty"><span className="music-empty-symbol">♫</span><h1>{slow ? 'Kết nối mất nhiều thời gian' : 'Đang kết nối phòng nhạc…'}</h1><p>{slow ? 'Kiểm tra mạng hoặc mở một phòng mới.' : 'Danh sách phát sẽ xuất hiện ngay khi phòng sẵn sàng.'}</p>{(slow || roomError) && <button className="music-button" disabled={starting} onClick={() => void start(true)}>Tạo phòng mới</button>}</section> : <div className="music-workspace">
        <section className="music-player-column" aria-label="Trình phát nhạc">
          <div className="music-section-heading"><p className="music-eyebrow">KHÔNG GIAN CỦA BẠN</p><span>YouTube</span></div>
          <div className="music-video">
            {currentSong ? <YouTubePlayer ref={playerHandle} foregroundOnly song={currentSong} playing={roomData.playing} onEnded={() => void mutate(nextSong)}
              onPlayingChange={playing => void mutate(state => ({ ...state, playing }))}
              onError={() => { setActionError('Bài này không phát được. Hãy chọn bài khác hoặc bấm Chuyển bài.'); void mutate(state => ({ ...state, playing: false })); }}
              className="music-video-player" /> : <div className="music-video-empty"><span aria-hidden="true">♫</span><h2>Một giai điệu cho hôm nay</h2><p>Tìm bài hát để bắt đầu nghe.</p></div>}
          </div>
          <div className="music-now-playing"><div className="music-track-copy"><span className="music-eyebrow">{currentSong ? roomData.playing ? 'ĐANG PHÁT' : 'TẠM DỪNG' : 'SẴN SÀNG PHÁT'}</span><h1>{currentSong?.title || 'Chọn một bài bạn thích'}</h1><p>{currentSong?.channelTitle || 'Âm nhạc kết nối mọi khoảnh khắc'}</p></div>
            <div className="music-playback"><button className="music-button music-button-play" disabled={!currentSong || busy || !online} aria-label={roomData.playing ? 'Tạm dừng' : 'Phát nhạc'} onClick={() => void mutate(state => ({ ...state, playing: !state.playing }))}><Icon name={roomData.playing ? 'pause' : 'play'} /></button><button className="music-button music-button-next" disabled={!currentSong || busy || !online} aria-label="Chuyển bài" onClick={() => void mutate(nextSong)}><Icon name="next" /></button></div>
          </div>
          <div className="music-room-note"><Icon name="link" /><p>Cùng chọn, cùng nghe.<span>Kết nối điện thoại để thêm bài vào phòng.</span></p><button className="music-button music-button-quiet" onClick={() => setDialog('connect')}>Hiện QR</button></div>
        </section>

        <section className="music-library" aria-label="Thư viện và hàng đợi">
          <div className="music-tabs" aria-label="Chọn danh sách">
            <button className={panel === 'search' ? 'is-selected' : ''} aria-pressed={panel === 'search'} onClick={() => setPanel('search')}><Icon name="search" />Tìm nhạc</button>
            <button className={panel === 'queue' ? 'is-selected' : ''} aria-pressed={panel === 'queue'} onClick={() => setPanel('queue')}><Icon name="queue" />Hàng đợi <span className="music-count">{roomData.queue.length}</span></button>
          </div>
          {panel === 'search' ? <div className="music-library-panel">
            <form className="music-search" onSubmit={event => { event.preventDefault(); setSearched(true); void search.search(query); }}>
              <label className="music-sr-only" htmlFor="music-query">Tên bài hát hoặc ca sĩ</label><Icon name="search" /><input id="music-query" type="search" autoComplete="off" value={query} onChange={event => setQuery(event.target.value)} placeholder="Bài hát, ca sĩ bạn yêu thích…" enterKeyHint="search" /><button className="music-button" disabled={search.loading || !online || query.trim().length < 2} type="submit">Tìm</button>
            </form>
            <div className="music-list-heading"><h2>{search.loading ? 'Đang tìm kiếm…' : searched ? 'Kết quả tìm kiếm' : 'Khám phá âm nhạc'}</h2><span>{search.results.length ? `${search.results.length} bài` : 'YouTube'}</span></div>
            {search.error && <p className="music-alert" role="alert">{search.error}</p>}
            <div className="music-song-list" aria-busy={search.loading}>
              {search.results.map(song => <article className="music-song" key={song.id}><img src={song.thumbnail} alt="" loading="lazy" /><div className="music-song-copy"><h3>{song.title}</h3><p>{song.channelTitle}</p></div><button className="music-button music-button-add" aria-label={`Thêm ${song.title}`} disabled={busy || !online || roomData.queue.some(item => item.id === song.id)} onClick={() => void add(song)}><Icon name="plus" /></button></article>)}
              {!search.results.length && !search.loading && !search.error && <div className="music-empty"><span className="music-empty-symbol" aria-hidden="true"><Icon name="search" /></span><h3>{searched ? 'Chưa tìm thấy bài hát' : 'Hôm nay bạn muốn nghe gì?'}</h3><p>{searched ? 'Thử tên bài hát hoặc ca sĩ khác.' : 'Nhập tên bài hát, ca sĩ rồi bấm Tìm. Hoặc quét QR để chọn nhạc từ điện thoại.'}</p></div>}
            </div>
          </div> : <div className="music-library-panel"><div className="music-list-heading"><h2>Tiếp theo dành cho bạn</h2><span>{roomData.queue.length} bài hát</span></div><div className="music-song-list">
            {roomData.queue.map((song, index) => <article className={`music-song ${currentSong?.id === song.id ? 'is-current' : ''}`} key={song.id}>
              <span className="music-song-number" aria-hidden="true">{currentSong?.id === song.id ? '♫' : String(index + 1).padStart(2, '0')}</span><button className="music-song-select" aria-label={`Phát ${song.title}`} aria-current={currentSong?.id === song.id ? 'true' : undefined} disabled={busy || !online} onClick={() => void mutate(state => ({ ...state, currentIndex: state.queue.findIndex(item => item.id === song.id), playing: true }))}><img src={song.thumbnail} alt="" loading="lazy" /><span className="music-song-copy"><strong>{song.title}</strong><span>{song.channelTitle || 'YouTube'}</span></span></button>
              <button className="music-button music-button-remove" aria-label={`Xóa ${song.title}`} disabled={busy || !online} onClick={() => void mutate(state => removeSong(state, song.id))}><Icon name="close" /></button>
            </article>)}
            {!roomData.queue.length && <div className="music-empty"><span className="music-empty-symbol" aria-hidden="true"><Icon name="queue" /></span><h3>Hàng đợi đang trống</h3><p>Thêm vài giai điệu yêu thích để bắt đầu.</p><button className="music-button" onClick={() => setPanel('search')}>Tìm bài hát</button></div>}
          </div></div>}
        </section>
      </div>}
      <p className="music-notice" role="status">{notice}</p>
    </main>
    <footer className="music-footer"><span>Khoavila Music</span><span>↑ ↓ ← → Di chuyển <b>OK</b> Chọn <b>Back</b> Quay lại</span></footer>
    <dialog className="music-dialog" ref={dialogRef} onCancel={event => { event.preventDefault(); setDialog(null); }} onClose={() => setDialog(null)} aria-labelledby="music-dialog-title">
      <div className="music-dialog-heading"><h2 id="music-dialog-title">{dialog === 'connect' ? 'Nghe cùng nhau' : dialog === 'new-room' ? 'Mở phòng nhạc mới?' : 'Thoát phòng nhạc?'}</h2><button className="music-button music-button-quiet" autoFocus aria-label="Đóng" onClick={() => setDialog(null)}><Icon name="close" /></button></div>
      {dialog === 'connect' && roomId ? <><p>Quét QR bằng điện thoại để chọn bài và điều khiển.</p><div className="music-qr"><QRCodeCanvas value={remoteRoomUrl(roomId)} size={208} marginSize={4} /></div><p className="music-dialog-code">PHÒNG <strong>{roomId}</strong></p><button className="music-button" onClick={() => setDialog('new-room')}>Tạo phòng mới</button></> : <><p>{dialog === 'new-room' ? 'Nhạc trong phòng hiện tại sẽ dừng. Phòng mới có mã QR và hàng đợi riêng.' : 'Nhạc sẽ tạm dừng. Hàng đợi được giữ lại cho lần nghe tiếp theo.'}</p><div className="music-dialog-actions"><button className="music-button" onClick={() => setDialog(null)}>Tiếp tục nghe</button><button className="music-button music-button-primary" disabled={busy || starting} onClick={() => void (dialog === 'new-room' ? createFreshRoom() : exit())}>{dialog === 'new-room' ? 'Tạo phòng mới' : 'Thoát'}</button></div></>}
      {actionError && <p className="music-alert" role="alert">{actionError}</p>}
    </dialog>
  </div>;
}
