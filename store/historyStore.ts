/**
 * historyStore.ts
 *
 * Zustand store for reading history.
 * Wraps the db layer so components never call db functions directly.
 */

import { addToHistory, deleteHistory, getHistory, History, updateHistory } from "@/db/db";
import { create } from "zustand";

interface HistoryStore {
  history: History[];
  loadHistory: () => Promise<void>;
  addToHistory: (item: History) => Promise<void>;
  removeHistory: (mangaUrl: string) => Promise<void>;
  updateHistory: (
    mangaUrl: string,
    chapterUrl: string,
    chapterNumber: number,
    lastRead: string,
    page: number
  ) => Promise<void>;
}

export const useHistoryStore = create<HistoryStore>()((set, get) => ({
  history: [],

  loadHistory: async () => {
    const loaded = await getHistory();
    set({ history: loaded });
  },

  addToHistory: async (item: History) => {
    await addToHistory(item);
    set((state) => {
      const filtered = state.history.filter((h) => h.mangaUrl !== item.mangaUrl);
      return { history: [item, ...filtered] };
    });
  },

  removeHistory: async (mangaUrl: string) => {
    await deleteHistory(mangaUrl);
    set((state) => ({
      history: state.history.filter((h) => h.mangaUrl !== mangaUrl),
    }));
  },

  updateHistory: async (
    mangaUrl: string,
    chapterUrl: string,
    chapterNumber: number,
    lastRead: string,
    page: number
  ) => {
    // argument order matches db.ts: (mangaUrl, chapterUrl, chapterNumber, page, lastRead)
    await updateHistory(mangaUrl, chapterUrl, chapterNumber, page, lastRead);
    // Optimistic update in memory — avoids a full DB round-trip
    set((state) => ({
      history: state.history.map((h) =>
        h.mangaUrl === mangaUrl
          ? { ...h, chapterUrl, chapterNumber, lastRead, page }
          : h
      ),
    }));
  },
}));
