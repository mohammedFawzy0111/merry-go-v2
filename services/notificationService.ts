import { useDownloadStore } from '@/store/downloadStore';
import notifee from '@notifee/react-native';
import * as FileSystem from 'expo-file-system';

export class NotificationService {
    static channelId = 'manga_downloads_channel';

    static async initialize() {
        await notifee.createChannel({
            id: this.channelId,
            name: 'Chapter Downloads',
            description: 'chapter download notification',
            vibration: false,
        });
        notifee.onForegroundEvent(async ({type, detail}) => {
            if (detail.pressAction?.id === 'cancel-download') {
                const downloadId = detail.notification?.id;
                if (downloadId) {
                    // Get the download info before removing it
                    const { downloads, removeDownload, stopDownloads } = useDownloadStore.getState();
                    const download = downloads.find(d => d.id === downloadId);
                    
                    if (download) {
                        // Delete the incomplete chapter directory
                        try {
                            if (download.localPath) {
                                await FileSystem.deleteAsync(download.localPath, { idempotent: true });
                                console.log('Deleted incomplete chapter directory:', download.localPath);
                            }
                        } catch (error) {
                            console.error('Failed to delete incomplete directory:', error);
                        }
                        
                        // Remove the download from the store and database
                        await removeDownload(downloadId);
                        
                        // Cancel the notification
                        await this.cancelNotification(downloadId);
                        
                        // Stop any active downloads and restart to process next in queue
                        await stopDownloads();
                        
                        // Restart downloads to process next in queue
                        const { startDownloads } = useDownloadStore.getState();
                        await startDownloads();
                    }
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
        currentPage: number,
    ) {
        await notifee.displayNotification({
            id: downloadId,
            title: `Downloading: ${mangaTitle}`,
            body: `${chapterTitle} - Page ${currentPage}/${totalPages}`,
            android: {
                channelId: this.channelId,
                progress: {
                    max: 100,
                    current: Math.round(progress)
                },
                ongoing: true,
                autoCancel: false,
                actions: [
                    {
                        title: 'Cancel',
                        pressAction: {
                            id: 'cancel-download'
                        }
                    }
                ]
            }
        })
    }

    static async showDownloadComplete(
        downloadId: string,
        mangaTitle: string,
        chapterTitle: string
    ){
        await notifee.displayNotification({
            id: downloadId,
            title: 'Download Complete',
            body: `${mangaTitle} - ${chapterTitle}`,
            android: {
                channelId: this.channelId,
                pressAction: {
                    id: 'defautl'
                },
                autoCancel: true,
            }
        })
    }

    static async showDownloadError(
        downloadId: string,
        mangaTitle: string,
        chapterTitle: string,
        errorMessage?: string
    ){
        await notifee.displayNotification({
            id: downloadId,
            title: 'Download Failed',
            body: errorMessage || `${mangaTitle} - ${chapterTitle}`,
            android: {
                channelId: this.channelId,
                pressAction: {
                    id: 'default'
                },
                autoCancel: true
            }
        })
    }

    static async cancelNotification(downloadId:string){
        await notifee.cancelNotification(downloadId);
    }

    static async cancelAllNotifications(){
        await notifee.cancelAllNotifications();
    }
}