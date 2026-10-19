import { useCallback, useEffect, useMemo, useState } from "react";
import { THEME_STORAGE_KEY, homepageContent } from "./content";

const readStorage = (key) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key, value) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures; the homepage should still be usable.
  }
};

const getInitialTheme = () => {
  const stored = readStorage(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;

  if (window.matchMedia?.("(prefers-color-scheme: light)")?.matches) {
    return "light";
  }

  return "dark";
};

const detectLanguage = () => {
  const nav = window.navigator?.language || "";
  const language = nav.toLowerCase().startsWith("zh") ? "zh_CN" : "en";
  return homepageContent[language] ? language : "en";
};

export const useHomepageSettings = () => {
  const [language] = useState(detectLanguage);
  const [themeMode, setThemeModeState] = useState(getInitialTheme);

  const setThemeMode = useCallback((value) => {
    setThemeModeState(value);
    writeStorage(THEME_STORAGE_KEY, value);
  }, []);

  const toggleThemeMode = useCallback(() => {
    setThemeMode(themeMode === "dark" ? "light" : "dark");
  }, [setThemeMode, themeMode]);

  useEffect(() => {
    document.documentElement.lang = language.replace("_", "-");
  }, [language]);

  return useMemo(
    () => ({
      language,
      themeMode,
      toggleThemeMode,
    }),
    [language, themeMode, toggleThemeMode]
  );
};
