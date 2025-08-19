import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface Category {
    id: string;
    name: string;
}

interface CategoryState {
    categories: Category[];
    activeCategory: string;
    addCategory: (name: string) => void;
    setActiveCategory: (id: string) => void;
    deleteCategory: (id: string) => void;
}

export const useCategoryStore = create<CategoryState>()(
    persist(
        (set) => ({
            categories: [{ id: 'default', name: 'All' }],
            activeCategory: 'default',
            addCategory: (name) => 
            set((state) => ({
                categories: [...state.categories, { id: name.toLowerCase().replace(/\s+/g, '_'), name }]
            })),
            setActiveCategory: (id) => set({ activeCategory: id }),
            deleteCategory: (id) => set((state) => ({ categories: [...state.categories.filter(item=> item.id !== id)] })),
        }),
        {
            name: 'category-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);