import { create } from "zustand";
import { addToHistroy, deleteHistroy, getHIstroy, History, updateMangaHistory } from "@/db/db";

interface HistoryStore {
  history: History[];

  loadHistory: () => Promise<void>;
  addToHistory: (item:History) => Promise<void>;
  removeHistroy: (mangaUrl: string) => Promise<void>;
  updateHistroy: (mangaUrl:string, chapterUrl:string, chapterNumber: number, lastRead:string, page:number) => Promise<void>;
}

export const useHistoryStore = create<HistoryStore>()((set, get) => ({
  history: [],
  
  loadHistory: async() => {
    const loaded = await getHIstroy();
    set({history: loaded});
  },

  addToHistory: async(item:History) => {
    await addToHistroy(item);
    set((state) => ({
      history: [...state.history, item]
    }));
  }, 

  removeHistroy: async(mangaUrl:string) => {
    await deleteHistroy(mangaUrl);
    set((state)=> ({
      history: state.history.filter(h => h.mangaUrl !== mangaUrl)
    }));
  },

  updateHistroy: async(mangaUrl:string,chapterUrl:string, chapterNumber:number, lastRead:string, page: number) => {
    await updateMangaHistory(mangaUrl, chapterUrl, chapterNumber, page, lastRead);
    await get().loadHistory();
  }
}));
