import { useState, useEffect, useRef, useCallback } from 'react';
import useDebounce from './useDebounce';
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

const calculateApiUsage = (itemCount: number, isNewSearch: boolean) => {
  // Each successful search API call costs 100 units.
  return 100;
};

const MAX_CACHE_SIZE = 5; // Limits the number of search queries to cache in memory.

export const useSearch = () => {
  // Search State
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ExtendedSong[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const lastKeywordRef = useRef<string>('');
  const [searchCache, setSearchCache] = useState(new Map());
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
          if (newUsage > 9000) {
              logger.warn(`API quota warning: ${newUsage}/10000 units used.`);
              setError(`Cảnh báo: Hạn ngạch API sắp hết! (${newUsage}/10000)`);
          }
          return newUsage;
      });
  };

  const search = useCallback(async (rawQuery: string, pageToken?: string) => {
    // Abort previous request
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

    // 1. Cache-first check for initial search
    if (!pageToken && searchCache.has(q)) {
      const cached = searchCache.get(q);
      if (Date.now() - cached.timestamp < 10 * 60 * 1000) { // 10-minute TTL
        setResults(cached.items);
        setNextPageToken(cached.nextPageToken);
        lastKeywordRef.current = q;
        return;
      }
    }

    if (YOUTUBE_API_KEY === 'YOUR_YOUTUBE_API_KEY_HERE') {
      setError('Missing YouTube API key');
      return;
    }

    setLoading(true);
    setError(null);
    if (!pageToken) {
      setResults([]);
    }
    
    try {
      let url =
        `https://www.googleapis.com/youtube/v3/search` +
        `?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(q + ' karaoke')}` +
        `&fields=items(id/videoId,snippet/title,snippet/thumbnails/default),nextPageToken&key=${YOUTUBE_API_KEY}`;

      if (pageToken) {
        url += `&pageToken=${pageToken}`;
      }

      const res = await fetch(url, { signal }); // Pass the signal
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      // Track API usage after successful fetch
      const actualCost = calculateApiUsage(data.items?.length || 0, !pageToken);
      trackApiUsage(actualCost);

      const newItems: ExtendedSong[] = (data.items || []).map((item: any) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.default.url,
        isPriority: false
      }));

      // 2. Update state and cache
      if (pageToken) {
        // Append results
        const cached = searchCache.get(q) || { items: [] };
        const allItems = [...cached.items, ...newItems];
        setResults(allItems);
        setSearchCache(prevCache => {
          const newCache = new Map(prevCache);
          newCache.set(q, {
            items: allItems,
            nextPageToken: data.nextPageToken,
            timestamp: Date.now()
          });
          // LRU cleanup
          if (newCache.size > MAX_CACHE_SIZE) {
            const oldestKey = newCache.keys().next().value; // Map keys are ordered by insertion
            newCache.delete(oldestKey);
          }
          return newCache;
        });
      } else {
        // Set new results
        setResults(newItems);
        setSearchCache(prevCache => {
          const newCache = new Map(prevCache);
          newCache.set(q, {
            items: newItems,
            nextPageToken: data.nextPageToken,
            timestamp: Date.now()
          });
          // LRU cleanup
          if (newCache.size > MAX_CACHE_SIZE) {
            const oldestKey = newCache.keys().next().value; // Map keys are ordered by insertion
            newCache.delete(oldestKey);
          }
          return newCache;
        });
      }
      
      setNextPageToken(data.nextPageToken);
      lastKeywordRef.current = q;
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
  }, [searchCache]); // Dependency on searchCache

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
  };
};