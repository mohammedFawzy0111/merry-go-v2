import { addChapters, addManga, deleteManga, getChapters, getMangas } from '@/db/db';
import { Chapter, Manga } from '@/utils/sourceModel';
import { create } from 'zustand';

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
      try {
        set({loading: true});
        const all = await getMangas();
        set({ mangas: all, loading: false });
      } catch (error) {
        console.error('Failed to load mangas:', error);
        set({loading: false});
      }
    },

    addManga: async (manga) => {
      addManga(manga);
      set((state) => ({
        mangas: [...state.mangas, manga]
      }));
    },

    removeManga: async (mangaUrl) => {
      deleteManga(mangaUrl);
      set((state) => ({
        mangas: state.mangas.filter(m => m.url !== mangaUrl)
      }));
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
