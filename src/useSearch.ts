import { useState, useRef, useCallback, useEffect } from 'react';
import { YOUTUBE_API_KEY } from './config';
import { Song, ExtendedSong } from './types';
import { logger } from './logger';

const SEARCH_LIMIT = 8; // Increased from 4 to reduce API calls
const CACHE_PREFIX = 'yt_search_cache_';
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // Increased from 30 days
const MIN_REQUEST_INTERVAL = 2000; // Increased from 500ms to reduce rapid calls
const DEBOUNCE_DELAY = 1500; // Increased from 300ms to reduce API calls

// ============ QUERY NORMALIZATION ============
const normalizeQuery = (q: string) =>
  q.trim().toLowerCase().replace(/\s+/g, ' ');

// ============ CACHE KEY GENERATION ============
const getCacheKey = (q: string) => {
  // Loại bỏ từ 'karaoke' (và các biến thể viết hoa) trước khi chuẩn hóa
  const cleaned = q.replace(/karaoke/gi, '').trim();
  return CACHE_PREFIX + normalizeQuery(cleaned);
};

// ============ CACHE MANAGEMENT ============
const getCachedSearch = (q: string): any => {
  try {
    const key = getCacheKey(q);
    const data = localStorage.getItem(key);
    if (!data) return null;

    const parsed = JSON.parse(data);
    if (Date.now() - parsed.timestamp < CACHE_TTL) {
      logger.debug('✅ Hit localStorage cache for:', q);
      return parsed;
    }
  } catch (e) {
    logger.warn('Cache read error:', e);
  }
  return null;
};

const setCachedSearch = (q: string, items: ExtendedSong[], nextPageToken?: string) => {
  try {
    const cacheSize = Object.keys(localStorage)
      .filter(k => k.startsWith(CACHE_PREFIX))
      .length;

    if (cacheSize > 30) { // Increased from 20 to 30
      // Clear oldest cache entries
      const oldestKey = Object.keys(localStorage)
        .filter(k => k.startsWith(CACHE_PREFIX))
        .reduce((oldest, key) => {
          const oldestData = JSON.parse(localStorage.getItem(oldest) || '{}');
          const currentData = JSON.parse(localStorage.getItem(key) || '{}');
          return (currentData.timestamp || 0) < (oldestData.timestamp || 0) ? key : oldest;
        });
      localStorage.removeItem(oldestKey);
      logger.debug('Cleaned up old cache entries');
    }

    const key = CACHE_PREFIX + normalizeQuery(q);
    localStorage.setItem(key, JSON.stringify({
      items,
      nextPageToken,
      timestamp: Date.now()
    }));
  } catch (e) {
    logger.warn('Cache write error:', e);
  }
};

// ============ DEBOUNCE HOOK ============
const useDebounce = <T,>(value: T, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

// ============ BATCH VIDEO DETAILS REQUEST ============
// Global video detail cache
// @ts-ignore
let videoDetailCache: { [key: string]: any } = {};
try {
  const savedCache = localStorage.getItem('yt_video_details_cache');
  if (savedCache) {
    const parsedCache = JSON.parse(savedCache);
    videoDetailCache = parsedCache;
    logger.info('Restored video detail cache from localStorage');
  }
} catch (e) {
  logger.warn('Could not restore video detail cache:', e);
}

const saveVideoDetailCache = () => {
  try {
    localStorage.setItem('yt_video_details_cache', JSON.stringify(videoDetailCache));
  } catch (e) {
    logger.warn('Failed to save video details cache:', e);
  }
};

const batchVideoDetailRequests = async (
  videoIds: string[],
  signal: AbortSignal
) => {
  const BATCH_SIZE = 50;
  const batches = [];

  for (let i = 0; i < videoIds.length; i += BATCH_SIZE) {
    batches.push(videoIds.slice(i, i + BATCH_SIZE));
  }

  const allDetails: any[] = [];

  for (const batch of batches) {
    // Check cache first
    const cachedIds = batch.filter(id => {
      const cached = videoDetailCache[id];
      return cached && Date.now() - cached.timestamp < CACHE_TTL;
    });

    const uncachedIds = batch.filter(id => !cachedIds.includes(id));

    if (uncachedIds.length > 0) {
      const detailUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${uncachedIds.join(',')}&fields=items(id,contentDetails(duration),statistics(viewCount))&key=${YOUTUBE_API_KEY}`;

      const detailRes = await fetch(detailUrl, { signal });
      const detailData = await detailRes.json();

      if (detailData.error) throw new Error(detailData.error.message);

      // Update cache
      detailData.items?.forEach((item: any) => {
        videoDetailCache[item.id] = {
          duration: item.contentDetails?.duration,
          viewCount: item.statistics?.viewCount,
          timestamp: Date.now(),
        };
      });

      allDetails.push(...(detailData.items || []));
    }

    // Add cached items to results
    cachedIds.forEach(id => {
      const cached = videoDetailCache[id];
      if (cached) {
        allDetails.push({
          id,
          contentDetails: { duration: cached.duration },
          statistics: { viewCount: cached.viewCount }
        });
      }
    });
  }

  // Save updated cache
  saveVideoDetailCache();

  return allDetails;
};

// ============ OPTIMIZE SEARCH QUERY ============
const buildOptimizedSearchQuery = (q: string, mode: 'karaoke' | 'music' = 'karaoke') => {
  // Add mode-specific keyword intelligently
  const query = q.toLowerCase();

  // Avoid duplication if mode keyword already in query
  if (mode === 'karaoke' && query.includes('karaoke')) {
    return q;
  } else if (mode === 'music' && (query.includes('music') || query.includes('audio'))) {
    return q;
  }

  // For karaoke mode, add karaoke keyword
  if (mode === 'karaoke') {
    // For Vietnamese, add proper ordering
    const isVietnamese = /[àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/.test(query);
    if (isVietnamese) {
      return `${q} karaoke vietnam`;
    }
    return `${q} karaoke`;
  }

  // For music mode, just return the query as-is (no karaoke keyword)
  return q;
};

const MAX_PAGES = 1;

export const useSearch = (initialMode: 'karaoke' | 'music' = 'karaoke') => {
  // Search State
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ExtendedSong[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [pagesLoaded, setPagesLoaded] = useState(0); // Track number of pages loaded for current query
  const [mode, setMode] = useState<'karaoke' | 'music'>(initialMode);

  // Optimization: Debounced query
  const debouncedQuery = useDebounce(query, DEBOUNCE_DELAY);

  const lastKeywordRef = useRef<string>('');
  const searchAbortControllerRef = useRef<AbortController | null>(null);
  const searchCacheRef = useRef<Map<string, { results: ExtendedSong[]; timestamp: number }>>(new Map());

  // API Usage & Rate Limiting
  const [apiUsage, setApiUsage] = useState(() => {
    const savedUsage = localStorage.getItem('ytApiUsage');
    return savedUsage ? parseInt(savedUsage, 10) : 0;
  });

  const lastRequestRef = useRef<number>(0);
  const requestQueueRef = useRef<Promise<void>>(Promise.resolve());

  // Daily reset
  useEffect(() => {
    const checkAndResetDaily = () => {
      const lastReset = localStorage.getItem('lastApiReset');
      const today = new Date().toDateString();

      if (lastReset !== today) {
        setApiUsage(0);
        localStorage.setItem('ytApiUsage', '0');
        localStorage.setItem('lastApiReset', today);
        logger.info('🔄 Daily quota reset');
      }
    };

    checkAndResetDaily();
    const timer = setInterval(checkAndResetDaily, 60000); // Check every minute
    return () => clearInterval(timer);
  }, []);

  const trackApiUsage = useCallback((units: number) => {
    setApiUsage(prev => {
      const newUsage = prev + units;
      localStorage.setItem('ytApiUsage', newUsage.toString());
      logger.debug(`📊 API Usage: +${units} units → ${newUsage}/10000 (${(newUsage / 10000 * 100).toFixed(1)}%)`);
      return newUsage;
    });
  }, []);

  // Queue requests to prevent race conditions
  const queueRequest = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    return new Promise((resolve, reject) => {
      requestQueueRef.current = requestQueueRef.current
        .then(() => fn())
        .then(resolve)
        .catch(reject);
    });
  }, []);

  // Optimized search with early returns
  const search = useCallback(
    async (rawQuery: string, pageToken?: string) => {
      const q = normalizeQuery(rawQuery);

      // Early return: empty query
      if (!q) {
        setResults([]);
        return;
      }

      // Early return: query too short (save API quota)
      if (q.length < 2) {
        logger.debug('⏭️ Query too short, skipping');
        setResults([]);
        return;
      }

      // Early return: same query, no pagination
      if (!pageToken && lastKeywordRef.current === q) {
        logger.debug('⏭️ Same query, skipping');
        return;
      }

      // Early return: pagination limit reached
      if (pageToken && pagesLoaded >= MAX_PAGES) {
        logger.debug('⏭️ Max page limit reached');
        setError('Đã đạt đến giới hạn số trang tìm kiếm');
        return;
      }

      // Throttle checks
      const now = Date.now();
      if (now - lastRequestRef.current < MIN_REQUEST_INTERVAL) {
        logger.warn('Request throttled');
        return;
      }

      // Queue the request to prevent race conditions
      await queueRequest(async () => {
        searchAbortControllerRef.current?.abort();
        searchAbortControllerRef.current = new AbortController();
        const { signal } = searchAbortControllerRef.current;

        lastRequestRef.current = Date.now();

        // Check in-memory cache first (faster than localStorage)
        const memCacheKey = q + (pageToken || '');
        const memCached = searchCacheRef.current.get(memCacheKey);
        if (memCached && Date.now() - memCached.timestamp < CACHE_TTL) {
          logger.debug('✅ Hit memory cache');
          setResults(memCached.results);
          lastKeywordRef.current = q;
          return;
        }

        // Check localStorage cache
        if (!pageToken) {
          const cached = getCachedSearch(q);
          if (cached) {
            logger.debug('✅ Hit exact localStorage cache');
            setResults(cached.items);
            setNextPageToken(cached.nextPageToken);
            lastKeywordRef.current = q;
            searchCacheRef.current.set(memCacheKey, {
              results: cached.items,
              timestamp: Date.now()
            });

            // Skip fetching video details in background to preserve lazy loading
            // Video details will be fetched when user selects a song
            return;
          }
        }

        setLoading(true);
        setError(null);

        try {
          const optimizedQuery = buildOptimizedSearchQuery(q, mode);

          // Trong hàm search, khi xây dựng URL
          const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${SEARCH_LIMIT}&q=${encodeURIComponent(optimizedQuery)}&regionCode=VN&relevanceLanguage=vi&fields=items(id/videoId,snippet(title,thumbnails/default/url)),nextPageToken&key=${YOUTUBE_API_KEY}${pageToken ? `&pageToken=${pageToken}` : ''}`;

          const searchRes = await fetch(searchUrl, { signal });
          if (!searchRes.ok) throw new Error(`HTTP ${searchRes.status}`);

          const searchData = await searchRes.json();
          if (searchData.error) throw new Error(searchData.error.message);

          const videoIds = searchData.items?.map((i: any) => i.id.videoId) || [];
          let extendedItems: ExtendedSong[] = searchData.items?.map((item: any) => ({
            id: item.id.videoId,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails.default.url,
            isPriority: false,
          })) || [];

          // Skip fetching video details immediately (lazy load)
          // Only fetch basic search results to save API units
          // Video details will be fetched when user selects a song
          extendedItems = extendedItems.map(item => ({
            ...item,
            // Mark that details are not loaded yet
            detailsLoaded: false,
            // Don't set duration and viewCount to undefined to avoid Firebase issues
            // They will be undefined by default if not present
          }));

          // Update state and caches using a functional update to avoid stale state
          setResults(currentResults => {
            const newItems = pageToken ? [...currentResults, ...extendedItems] : extendedItems;

            // Caching is done inside the updater to ensure consistency
            setCachedSearch(q, newItems, searchData.nextPageToken);
            searchCacheRef.current.set(memCacheKey, {
              results: newItems,
              timestamp: Date.now(),
            });

            return newItems;
          });

          setNextPageToken(searchData.nextPageToken);
          lastKeywordRef.current = q;

          // Update pages loaded counter when loading next page
          if (pageToken) {
            setPagesLoaded(prev => prev + 1);
          } else {
            // Reset counter for new search
            setPagesLoaded(0);
          }

          trackApiUsage(100); // search (100) - no video details API call due to lazy loading
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            setError(err.message || 'Search failed');
            logger.error('Search failed:', err);
          }
        } finally {
          setLoading(false);
        }
      });
    },
    [queueRequest, trackApiUsage]
  );

  // Auto-search with debounced query
  useEffect(() => {
    if (debouncedQuery && debouncedQuery !== lastKeywordRef.current) {
      search(debouncedQuery);
    }
  }, [debouncedQuery, search]);

  const clearResults = useCallback(() => {
    setResults([]);
    setQuery('');
    lastKeywordRef.current = '';
  }, []);

  // Function to fetch video details lazily when needed
  const fetchVideoDetails = useCallback(
    async (videoIds: string[]) => {
      if (!videoIds || videoIds.length === 0) return;

      // Filter out already cached details
      const missingIds = videoIds.filter(id => {
        const cached = videoDetailCache[id];
        return !cached || Date.now() - cached.timestamp >= CACHE_TTL;
      });

      if (missingIds.length === 0) {
        logger.debug('✅ All video details already cached');
        return;
      }

      try {
        logger.debug(`📥 Fetching details for ${missingIds.length} videos...`);
        const allDetails = await batchVideoDetailRequests(missingIds, new AbortController().signal);

        // Update results with new details
        setResults(prevResults => {
          return prevResults.map(item => {
            const detail = allDetails.find(d => d.id === item.id);
            if (detail && !item.detailsLoaded) {
              return {
                ...item,
                duration: detail.contentDetails?.duration,
                viewCount: detail.statistics?.viewCount,
                detailsLoaded: true,
              };
            }
            return item;
          });
        });

        logger.debug(`✅ Fetched details for ${missingIds.length} videos`);
      } catch (err) {
        logger.error('Failed to fetch video details:', err);
      }
    },
    []
  );

  // Calculate usage stats
  const usageStats = {
    used: apiUsage,
    remaining: Math.max(0, 10000 - apiUsage),
    percentage: Math.min(100, (apiUsage / 10000) * 100),
  };

  // Check if we can make a request
  const canMakeRequest = useCallback((type: 'search' | 'video' = 'search') => {
    const cost = type === 'search' ? 100 : 1; // Search costs 100 units, video details cost 1 unit
    return apiUsage + cost <= 10000;
  }, [apiUsage]);

  // Load more results
  const loadMore = useCallback(() => {
    if (nextPageToken && !loading) {
      search(lastKeywordRef.current, nextPageToken);
    }
  }, [nextPageToken, loading, search]);

  // Function to update mode
  const setModeCallback = useCallback((newMode: 'karaoke' | 'music') => {
    setMode(newMode);
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
    apiUsage,
    usageStats,
    canMakeRequest,
    clearResults,
    fetchVideoDetails, // Add the lazy loading function
    loadMore,
    setMode: setModeCallback,
    currentMode: mode,
  };
};