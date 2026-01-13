import { useState, useRef, useCallback } from 'react';
// import useDebounce from './useDebounce'; // Comment out unused import
import { YOUTUBE_API_KEY } from './config';
import { Song, ExtendedSong } from './types';
import { logger } from './logger';

const normalizeQuery = (q: string) =>
  q
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const resetApiUsageDaily = (usage: number) => {
    const lastReset = localStorage.getItem('lastApiReset');
    const today = new Date().toDateString();
    if (lastReset !== today) {
        localStorage.setItem('ytApiUsage', '0');
        localStorage.setItem('lastApiReset', today);
        return 0;
    }
    return usage;
};

const CACHE_PREFIX = 'yt_search_cache_';
const CACHE_TTL = 20 * 60 * 1000; // 20 minutes

const getCachedSearch = (q: string) => {
  const key = CACHE_PREFIX + q;
  const data = localStorage.getItem(key);
  if (!data) return null;
  
  try {
    const parsed = JSON.parse(data);
    if (Date.now() - parsed.timestamp < CACHE_TTL) return parsed;
  } catch {}
  localStorage.removeItem(key);
  return null;
};

const setCachedSearch = (q: string, items: ExtendedSong[], nextPageToken?: string) => {
  const key = CACHE_PREFIX + q;
  localStorage.setItem(key, JSON.stringify({
    items,
    nextPageToken,
    timestamp: Date.now()
  }));
};

export const useSearch = () => {
  // Search State
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ExtendedSong[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const lastKeywordRef = useRef<string>('');
  const searchAbortControllerRef = useRef<AbortController | null>(null);

  // Trending State
  const [trendingSongs, setTrendingSongs] = useState<ExtendedSong[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [trendingError, setTrendingError] = useState<string | null>(null);
  const TRENDING_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  // API Usage & Rate Limiting
  const [apiUsage, setApiUsage] = useState(() => {
      const savedUsage = localStorage.getItem('ytApiUsage');
      return resetApiUsageDaily(savedUsage ? parseInt(savedUsage, 10) : 0);
  });
  const lastRequestRef = useRef<number>(0);
  const MIN_REQUEST_INTERVAL = 1000; // 1 second

  const trackApiUsage = (units: number) => {
      setApiUsage(prevUsage => {
          const newUsage = prevUsage + units;
          localStorage.setItem('ytApiUsage', newUsage.toString());
          console.log('Current API Usage:', newUsage);
          console.log('As percentage:', (newUsage / 10000 * 100).toFixed(2) + '%');
          return newUsage;
      });
  };

  const search = useCallback(async (rawQuery: string, pageToken?: string) => {
    searchAbortControllerRef.current?.abort();
    searchAbortControllerRef.current = new AbortController();
    const { signal } = searchAbortControllerRef.current;

    const now = Date.now();
    if (now - lastRequestRef.current < MIN_REQUEST_INTERVAL) {
      logger.warn('Request throttled');
      return;
    }
    lastRequestRef.current = now;
  
    const q = normalizeQuery(rawQuery);
    if (!q) return;
  
    if (!pageToken) {
      const cached = getCachedSearch(q);
      if (cached) {
        setResults(cached.items);
        setNextPageToken(cached.nextPageToken);
        lastKeywordRef.current = q;
        return;
      }
    }
  
    setLoading(true);
    setError(null);
    
    try {
      // Step 1: Search for video IDs
      let searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(q + ' karaoke')}&fields=items(id/videoId,snippet(title,thumbnails/default/url)),nextPageToken&key=${YOUTUBE_API_KEY}`;
      if (pageToken) searchUrl += `&pageToken=${pageToken}`;
  
      const searchRes = await fetch(searchUrl, { signal });
      const searchData = await searchRes.json();
      if (searchData.error) throw new Error(searchData.error.message);
  
      const videoIds = searchData.items?.map((i: any) => i.id.videoId) || [];
      let extendedItems: ExtendedSong[] = searchData.items?.map((item: any) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.default.url,
        isPriority: false,
      })) || [];
  
      // Step 2: Fetch duration and viewCount for the found videos
      if (videoIds.length > 0) {
        const detailUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${videoIds.join(',')}&fields=items(id,contentDetails(duration),statistics(viewCount))&key=${YOUTUBE_API_KEY}`;
        const detailRes = await fetch(detailUrl, { signal });
        const detailData = await detailRes.json();
  
        if (!detailData.error) {
          const detailsMap = new Map(detailData.items?.map((i: any) => [i.id, i]) || []);
          extendedItems = extendedItems.map(item => {
            const detail = detailsMap.get(item.id);
            return {
              ...item,
              duration: (detail as any)?.contentDetails?.duration,
              viewCount: (detail as any)?.statistics?.viewCount,
            };
          });
        }
      }
      
      // Update state and cache
      const existingItems = pageToken ? (getCachedSearch(q)?.items || []) : [];
      const allItems = [...existingItems, ...extendedItems];
      
      setResults(allItems);
      setCachedSearch(q, allItems, searchData.nextPageToken);
      
      setNextPageToken(searchData.nextPageToken);
      lastKeywordRef.current = q;

      trackApiUsage(100 + 1); // search (100) + videos.list (1)
  
    } catch (err: any) {
      if (err.name === 'AbortError') {
        logger.info('Search request aborted.');
      } else {
        setError(err.message || 'Search failed');
        logger.error("Search failed:", err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const clearResults = useCallback(() => setResults([]), []);

  const fetchTrending = useCallback(async () => {
    const cacheKey = 'trending_songs_vn';
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < TRENDING_CACHE_TTL) {
          setTrendingSongs(data);
          setTrendingLoading(false); // Make sure loading is set to false
          return;
        }
      } catch (e) {
        logger.error("Error parsing trending cache:", e);
        localStorage.removeItem(cacheKey);
      }
    }

    const now = Date.now();
    if (now - lastRequestRef.current < MIN_REQUEST_INTERVAL) {
        logger.warn('Trending request throttled');
        return;
    }
    lastRequestRef.current = now;
    
    setTrendingLoading(true);
    setTrendingError(null);
    
    if (YOUTUBE_API_KEY === 'YOUR_YOUTUBE_API_KEY_HERE') {
      setTrendingError('Missing YouTube API key for trending');
      setTrendingLoading(false);
      return;
    }

    try {
      const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=karaoke+vietnam&type=video&order=viewCount&regionCode=VN&videoCategoryId=10&maxResults=20&key=${YOUTUBE_API_KEY}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      trackApiUsage(100); // A trending search API call also costs 100 units.

      const items: ExtendedSong[] = (data.items || []).map((item: any) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.default.url,
        isPriority: false,
      }));
      localStorage.setItem(cacheKey, JSON.stringify({ data: items, timestamp: Date.now() }));
      setTrendingSongs(items);
    } catch (err: any) {
      setTrendingError(err.message || 'Could not fetch trending songs');
      logger.error("Could not fetch trending songs:", err);
    } finally {
      setTrendingLoading(false);
    }
  }, []);


  return { 
    query, 
    setQuery, 
    results, 
    loading, 
    error, 
    nextPageToken, 
    search, 
    lastKeyword: lastKeywordRef.current,
    trendingSongs,
    trendingLoading,
    trendingError,
    fetchTrending,
    apiUsage,
    clearResults,
  };
};