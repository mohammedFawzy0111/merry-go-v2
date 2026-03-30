
import { Download } from '@/db/db';
import { NotificationService } from '@/services/notificationService';
import { sourceManager } from '@/sources';
import RNBackgroundDownloader from '@kesha-antonov/react-native-background-downloader';
import * as FileSystem from 'expo-file-system';

// Internal reference to the store state/actions
let store: any = null;

/**
 * Injects the store reference to break circular dependency.
 * Called by downloadStore.ts
 */
export const injectStore = (storeInstance: any) => {
  store = storeInstance;
};

export const startDownloadService = async (): Promise<void> => {
  if (!store) return;
  
  await store.loadDownloads();
  const pending = store.downloads.filter((d: Download) => d.status === 'pending');

  if (pending.length === 0) return;

  for (const download of pending) {
    await processDownload(download);
  }
};

export const stopDownloadService = async (): Promise<void> => {
  try {
    const tasks = await RNBackgroundDownloader.checkForExistingDownloads();
    for (const task of tasks) {
      task.stop();
    }
  } catch (error) {
    console.error('Error stopping downloads:', error);
  }
};

export const resumeDownloads = async (): Promise<void> => {
  if (!store) return;
  try {
    const tasks = await RNBackgroundDownloader.checkForExistingDownloads();
    for (const task of tasks) {
      const downloadId = task.id.split('-page-')[0];
      task
        .progress(({ bytesDownloaded, bytesTotal }) => {
          const percent = (bytesDownloaded / bytesTotal) * 100;
          store.updateDownloadProgress(downloadId, percent, 'downloading');
        })
        .done(() => {
          store.updateDownloadProgress(downloadId, 100, 'done');
        })
        .error(({ error }) => {
          console.error('Resumed task failed:', error);
          store.updateDownloadProgress(downloadId, 0, 'error');
        });
    }
  } catch (error) {
    console.error('Error resuming downloads:', error);
  }
};

export const getLocalPath = (mangaTitle: string, chapterTitle: string): string => {
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '_');
  return `${FileSystem.documentDirectory}downloads/${safe(mangaTitle)}/${safe(chapterTitle)}/`;
};

export const getDownloadStatus = async (chapterUrl: string) => {
  if (!store) return null;
  const download = await store.getDownloadByChapter(chapterUrl);
  return download?.status ?? null;
};

export const getDownloadProgress = async (chapterUrl: string): Promise<number> => {
  if (!store) return 0;
  const download = await store.getDownloadByChapter(chapterUrl);
  return download?.progress ?? 0;
};

const processDownload = async (download: Download): Promise<void> => {
  if (!store) return;
  try {
    await store.updateDownloadProgress(download.id, 0, 'downloading');

    const sourceInfo = sourceManager
      .getAllSources()
      .find((s) => download.chapterUrl.includes(s.source.baseUrl));

    if (!sourceInfo) throw new Error(`Source not found`);

    const chapterData = await sourceInfo.source.fetchChapterDetails(download.chapterUrl);
    if (!chapterData.pages.length) throw new Error('No pages found');

    const chapterDir = getLocalPath(download.mangaTitle, download.chapterTitle);
    await FileSystem.makeDirectoryAsync(chapterDir, { intermediates: true });

    const totalPages = chapterData.pages.length;
    let completedPages = 0;

    for (const [index, pageUrl] of chapterData.pages.entries()) {
      const filePath = `${chapterDir}page_${index + 1}.jpg`;
      const taskId = `${download.id}-page-${index}`;

      try {
        await downloadPage(taskId, pageUrl, filePath, download.id, index, totalPages, download.mangaTitle, download.chapterTitle, completedPages);
        completedPages++;
      } catch (err) {
        break;
      }
    }

    if (completedPages === totalPages) {
      await store.updateDownloadProgress(download.id, 100, 'done');
      NotificationService.showDownloadComplete(download.id, download.mangaTitle, download.chapterTitle);
    } else {
      await store.updateDownloadProgress(download.id, 0, 'error');
    }
  } catch (error) {
    await store.updateDownloadProgress(download.id, 0, 'error');
  }
};

const downloadPage = (taskId: string, url: string, destination: string, downloadId: string, index: number, totalPages: number, mangaTitle: string, chapterTitle: string, completedPages: number): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const task = RNBackgroundDownloader.download({ id: taskId, url, destination });
    task
      .begin(() => {
        const initialProgress = (completedPages / totalPages) * 100;
        NotificationService.showDownloadProgress(downloadId, mangaTitle, chapterTitle, initialProgress, totalPages, index + 1);
      })
      .progress(({ bytesDownloaded, bytesTotal }) => {
        const pageProgress = bytesDownloaded / bytesTotal;
        const overallProgress = ((completedPages + pageProgress) / totalPages) * 100;
        store.updateDownloadProgress(downloadId, overallProgress, 'downloading');
        NotificationService.showDownloadProgress(downloadId, mangaTitle, chapterTitle, overallProgress, totalPages, index + 1);
      })
      .done(() => {
        RNBackgroundDownloader.completeHandler(taskId);
        resolve();
      })
      .error(({ error }) => {
        store.updateDownloadProgress(downloadId, 0, 'error');
        NotificationService.showDownloadError(downloadId, mangaTitle, chapterTitle);
        reject(error);
      });
  });
};
