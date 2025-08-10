// store/themeStore.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type ThemeType = "light" | "dark" | "system";

interface ThemeState {
    theme: ThemeType;
    setTheme: (theme: ThemeType) => void;
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
        theme: "system",
        setTheme: (theme) => set({ theme }),
        }),
        {
        name: "theme-storage",
        storage: {
            getItem: async (name) => {
            const value = await AsyncStorage.getItem(name);
            return value ? JSON.parse(value) : null;
            },
            setItem: async (name, value) => {
            await AsyncStorage.setItem(name, JSON.stringify(value));
            },
            removeItem: async (name) => {
            await AsyncStorage.removeItem(name);
            },
        },
        }
    )
);