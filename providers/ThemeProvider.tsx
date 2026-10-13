// Theme

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance } from "react-native";

export type ThemeName = "light" | "dark";

export type Colors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentDark: string;
  accentLight: string;
  onAccent: string;
  brown: string;
  brownDark: string;
  white: string;
  black: string;
  shadow: string;
};

const lightColors: Colors = {
  background: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceAlt: "#EAF3FC",
  textPrimary: "#000000",
  textSecondary: "#4D4D4D",
  textMuted: "#9A9A9A",
  border: "#CFE4FB",
  borderStrong: "#7FB8F5",
  accent: "#0B6FDB",
  accentDark: "#0A4B99",
  accentLight: "#7FB8F5",
  onAccent: "#FFFFFF",
  brown: "#5C7A99",
  brownDark: "#37536B",
  white: "#FFFFFF",
  black: "#000000",
  shadow: "#000000",
};

const darkColors: Colors = {
  background: "#121212",
  surface: "#1E1E1E",
  surfaceAlt: "#1A2733",
  textPrimary: "#FFFFFF",
  textSecondary: "#B3B3B3",
  textMuted: "#808080",
  border: "#1F3A57",
  borderStrong: "#3D7DC1",
  accent: "#4DA6FF",
  accentDark: "#1E88E5",
  accentLight: "#3D7DC1",
  onAccent: "#000000",
  brown: "#6B94B3",
  brownDark: "#4A7A9E",
  white: "#FFFFFF",
  black: "#000000",
  shadow: "#000000",
};

const PREFERENCE_KEY = "theme_preference";

type ThemeContextValue = {
  theme: ThemeName;
  colors: Colors;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: ThemeName) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Theme
  const [theme, setThemeState] = useState<ThemeName>(() =>
    Appearance.getColorScheme() === "dark" ? "dark" : "light"
  );

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(PREFERENCE_KEY);
        if (saved === "light" || saved === "dark") {
          setThemeState(saved);
          return;
        }
      } catch {
        // Fallback
      }
      const system = Appearance.getColorScheme();
      setThemeState(system === "dark" ? "dark" : "light");
    })();
  }, []);

  const setTheme = (next: ThemeName) => {
    setThemeState(next);
    AsyncStorage.setItem(PREFERENCE_KEY, next).catch(() => {});
  };

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      colors: theme === "dark" ? darkColors : lightColors,
      isDark: theme === "dark",
      toggleTheme,
      setTheme,
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
