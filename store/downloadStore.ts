import { deletDownload, Download, getDownloadsByChapter, getPendingDownloads, insertDownload, updateDownloadStatus } from '@/db/db';
import { startDownloadService, stopDownloadService } from '@/utils/DownloadManager';
import { create } from 'zustand';

interface DownloadStor {
    downloads: Download[];
    activeDownloads: Download[];
    pendingDownloads: Download[];
    loading: boolean;
    isDownloading: boolean;

    loadDownloads: ()=> Promise<void>;
    addToDownloadQueue: (mangaUrl: string, chapterUrl: string, chapterTitle: string, mangaTitle: string) => Promise<void>;
    startDownloads : () => Promise<void>;
    stopDownloads : () => Promise<void>;
    updateDownloadProgress: (id: string, progress: number, status: Download['status']) => Promise<void>;
    removeDownload: (id: string) => Promise<void>;
    getDownloadByChapter: (chapterUrl: string) => Promise<Download | null>;
    clearCompletedDownloads: () => Promise<void>;
}

export const useDownloadStore = create<DownloadStor>((set,get) => ({
    downloads: [],
    activeDownloads: [],
    pendingDownloads: [],
    loading: false,
    isDownloading: false,


    loadDownloads: async() => {
        try {
            set({loading: true});
            const pending = await getPendingDownloads();
            set({
                downloads: pending,
                pendingDownloads: pending.filter(d => d.status === 'pending'),
                activeDownloads: pending.filter(d => d.status === 'downloading'),
                loading: false
            });
        } catch (err) {
            console.error('Failed to load downloads:', err);
            set({loading: false})
        }
    },

    addToDownloadQueue: async(mangaUrl: string, chapterUrl: string, chapterTitle: string, mangaTitle: string) => {
        try{
            const id = `${mangaUrl}-${chapterUrl}`;
            const existingDownload = await get().getDownloadByChapter(chapterUrl);

            if(existingDownload){
                console.log('Chapter already in download queue');
                return;
            }

            //get next queue index
            const { downloads } = get();
            const nextQueueIndex = downloads.length > 0 ? 
                Math.max(...downloads.map(d=> d.queueIndex)) + 1
                : 0;
            const newDownload: Download = {
                id,
                mangaUrl,
                chapterUrl,
                status: 'pending',
                progress: 0,
                localPath: '',
                queueIndex: nextQueueIndex
            };

            await insertDownload(newDownload);

            set(state => ({
                downloads: [...state.downloads, newDownload],
                pendingDownloads: [...state.pendingDownloads, newDownload]
            }));

            // auto start downloads if not already runnign
            if(!get().isDownloading){
                get().startDownloads();
            }
        }catch(err){
            console.error('Failed to add to download queue:', err);
        }
    },

    startDownloads: async () => {
        try {
            set({isDownloading: true});
            await startDownloadService();
        } catch (err) {
            console.error('Failed to start downloads:', err);
            set({isDownloading: false});
        }
    },

    stopDownloads: async () => {
        try {
            await stopDownloadService();
            set({isDownloading: false});
        } catch (err) {
            console.error('Failed to stop downloads:', err);
        }
    },

    updateDownloadProgress: async(id: string, progress: number, status: Download['status']) => {
        try {
            await updateDownloadStatus(id, status, progress);
            set(state => {
                const updateDownloads = state.downloads.map(d => 
                    d.id === id ? {...d, progress, status}: d
                );
                return {
                    downloads: updateDownloads,
                    activeDownloads: updateDownloads.filter(d => d.status === 'downloading'),
                    pendingDownloads: updateDownloads.filter(d => d.status === 'pending'),
                };
            });
        } catch (err) {
            console.error('Failed to update download progress:', err);
        }
    },

    removeDownload: async (id:string) => {
        try {
            await deletDownload(id);
            set(state => {
                const filteredDownloads = state.downloads.filter(d => d.id !== id);
                return {
                    downloads: filteredDownloads,
                    activeDownloads: filteredDownloads.filter(d => d.status === 'downloading'),
                    pendingDownloads: filteredDownloads.filter(d => d.status === 'pending')
                };
            });
        } catch (err) {
            console.error('Failed to remove download:', err);
        }
    },

    getDownloadByChapter: async (chapterUrl: string) => {
        try {
            const downloads = await getDownloadsByChapter(chapterUrl);
            return downloads.length > 0 ? downloads[0] : null;
        } catch (err) {
            console.error('Failed to get download by chapter:', err);
            return null;
        }
    },

    clearCompletedDownloads: async() => {
        try {
            const {downloads} = get();
            const completedDownloads = downloads.filter(d => d.status === 'done' || d.status === 'error');

            for(const download of completedDownloads){
                await deletDownload(download.id);
            }

            set(state => {
                const remainingDownloads = state.downloads.filter(d => d.status !== 'done' && d.status !== 'error');
                return {
                    downloads: remainingDownloads,
                    activeDownloads: remainingDownloads.filter(d => d.status === 'downloading'),
                    pendingDownloads: remainingDownloads.filter(d => d.status === 'pending')
                };
            })
        } catch (err) {
            console.error('Failed to clear completed downloads:', err);
        }
    }
}));