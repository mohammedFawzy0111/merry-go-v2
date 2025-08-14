import { darkColors, lightColors } from "@/constants/colors";
import { fontSizes } from "@/constants/fontsizes";
import { useSettingsStore } from "@/store/settingsStore";
import React, { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";

type ThemeType = "light" | "dark" | "system";
type ReadingModeType = "vertical" | "rtl" | "ltr";
type FontSizeType = "xs" | "s" | "m" | "l" | "xl";

interface SettingsContextType {
  themePreference: ThemeType;
  setThemePreference: (themePreference: ThemeType) => void;
  colors: typeof lightColors;
  isDark: boolean;

  readingMode: ReadingModeType;
  setReadingMode: (mode: ReadingModeType) => void;

  fontSize: FontSizeType;
  setFontSize: (size: FontSizeType) => void;
  sizes: {text: number; heading: number, sub: number};

  nightReadingMode: boolean;
  setNightReadingMode: (mode: boolean) => void;
  // Add more settings here later...
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // === get settings from the store ===
  const {themePreference,setThemePreference,readingMode,setReadingMode,fontSize, setFontSize, nightReadingMode, setNightReadingMode} = useSettingsStore();

  // === setting up the theme ===
  const systemTheme = useColorScheme();
  const resolvedTheme = themePreference === 'system' ? systemTheme|| 'light' : themePreference;
  const isDark = resolvedTheme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  // === setting up the font sizes ===
  const sizes = {text: fontSizes.text[fontSize], heading: fontSizes.heading[fontSize], sub: fontSizes.sub[fontSize]}

  const value = useMemo(
    () => ({
      themePreference,
      setThemePreference,
      isDark,
      colors,
      readingMode,
      setReadingMode,
      fontSize,
      setFontSize,
      sizes,
      nightReadingMode,
      setNightReadingMode
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [themePreference, isDark, readingMode, fontSize, nightReadingMode] // Add new states here as dependencies
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

const useSettingsContext = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used inside SettingsProvider");
  }
  return context;
};

// ====== Custom Hooks ======

// For themePreference only
export const useTheme = () => {
  const { themePreference, setThemePreference, colors, isDark } = useSettingsContext()
  return { themePreference, setThemePreference, colors, isDark};
};

// For readingMode only
export const useReadingMode = () => {
  const { readingMode, setReadingMode } = useSettingsContext();
  return { readingMode, setReadingMode };
};

// For fontSize only
export const useFontSize = () => {
  const { fontSize, setFontSize, sizes } = useSettingsContext()
  return { fontSize, setFontSize, sizes };
}

// for night reading mode onnly
export const useNightReading = () => {
  const { nightReadingMode, setNightReadingMode } = useSettingsContext()
  return { nightReadingMode, setNightReadingMode };
}

// Full access (if needed)
export const useSettings = useSettingsContext;
