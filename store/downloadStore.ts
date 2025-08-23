import { deletDownload, Download, getAllDownloads, getDownloadsByChapter, insertDownload, updateDownloadStatus } from '@/db/db';
import { getLocatPath, startDownloadService, stopDownloadService } from '@/services/DownloadManager';
import { create } from 'zustand';

interface DownloadStor {
    downloads: Download[];
    activeDownloads: Download[];
    pendingDownloads: Download[];
    completedDownloads: Download[];
    errorDownloads: Download[];
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
    retryDownload: (id: string) => Promise<void>;
}

export const useDownloadStore = create<DownloadStor>((set,get) => ({
    downloads: [],
    activeDownloads: [],
    pendingDownloads: [],
    completedDownloads: [],
    errorDownloads: [],
    loading: false,
    isDownloading: false,


    loadDownloads: async() => {
        try {
            set({loading: true});
            const allDownloads = await getAllDownloads();
            set({
                downloads: allDownloads,
                pendingDownloads: allDownloads.filter(d => d.status === 'pending'),
                activeDownloads: allDownloads.filter(d => d.status === 'downloading'),
                completedDownloads: allDownloads.filter(d => d.status === 'done'),
                errorDownloads: allDownloads.filter(d => d.status === 'error'),
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
                mangaTitle,
                chapterTitle,
                status: 'pending',
                progress: 0,
                localPath: getLocatPath(mangaTitle,chapterTitle),
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
                    pendingDownloads: filteredDownloads.filter(d => d.status === 'pending'),
                    completedDownloads: filteredDownloads.filter(d => d.status === 'done'),
                    errorDownloads: filteredDownloads.filter(d => d.status === 'error')
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
                    pendingDownloads: remainingDownloads.filter(d => d.status === 'pending'),
                    completedDownloads: [],
                    errorDownloads: []
                };
            })
        } catch (err) {
            console.error('Failed to clear completed downloads:', err);
        }
    },

    retryDownload: async(id:string) => {
        try {
            const { downloads } = get();
            const download = downloads.find(d => d.id === id);

            if(!download) return;

            await updateDownloadStatus(id, 'pending', 0);
            
            set(state => {
                const updatedDownloads = state.downloads.map(d => 
                    d.id === id ? { ...d, status: 'pending' as const, progress: 0 } : d
                );
                
                // Find the updated download to add to pending
                const retriedDownload = updatedDownloads.find(d => d.id === id);
                
                return {
                    downloads: updatedDownloads,
                    pendingDownloads: retriedDownload 
                        ? [...state.pendingDownloads, retriedDownload] 
                        : state.pendingDownloads,
                    errorDownloads: state.errorDownloads.filter(d => d.id !== id),
                    completedDownloads: state.completedDownloads.filter(d => d.id !== id)
                };
            });
            
            if(!get().isDownloading){
                get().startDownloads();
            }
        } catch (err) {
            console.error('Failed to retry download:', err);
        }
    }
}));