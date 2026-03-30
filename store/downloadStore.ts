
import {
  deleteDownload,
  Download,
  getAllDownloads,
  getDownloadsByChapter,
  insertDownload,
  updateDownloadStatus,
} from "@/db/db";
import {
  getLocalPath,
  startDownloadService,
  stopDownloadService,
  injectStore, // New Import
} from "@/services/DownloadManager";
import { NotificationService } from "@/services/notificationService"; // New Import
import * as FileSystem from 'expo-file-system';
import { create } from "zustand";

interface DownloadStore {
  downloads: Download[];
  downloadsByChapter: Map<string, Download>;
  loading: boolean;
  isDownloading: boolean;
  loadDownloads: () => Promise<void>;
  addToDownloadQueue: (mangaUrl: string, chapterUrl: string, chapterTitle: string, mangaTitle: string) => Promise<void>;
  startDownloads: () => Promise<void>;
  stopDownloads: () => Promise<void>;
  updateDownloadProgress: (id: string, progress: number, status: Download["status"]) => Promise<void>;
  removeDownload: (id: string) => Promise<void>;
  getDownloadByChapter: (chapterUrl: string) => Promise<Download | null>;
  clearCompletedDownloads: () => Promise<void>;
  retryDownload: (id: string) => Promise<void>;
}

function buildMap(downloads: Download[]): Map<string, Download> {
  const map = new Map<string, Download>();
  for (const d of downloads) map.set(d.chapterUrl, d);
  return map;
}

export const useDownloadStore = create<DownloadStore>((set, get) => ({
  downloads: [],
  downloadsByChapter: new Map(),
  loading: false,
  isDownloading: false,

  loadDownloads: async () => {
    // 1. Inject this store instance into the manager
    injectStore(get());

    // 2. Initialize Notification Service with the cancel logic
    NotificationService.initialize(async (downloadId) => {
      const { downloads, removeDownload, stopDownloads, startDownloads } = get();
      const download = downloads.find((d) => d.id === downloadId);
      if (download) {
        if (download.localPath) {
          await FileSystem.deleteAsync(download.localPath, { idempotent: true });
        }
        await removeDownload(downloadId);
        await NotificationService.cancelNotification(downloadId);
        await stopDownloads();
        await startDownloads();
      }
    });

    try {
      set({ loading: true });
      const all = await getAllDownloads();
      set({ downloads: all, downloadsByChapter: buildMap(all), loading: false });
    } catch (err) {
      console.error("Failed to load downloads:", err);
      set({ loading: false });
    }
  },

  addToDownloadQueue: async (mangaUrl, chapterUrl, chapterTitle, mangaTitle) => {
    try {
      const existing = await get().getDownloadByChapter(chapterUrl);
      if (existing) return;

      const { downloads } = get();
      const nextIndex = downloads.length > 0 ? Math.max(...downloads.map((d) => d.queueIndex)) + 1 : 0;

      const newDownload: Download = {
        id: `${mangaUrl}-${chapterUrl}`,
        mangaUrl,
        chapterUrl,
        mangaTitle,
        chapterTitle,
        status: "pending",
        progress: 0,
        localPath: getLocalPath(mangaTitle, chapterTitle),
        queueIndex: nextIndex,
      };

      set((state) => {
        const updated = [...state.downloads, newDownload];
        return { downloads: updated, downloadsByChapter: buildMap(updated) };
      });

      await insertDownload(newDownload);
      if (!get().isDownloading) get().startDownloads();
    } catch (err) {
      console.error("Failed to add to download queue:", err);
    }
  },

  startDownloads: async () => {
    try {
      set({ isDownloading: true });
      await startDownloadService();
    } catch (err) {
      console.error("Failed to start downloads:", err);
    } finally {
      set({ isDownloading: false });
    }
  },

  stopDownloads: async () => {
    try {
      await stopDownloadService();
      set({ isDownloading: false });
    } catch (err) {
      console.error("Failed to stop downloads:", err);
    }
  },

  updateDownloadProgress: async (id, progress, status) => {
    try {
      await updateDownloadStatus(id, status, progress);
      set((state) => {
        const updated = state.downloads.map((d) => d.id === id ? { ...d, progress, status } : d);
        return { downloads: updated, downloadsByChapter: buildMap(updated) };
      });
    } catch (err) {
      console.error("Failed to update progress:", err);
    }
  },

  removeDownload: async (id) => {
    try {
      await deleteDownload(id);
      set((state) => {
        const updated = state.downloads.filter((d) => d.id !== id);
        return { downloads: updated, downloadsByChapter: buildMap(updated) };
      });
    } catch (err) {
      console.error("Failed to remove download:", err);
    }
  },

  getDownloadByChapter: async (chapterUrl) => {
    const cached = get().downloadsByChapter.get(chapterUrl);
    if (cached) return cached;
    try {
      const results = await getDownloadsByChapter(chapterUrl);
      return results.length > 0 ? results[0] : null;
    } catch { return null; }
  },

  clearCompletedDownloads: async () => {
    try {
      const toRemove = get().downloads.filter((d) => d.status === "done" || d.status === "error");
      for (const d of toRemove) await deleteDownload(d.id);
      set((state) => {
        const updated = state.downloads.filter((d) => d.status !== "done" && d.status !== "error");
        return { downloads: updated, downloadsByChapter: buildMap(updated) };
      });
    } catch (err) {
      console.error("Failed to clear completed downloads:", err);
    }
  },

  retryDownload: async (id) => {
    try {
      await updateDownloadStatus(id, "pending", 0);
      set((state) => {
        const updated = state.downloads.map((d) => d.id === id ? { ...d, status: "pending", progress: 0 } : d);
        return { downloads: updated, downloadsByChapter: buildMap(updated) };
      });
      if (!get().isDownloading) get().startDownloads();
    } catch (err) {
      console.error("Failed to retry download:", err);
    }
  },
}));
