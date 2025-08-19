import * as FileSystem from 'expo-file-system';

const CACHE_DIR = FileSystem.cacheDirectory + "mangaCovers/";

// ensure the cache directory exists
const ensureDirExists = async () => {
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if(!dirInfo.exists){
        await FileSystem.makeDirectoryAsync(CACHE_DIR, {intermediates: true});
    }
}

// get cached image or download and cache it
export const getCachedImage = async (uri: string): Promise<string> => {
    await ensureDirExists();

    const filename = uri.split('/').pop() || String(Math.random());
    const localUri = CACHE_DIR + filename;

    // Check if image is already cached
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (fileInfo.exists) {
        return localUri;
    }
    
    // If not, download and cache it
    try {
        const { uri: downloadedUri } = await FileSystem.downloadAsync(uri, localUri);
        return downloadedUri;
    } catch (error) {
        console.error('Error caching image:', error);
        return uri; // Fallback to original URI
    }
};

export const clearImageCache = async () => {
    await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
};