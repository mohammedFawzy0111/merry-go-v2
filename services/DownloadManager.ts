/**
 * @file services/DownloadManager.ts
 * @description Background download service for manga chapters.
 *
 * Processes the pending download queue sequentially:
 *   1. Fetch chapter page URLs via the matching source plugin.
 *   2. Download each page image using react-native-background-downloader.
 *   3. Update progress in the store and show a persistent notification.
 *   4. Mark the chapter done (or error) when finished.
 */

/* eslint-disable import/no-named-as-default-member */
import { Download } from '@/db/db';
import { NotificationService } from '@/services/notificationService';
import { sourceManager } from '@/sources';
import { useDownloadStore } from '@/store/downloadStore';
import RNBackgroundDownloader from '@kesha-antonov/react-native-background-downloader';
import * as FileSystem from 'expo-file-system';

// ─── Public helpers ───────────────────────────────────────────────────────────

/**
 * Processes all pending downloads in the queue, one chapter at a time.
 * Called automatically when a download is added to the queue.
 */
export const startDownloadService = async (): Promise<void> => {
  const { loadDownloads, downloads } = useDownloadStore.getState();
  await loadDownloads();

  const pending = useDownloadStore
    .getState()
    .downloads.filter((d) => d.status === 'pending');

  if (pending.length === 0) return;

  for (const download of pending) {
    await processDownload(download);
  }
};

/**
 * Stops all active background download tasks.
 */
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

/**
 * Re-attaches progress/done/error handlers to any downloads that were
 * interrupted by the app being killed (e.g. OS restart mid-download).
 */
export const resumeDownloads = async (): Promise<void> => {
  try {
    const tasks = await RNBackgroundDownloader.checkForExistingDownloads();
    for (const task of tasks) {
      const downloadId = task.id.split('-page-')[0];
      task
        .progress(({ bytesDownloaded, bytesTotal }) => {
          const percent = (bytesDownloaded / bytesTotal) * 100;
          useDownloadStore
            .getState()
            .updateDownloadProgress(downloadId, percent, 'downloading');
        })
        .done(() => {
          useDownloadStore
            .getState()
            .updateDownloadProgress(downloadId, 100, 'done');
        })
        .error(({ error }) => {
          console.error('Resumed task failed:', error);
          useDownloadStore
            .getState()
            .updateDownloadProgress(downloadId, 0, 'error');
        });
    }
  } catch (error) {
    console.error('Error resuming downloads:', error);
  }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns the absolute local directory path for a chapter's downloaded pages.
 * Path: `<documentDirectory>/downloads/<safeMangaTitle>/<safeChapterTitle>/`
 */
export const getLocalPath = (mangaTitle: string, chapterTitle: string): string => {
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '_');
  return `${FileSystem.documentDirectory}downloads/${safe(mangaTitle)}/${safe(chapterTitle)}/`;
};

/** Returns the current download status for a chapter URL, or null if not queued. */
export const getDownloadStatus = async (chapterUrl: string) => {
  const download = await useDownloadStore.getState().getDownloadByChapter(chapterUrl);
  return download?.status ?? null;
};

/** Returns the current download progress (0–100) for a chapter URL, or 0. */
export const getDownloadProgress = async (chapterUrl: string): Promise<number> => {
  const download = await useDownloadStore.getState().getDownloadByChapter(chapterUrl);
  return download?.progress ?? 0;
};

// ─── Internal ────────────────────────────────────────────────────────────────

const processDownload = async (download: Download): Promise<void> => {
  const { updateDownloadProgress } = useDownloadStore.getState();
  try {
    await updateDownloadProgress(download.id, 0, 'downloading');

    // Find the source that owns this chapter URL
    const sourceInfo = sourceManager
      .getAllSources()
      .find((s) => download.chapterUrl.includes(s.source.baseUrl));

    if (!sourceInfo) {
      throw new Error(`Source not found for URL: ${download.chapterUrl}`);
    }

    const chapterData = await sourceInfo.source.fetchChapterDetails(download.chapterUrl);
    if (!chapterData.pages.length) {
      throw new Error('No pages found for the chapter');
    }

    const chapterDir = getLocalPath(download.mangaTitle, download.chapterTitle);
    await FileSystem.makeDirectoryAsync(chapterDir, { intermediates: true });

    const totalPages = chapterData.pages.length;
    let completedPages = 0;

    for (const [index, pageUrl] of chapterData.pages.entries()) {
      const filePath = `${chapterDir}page_${index + 1}.jpg`;
      const taskId = `${download.id}-page-${index}`;

      try {
        await downloadPage(
          taskId,
          pageUrl,
          filePath,
          download.id,
          index,
          totalPages,
          download.mangaTitle,
          download.chapterTitle,
          completedPages
        );
        completedPages++;
      } catch (err) {
        console.error(`Stopping chapter ${download.id} at page ${index + 1}`, err);
        break;
      }
    }

    if (completedPages === totalPages) {
      await updateDownloadProgress(download.id, 100, 'done');
      NotificationService.showDownloadComplete(
        download.id,
        download.mangaTitle,
        download.chapterTitle
      );
    } else {
      await updateDownloadProgress(download.id, 0, 'error');
    }
  } catch (error) {
    console.error('Error processing download:', error);
    await updateDownloadProgress(download.id, 0, 'error');
  }
};

const downloadPage = (
  taskId: string,
  url: string,
  destination: string,
  downloadId: string,
  index: number,
  totalPages: number,
  mangaTitle: string,
  chapterTitle: string,
  completedPages: number
): Promise<void> => {
  const { updateDownloadProgress } = useDownloadStore.getState();

  return new Promise<void>((resolve, reject) => {
    const task = RNBackgroundDownloader.download({ id: taskId, url, destination });

    task
      .begin(() => {
        const initialProgress = (completedPages / totalPages) * 100;
        NotificationService.showDownloadProgress(
          downloadId,
          mangaTitle,
          chapterTitle,
          initialProgress,
          totalPages,
          index + 1
        );
      })
      .progress(({ bytesDownloaded, bytesTotal }) => {
        const pageProgress = bytesDownloaded / bytesTotal;
        const overallProgress = ((completedPages + pageProgress) / totalPages) * 100;
        updateDownloadProgress(downloadId, overallProgress, 'downloading');
        NotificationService.showDownloadProgress(
          downloadId,
          mangaTitle,
          chapterTitle,
          overallProgress,
          totalPages,
          index + 1
        );
      })
      .done(() => {
        RNBackgroundDownloader.completeHandler(taskId);
        resolve();
      })
      .error(({ error, errorCode }) => {
        updateDownloadProgress(downloadId, 0, 'error');
        NotificationService.showDownloadError(
          downloadId,
          mangaTitle,
          chapterTitle,
          `Error code: ${errorCode}`
        );
        reject(error);
      });
  });
};
