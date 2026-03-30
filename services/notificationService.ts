
import notifee, { AndroidImportance, Event } from '@notifee/react-native';

// Define a type for the cancel logic to avoid importing the store
type CancelCallback = (downloadId: string) => Promise<void>;

export class NotificationService {
  static channelId = 'manga_downloads_channel';
  private static readonly PROGRESS_UPDATE_THRESHOLD = 5;
  private static lastNotifiedProgress: Map<string, number> = new Map();
  
  // Placeholder for the logic provided by the Store
  private static onCancelRequested?: CancelCallback;

  static async initialize(onCancel: CancelCallback) {
    this.onCancelRequested = onCancel;

    await notifee.createChannel({
      id: this.channelId,
      name: 'Chapter Downloads',
      description: 'Chapter download notifications',
      importance: AndroidImportance.LOW,
      vibration: false,
    });

    notifee.onForegroundEvent(async ({ type, detail }: Event) => {
      if (detail.pressAction?.id === 'cancel-download') {
        const downloadId = detail.notification?.id;
        if (downloadId && this.onCancelRequested) {
          // Call the injected logic
          await this.onCancelRequested(downloadId);
        }
      }
    });
  }

  static async showDownloadProgress(
    downloadId: string,
    mangaTitle: string,
    chapterTitle: string,
    progress: number,
    totalPages: number,
    currentPage: number
  ) {
    const last = this.lastNotifiedProgress.get(downloadId) ?? -1;
    const roundedProgress = Math.round(progress);

    const isFirst = currentPage === 1;
    const isLast = currentPage === totalPages;
    const jumpedEnough = roundedProgress - last >= this.PROGRESS_UPDATE_THRESHOLD;

    if (!isFirst && !isLast && !jumpedEnough) return;

    this.lastNotifiedProgress.set(downloadId, roundedProgress);

    await notifee.displayNotification({
      id: downloadId,
      title: `⬇ ${mangaTitle}`,
      body: `${chapterTitle} — ${currentPage}/${totalPages} pages`,
      android: {
        channelId: this.channelId,
        progress: { max: 100, current: roundedProgress },
        ongoing: true,
        autoCancel: false,
        smallIcon: 'ic_notification', 
        actions: [
          {
            title: 'Cancel',
            pressAction: { id: 'cancel-download' },
          },
        ],
      },
    });
  }

  static async showDownloadComplete(downloadId: string, mangaTitle: string, chapterTitle: string) {
    this.lastNotifiedProgress.delete(downloadId);
    await notifee.displayNotification({
      id: downloadId,
      title: '✓ Download Complete',
      body: `${mangaTitle} — ${chapterTitle}`,
      android: {
        channelId: this.channelId,
        pressAction: { id: 'default' },
        autoCancel: true,
      },
    });
  }

  static async showDownloadError(downloadId: string, mangaTitle: string, chapterTitle: string, errorMessage?: string) {
    this.lastNotifiedProgress.delete(downloadId);
    await notifee.displayNotification({
      id: downloadId,
      title: '✕ Download Failed',
      body: errorMessage ?? `${mangaTitle} — ${chapterTitle}`,
      android: {
        channelId: this.channelId,
        pressAction: { id: 'default' },
        autoCancel: true,
      },
    });
  }

  static async cancelNotification(downloadId: string) {
    this.lastNotifiedProgress.delete(downloadId);
    await notifee.cancelNotification(downloadId);
  }

  static async cancelAllNotifications() {
    this.lastNotifiedProgress.clear();
    await notifee.cancelAllNotifications();
  }
}
