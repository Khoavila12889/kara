import { useEffect, useRef, useState } from 'react';
import { YOUTUBE_API_KEY } from '../config';
import { ExtendedSong } from '../types';

export function useMusicSearch() {
  const [results, setResults] = useState<ExtendedSong[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController>();
  useEffect(() => () => controller.current?.abort(), []);
  const search = async (query: string) => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setError(''); setResults([]);
    if (query.trim().length < 2) { setLoading(false); return; }
    if (!YOUTUBE_API_KEY) { setError('Tìm kiếm chưa được cấu hình. Bạn vẫn có thể thêm bài từ điện thoại qua mã QR.'); setLoading(false); return; }
    setLoading(true);
    const timeout = window.setTimeout(() => request.abort(), 15000);
    try {
      const params = new URLSearchParams({ part: 'snippet', type: 'video', videoEmbeddable: 'true', maxResults: '12', q: query.trim(), key: YOUTUBE_API_KEY });
      const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, { signal: request.signal });
      if (!response.ok) throw new Error(response.status === 403 ? 'Không thể tìm kiếm: kiểm tra hạn mức và cấu hình YouTube.' : 'Tìm kiếm đang gián đoạn. Vui lòng thử lại.');
      const data = await response.json();
      if (controller.current !== request) return;
      // Decode YouTube text entities as text, never as markup in the UI.
      const decode = (value: string) => new DOMParser().parseFromString(value, 'text/html').documentElement.textContent || value;
      setResults((data.items || []).map((item: any) => ({ id: item.id.videoId,
        title: decode(item.snippet.title), channelTitle: decode(item.snippet.channelTitle), thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url })));
    } catch (err) {
      if (controller.current === request) setError(request.signal.aborted ? 'Tìm kiếm quá thời gian. Vui lòng thử lại.' : err instanceof Error ? err.message : 'Không thể tìm kiếm.');
    } finally {
      clearTimeout(timeout);
      if (controller.current === request) setLoading(false);
    }
  };
  return { results, loading, error, search };
}
