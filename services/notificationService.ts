import notifee from '@notifee/react-native';

export class NotificationService {
    static channelId = 'manga_downloads_channel';

    static async initialize() {
        await notifee.createChannel({
            id: this.channelId,
            name: 'Chapter Downloads',
            description: 'chapter download notification',
            vibration: false,
            sound: 'default',
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
                autoCancel: false
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