import { create } from 'zustand';
import { addChapters, addManga, deleteManga, getChapters, getMangas, initDb } from '@/db/db';
import {Chapter, Manga} from '@/utils/sourceModel';

interface MangaStore {
  mangas: Manga[];
  loading: boolean;
  loadMangas: ()=> Promise<void>;
  addManga: (manga: Manga) => Promise<void>;
  removeManga: (mangaUrl: string) => Promise<void>;
  chapters: Record<string, Chapter[]>;
  loadChapters: (mangaUrl: string) => Promise<void>;
  addChapters: (chapters: Chapter[]) => Promise<void>;
}

export const useMangaStore = create<MangaStore>(
  (set, get) => ({
    mangas: [],
    chapters: {},
    loading: false,

    loadMangas: async () => {
      set({loading: true});
      initDb();
      const all = getMangas();
      set({ mangas: all, loading: false });
    },

    addManga: async (manga) => {
      addManga(manga);
      await get().loadMangas();
    },

    removeManga: async (manaUrl) => {
      deleteManga(manaUrl);
      await get().loadMangas();
    },

    loadChapters: async (mangaUrl) => {
      const chapters = getChapters(mangaUrl);
      set((state) => ({
        chapters:{...state.chapters, [mangaUrl]: chapters}
      }));
    },

    addChapters: async (chapters) => {
      addChapters(chapters);
      await get().loadChapters(chapters[0].manga);
    }

  })
)
