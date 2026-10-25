import React, { createContext, useContext, useState, useEffect } from 'react';
import { safeStorage } from '../services/storage';
import { ThemeColors, darkTheme, lightTheme } from '../constants/theme';

interface ThemeContextType {
  theme: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
  setScheme: (scheme: 'dark' | 'light') => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: darkTheme,
  isDark: true,
  toggleTheme: () => {},
  setScheme: () => {},
});

const THEME_STORAGE_KEY = 'xpenseflow_theme_mode';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState<boolean>(true);

  useEffect(() => {
    (async () => {
      try {
        const saved = await safeStorage.getItem(THEME_STORAGE_KEY);
        if (saved !== null) {
          setIsDark(saved === 'dark');
        }
      } catch (err) {
        console.error('Failed to load saved theme:', err);
      }
    })();
  }, []);

  const toggleTheme = async () => {
    try {
      const next = !isDark;
      setIsDark(next);
      await safeStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light');
    } catch (err) {
      console.error('Failed to toggle theme:', err);
    }
  };

  const setScheme = async (scheme: 'dark' | 'light') => {
    try {
      const dark = scheme === 'dark';
      setIsDark(dark);
      await safeStorage.setItem(THEME_STORAGE_KEY, scheme);
    } catch (err) {
      console.error('Failed to set theme scheme:', err);
    }
  };

  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, setScheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
