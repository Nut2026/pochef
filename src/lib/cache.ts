/**
 * Reactive cache with event-listener invalidation.
 * Components subscribe to specific keys; invalidateCache(key) fires all
 * listeners so dependent components re-fetch from Supabase immediately.
 */
export const appCache = new Map<string, unknown>();

type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();

/** Subscribe to invalidation events for a specific key. Returns unsubscribe fn. */
export function onCacheInvalidate(key: string, listener: Listener): () => void {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(listener);
  return () => listeners.get(key)?.delete(listener);
}

export function invalidateCache(key?: string) {
  if (key) {
    appCache.delete(key);
    listeners.get(key)?.forEach(fn => fn());
  } else {
    appCache.clear();
    listeners.forEach(set => set.forEach(fn => fn()));
  }
}
