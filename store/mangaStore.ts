import { addChapters, addManga, deleteManga, getChapters, getMangas } from '@/db/db';
import { Chapter, Manga } from '@/utils/sourceModel';
import { create } from 'zustand';

interface MangaStore {
  mangas: Manga[];
  loading: boolean;
  loadMangas: ()=> Promise<void>;
  addManga: (manga: Manga) => Promise<void>;
  removeManga: (mangaUrl: string) => Promise<void>;
  getMangaByUrl: (url: string) => Promise<Manga | undefined>;
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
      // Optimistic: add to UI immediately
      set((state) => ({
        mangas: [...state.mangas, manga],
        chapters: { ...state.chapters, [manga.url]: manga.chapters ?? [] }
      }));
      try {
        addManga(manga);
        const chapters = manga.chapters ?? [];
        if (chapters.length > 0) addChapters(chapters);
      } catch (error) {
        // Rollback on failure
        set((state) => ({
          mangas: state.mangas.filter(m => m.url !== manga.url),
        }));
        throw error;
      }
    },

    removeManga: async (mangaUrl) => {
      // Snapshot for rollback
      const snapshot = get().mangas;
      // Optimistic: remove from UI immediately
      set((state) => ({
        mangas: state.mangas.filter(m => m.url !== mangaUrl)
      }));
      try {
        deleteManga(mangaUrl);
      } catch (error) {
        // Rollback on failure
        set({ mangas: snapshot });
        throw error;
      }
    },

    getMangaByUrl: async (mangaUrl) => {
      const manga = get().mangas.find(m => m.url === mangaUrl);
      if (!manga) return;
      // Load chapters from database
      if (!get().chapters[mangaUrl]) {
        await get().loadChapters(mangaUrl);
      }
      // Return manga with chapters attached
      return {
        ...manga,
        chapters: get().chapters[mangaUrl] || []
      };
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
