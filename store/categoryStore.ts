import { Category, deleteCategory, getCategories, insertCategory, reassignMangaCategory } from '@/db/db';
import { create } from 'zustand';

interface CategoryState {
    categories: Category[];
    activeCategory: string;
    loadCategories: () => Promise<void>;
    addCategory: (name: string) => Promise<void>;
    setActiveCategory: (id: string) => void;
    deleteCategory: (id: string) => Promise<void>;
}

export const useCategoryStore = create<CategoryState>()((set, get) => ({
    categories: [{id:'default', name: 'All'}],
    activeCategory: 'default',

    loadCategories: async () => {
        const categories = await getCategories();
        const hasDefault = categories.some(c => c.id === 'default');
        if (!hasDefault) categories.unshift({ id: 'default', name: 'All' });
        set({ categories });
    },

    addCategory: async (name) => {
        const newCategory = { id: name.toLocaleLowerCase().replace(/\s+/g, '_'), name };
        // Optimistic update
        set((state) => ({ categories: [...state.categories, newCategory] }));
        try {
            await insertCategory(newCategory);
        } catch (error) {
            // Rollback
            set((state) => ({
                categories: state.categories.filter(c => c.id !== newCategory.id)
            }));
            throw error;
        }
    },

    setActiveCategory: (id) => set({ activeCategory: id }),

    deleteCategory: async (id) => {
        if (id === 'default') return;
        const snapshot = get().categories;
        const prevActive = get().activeCategory;
        // Optimistic update
        set((state) => ({
            categories: state.categories.filter(item => item.id !== id),
            activeCategory: state.activeCategory === id ? 'default' : state.activeCategory
        }));
        try {
            await reassignMangaCategory(id, 'default');
            await deleteCategory(id);
        } catch (error) {
            // Rollback
            set({ categories: snapshot, activeCategory: prevActive });
            throw error;
        }
    }
}));
