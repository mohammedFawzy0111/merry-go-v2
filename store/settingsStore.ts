import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type ThemePreference = "light" | "dark" | "system";
type ReadingMode = "vertical" | "rtl" | "ltr";
type FontSize = "xs" | "s" | "m" | "l" | "xl";

interface SettingsState {
    themePreference: ThemePreference;
    readingMode: ReadingMode;
    fontSize: FontSize;
    nightReadingMode: boolean;
    // ... other settings
    
    setThemePreference: (theme: ThemePreference) => void;
    setReadingMode: (mode: ReadingMode) => void;
    setFontSize: (size: FontSize) => void;
    setNightReadingMode: (mode:boolean) => void;
    // ... other setters
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      themePreference: "system",
      readingMode: "vertical",
      fontSize: "m",
      nightReadingMode: false,
      
      setThemePreference: (themePreference) => set({ themePreference }),
      setReadingMode: (readingMode) => set({readingMode}),
      setFontSize: (fontSize) => set ({fontSize}),
      setNightReadingMode: (nightReadingMode) => set ({nightReadingMode}),
      // ... other setters
    }),
    {
      name: "app-settings",
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