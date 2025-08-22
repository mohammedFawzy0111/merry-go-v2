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

export const useCategoryStore = create<CategoryState>()((set,get) => ({
    categories: [{id:'default', name: 'All'}],
    activeCategory: 'default',

    loadCategories: async () => {
        const categories = await getCategories();
        set({categories: categories});
    },

    addCategory: async(name) => {
        const newCategory = {id: name.toLocaleLowerCase().replace(/\s+/g,'_'), name};
        await insertCategory(newCategory);
        set((state) => ({
            categories: [...state.categories, newCategory]
        }));
    },

    setActiveCategory: (id) => set({activeCategory: id}),

    deleteCategory: async(id) => {
        if(id === 'default') return;
        await reassignMangaCategory(id, 'default');
        await deleteCategory(id);
        set((state) => ({
            categories: state.categories.filter(item => item.id !== id),
            activeCategory: state.activeCategory === id ? 'default' : state.activeCategory
        }));
    }
}));