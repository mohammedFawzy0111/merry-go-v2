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
  removeHistroy: (mangaUrl: string) => Promise<void>;
  updateHistroy: (
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
    // Replace existing entry for the same manga if present, otherwise append
    set((state) => {
      const filtered = state.history.filter((h) => h.mangaUrl !== item.mangaUrl);
      return { history: [item, ...filtered] };
    });
  },

  removeHistroy: async (mangaUrl: string) => {
    await deleteHistory(mangaUrl);
    set((state) => ({
      history: state.history.filter((h) => h.mangaUrl !== mangaUrl),
    }));
  },

  updateHistroy: async (
    mangaUrl: string,
    chapterUrl: string,
    chapterNumber: number,
    lastRead: string,
    page: number
  ) => {
    await updateHistory(mangaUrl, chapterUrl, chapterNumber, page, lastRead);
    await get().loadHistory();
  },
}));
