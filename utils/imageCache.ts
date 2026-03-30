/**
 * imageCache.ts
 *
 * Caches remote images to the local filesystem.
 *
 * Improvements over v1:
 *  - Directory existence check is done once and memoised (not on every call).
 *  - Cache keys are hashed from the full URL, not just the filename, so
 *    two different URLs that end with the same filename don't collide.
 *  - In-flight deduplication: if the same URL is being downloaded concurrently
 *    (e.g. multiple ChapterCards mounting at once), only one network request
 *    is made; subsequent callers await the same promise.
 */
import * as FileSystem from 'expo-file-system';

const CACHE_DIR = FileSystem.cacheDirectory + 'mangaCovers/';

// True once we've confirmed the directory exists for this app session.
let dirReady = false;
const ensureDirReady = async () => {
  if (dirReady) return;
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
  dirReady = true;
};

// Simple djb2 hash — fast, no dependencies, good enough for filenames.
function hashUrl(url: string): string {
  let h = 5381;
  for (let i = 0; i < url.length; i++) {
    h = ((h << 5) + h) ^ url.charCodeAt(i);
    h = h >>> 0; // keep unsigned 32-bit
  }
  const ext = url.split('?')[0].split('.').pop()?.slice(0, 4) ?? 'jpg';
  return `${h.toString(36)}.${ext}`;
}

// In-flight request deduplication map.
const inflight = new Map<string, Promise<string>>();

export const getCachedImage = async (url: string): Promise<string> => {
  if (!url) return url;

  // Return in-flight promise if one exists for this URL
  const existing = inflight.get(url);
  if (existing) return existing;

  const promise = (async (): Promise<string> => {
    try {
      await ensureDirReady();
      const localUri = CACHE_DIR + hashUrl(url);
      const info = await FileSystem.getInfoAsync(localUri);
      if (info.exists) return localUri;
      const { uri } = await FileSystem.downloadAsync(url, localUri);
      return uri;
    } catch {
      return url; // Fallback to remote URL on any error
    } finally {
      inflight.delete(url);
    }
  })();

  inflight.set(url, promise);
  return promise;
};

export const clearImageCache = async () => {
  dirReady = false;
  await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
};
