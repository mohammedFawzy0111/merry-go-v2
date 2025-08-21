/* eslint-disable import/no-named-as-default-member */
import { Download } from '@/db/db';
import { NotificationService } from '@/services/notificationService';
import { sources } from '@/sources';
import { useDownloadStore } from '@/store/downloadStore';
import RNBackgroundDownloader from '@kesha-antonov/react-native-background-downloader';
import * as FileSystem from 'expo-file-system';

// start the download service (process pending downloads)
export const startDownloadService = async() => {
    const {loadDownloads, pendingDownloads} = useDownloadStore.getState();
    await loadDownloads();

    if(pendingDownloads.length === 0){
        console.log('nopending downloads');
        return;
    }

    for(const download of pendingDownloads ){
        await processDownload(download);
    }
}

const processDownload = async (download: Download) => {
  const { updateDownloadProgress } = useDownloadStore.getState();
  try {
    await updateDownloadProgress(download.id, 0, 'downloading');
    const source = sources.find(s => download.chapterUrl.includes(s.source.baseUrl));
    if (!source) throw new Error(`Source not found for URL: ${download.chapterUrl}`);

    const chapterData = await source.source.fetchChapterDetails(download.chapterUrl);
    if (!chapterData.pages.length) throw new Error('No pages found for the chapter');

    // Create organized folder structure: downloads/MangaTitle/ChapterTitle/
    const safeMangaTitle = download.mangaTitle.replace(/[^a-zA-Z0-9]/g, '_');
    const safeChapterTitle = download.chapterTitle.replace(/[^a-zA-Z0-9]/g, '_');
    
    const chapterDir = `${FileSystem.documentDirectory}downloads/${safeMangaTitle}/${safeChapterTitle}/`;
    await FileSystem.makeDirectoryAsync(chapterDir, { intermediates: true });

    // Update download with the new local path
    const updatedDownload = { ...download, localPath: chapterDir };

    const totalPages = chapterData.pages.length;
    let completedPages = 0;

    for (const [index, pageUrl] of chapterData.pages.entries()) {
      const fileName = `page_${index + 1}.jpg`;
      const filePath = `${chapterDir}${fileName}`;
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
    // mark as done when all pages are downloaded
    if(completedPages === totalPages){
      await updateDownloadProgress(download.id, 100, 'done');
      NotificationService.showDownloadComplete(
        download.id,
        download.mangaTitle,
        download.chapterTitle
      );
    }
  } catch (error) {
    console.error('Error processing download:', error);
    await updateDownloadProgress(download.id, 0, 'error');
  }
};

// Helper: wrap a DownloadTask into a Promise so we can await it
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
) => {
  const { updateDownloadProgress } = useDownloadStore.getState();

  return new Promise<void>((resolve, reject) => {
    const task = RNBackgroundDownloader.download({
      id: taskId,
      url,
      destination,
    });

    task
      .begin(({ expectedBytes }) => {
        // show initial progress notification
        NotificationService.showDownloadProgress(
          downloadId,
          mangaTitle,
          chapterTitle,
          0,
          totalPages,
          index + 1
        );
      })
      .progress(({ bytesDownloaded, bytesTotal }) => {
        const pageProgress = bytesDownloaded / bytesTotal;
        // calcutlate overall progress
        const overallProgress =
          (completedPages + pageProgress) / totalPages;
          const progressPercent = overallProgress * 100;

        updateDownloadProgress(downloadId, progressPercent, 'downloading');

        // update notification with progress
        NotificationService.showDownloadProgress(
          downloadId,
          mangaTitle,
          chapterTitle,
          progressPercent,
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
        // show error notification
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

// stop all active downloads
export const stopDownloadService = async () => {
  try {
    const tasks = await RNBackgroundDownloader.checkForExistingDownloads();
    for (const task of tasks) {
      task.stop();
    }
  } catch (error) {
    console.error('Error stopping downloads:', error);
  }
};

// Resume any interrupted downloads
export const resumeDownloads = async () => {
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

//Helpers
export const getDownloadStatus = async (chapterUrl: string) => {
  const download = await useDownloadStore.getState().getDownloadByChapter(chapterUrl);
  return download ? download.status : null;
};

export const getDownloadProgress = async (chapterUrl: string) => {
  const download = await useDownloadStore.getState().getDownloadByChapter(chapterUrl);
  return download ? download.progress : 0;
};