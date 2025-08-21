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
) => {
  const { updateDownloadProgress } = useDownloadStore.getState();

  return new Promise<void>((resolve, reject) => {
    let completedPages = 0;

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
        completedPages++;
        const progress = (completedPages / totalPages) * 100;
        updateDownloadProgress(downloadId, progress, 'downloading');

        if (completedPages === totalPages) {
          updateDownloadProgress(downloadId, 100, 'done');
          //show completion notification
          NotificationService.showDownloadComplete(
            downloadId,
            mangaTitle,
            chapterTitle
          );
        }

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


// process single download
const processDownload = async (download: Download) => {
    const { updateDownloadProgress } = useDownloadStore.getState();
    try {
        //set status to downloading
        await updateDownloadProgress(download.id, 0, 'downloading');
        const source = sources.find(s => download.chapterUrl.includes(s.source.baseUrl));
        if(!source) throw new Error(`Source not found for URL: ${download.chapterUrl}`);

        const chapterData = await source.source.fetchChapterDetails(download.chapterUrl);
        if(!chapterData.pages.length) throw new Error('no pages found for the chapter');

        // create the folder for the chapter
        const chapterDir = `${FileSystem.documentDirectory}downloads/${download.id}/`;
        await FileSystem.makeDirectoryAsync(chapterDir, {intermediates: true});

        const totalPages = chapterData.pages.length;

        for(const [index, pageUrl] of chapterData.pages.entries()){
            const fileName = `page_${index+1}.jpg`;
            const filePath = `${chapterDir}${fileName}`
            const taskId = `${download.id}-page-${index}`;

            try {
                await downloadPage(taskId, pageUrl, filePath, download.id, index, totalPages, download.mangaTitle, download.chapterTitle);
            } catch (err) {
                console.error(`Stopping chapter ${download.id} at page ${index + 1}`, err);
                break;
            }
        }
    } catch (error) {
        console.error('Error processing download:', error);
        await updateDownloadProgress(download.id, 0, 'error');
    }
}

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