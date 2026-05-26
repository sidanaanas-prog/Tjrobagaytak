import { useState, useEffect, useCallback } from "react";

const CACHE_PREFIX = "gaytak_cache_";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 ساعة

function getCacheKey(key: string) { return CACHE_PREFIX + key; }

export function getCachedData<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(getCacheKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > CACHE_TTL) {
      localStorage.removeItem(getCacheKey(key));
      return null;
    }
    return parsed.data;
  } catch { return null; }
}

export function setCachedData<T>(key: string, data: T) {
  try {
    localStorage.setItem(getCacheKey(key), JSON.stringify({ timestamp: Date.now(), data }));
  } catch { /* ignore */ }
}

// هوك يستخدم الكاش المحلي في localStorage لعرض بيانات فورية
export function useInstantCache<T>(
  queryKey: string,
  fetcher: () => Promise<T>,
  enabled = true
): { data: T | null; isLoading: boolean; isFetching: boolean; refetch: () => void } {
  const cacheKey = Array.isArray(queryKey) ? queryKey.join("_") : queryKey;
  const [data, setData] = useState<T | null>(() => getCachedData<T>(cacheKey));
  const [isLoading, setIsLoading] = useState(!data);
  const [isFetching, setIsFetching] = useState(false);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    setIsFetching(true);
    try {
      const fresh = await fetcher();
      setData(fresh);
      setCachedData(cacheKey, fresh);
      setIsLoading(false);
    } catch {
      // بقاء البيانات القديمة
    } finally {
      setIsFetching(false);
    }
  }, [cacheKey, enabled, fetcher]);

  useEffect(() => {
    if (!enabled) { setIsLoading(false); return; }
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { data, isLoading, isFetching, refetch };
}
