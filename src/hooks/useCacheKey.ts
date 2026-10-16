import { useEffect, useState } from 'react';
import { onCacheInvalidate } from '@/lib/cache';

/**
 * Returns a version counter that increments every time the given cache key
 * is invalidated. Include this in useEffect deps to force a re-fetch.
 */
export function useCacheKey(key: string): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const unsub = onCacheInvalidate(key, () => setVersion(v => v + 1));
    return unsub;
  }, [key]);
  return version;
}
