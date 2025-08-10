import { useThemeStore } from '@/store/themeStore';
import { darkColors, lightColors } from '@/theme/colors';
import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';

type ThemeColors = typeof lightColors;

interface ThemeContextValue {
  colors: ThemeColors;
  isDark: boolean;
  resolvedTheme: 'light' | 'dark'; // actual applied theme
  themePreference: 'light' | 'dark' | 'system'; // user preference
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const { theme: themePreference, setTheme } = useThemeStore();
  const systemTheme = useColorScheme();

  const resolvedTheme =
    themePreference === 'system' ? systemTheme || 'light' : themePreference;

  const isDark = resolvedTheme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  const value: ThemeContextValue = {
    colors,
    isDark,
    resolvedTheme,
    themePreference,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
