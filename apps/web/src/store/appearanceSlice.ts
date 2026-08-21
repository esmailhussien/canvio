import type { StateCreator } from 'zustand';
import type { CanvasStore, ThemePreference } from './canvasStoreTypes';

type AppearanceSlice = Pick<
  CanvasStore,
  | 'theme'
  | 'themePreference'
  | 'canvasBackground'
  | 'toggleTheme'
  | 'setThemePreference'
  | 'syncSystemTheme'
  | 'setCanvasBackground'
  | 'setAppearance'
>;

type StoreSet = Parameters<StateCreator<CanvasStore>>[0];
type StoreGet = Parameters<StateCreator<CanvasStore>>[1];

export const getSystemTheme = (): 'dark' | 'light' => {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};

const getInitialThemePreference = (): ThemePreference => {
  if (typeof window === 'undefined') return 'system';
  const saved = window.localStorage.getItem('canvio-theme-preference');
  return saved === 'dark' || saved === 'light' ? saved : 'system';
};

const getInitialTheme = (): 'dark' | 'light' => {
  if (typeof window === 'undefined') return 'dark';
  const preference = getInitialThemePreference();
  return preference === 'system' ? getSystemTheme() : preference;
};

export const getInitialStrokeColor = (): string => {
  if (typeof window === 'undefined') return '#f0f0f5';
  const theme = getInitialTheme();
  return theme === 'light' ? '#0f172a' : '#f0f0f5';
};

const getInitialCanvasBackground = (): string | null => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('canvio-canvas-background');
};

export const persistCanvasBackground = (canvasBackground: string | null): void => {
  if (typeof window === 'undefined') return;

  if (canvasBackground) {
    window.localStorage.setItem('canvio-canvas-background', canvasBackground);
  } else {
    window.localStorage.removeItem('canvio-canvas-background');
  }
};

const applyDocumentTheme = (theme: 'dark' | 'light'): void => {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
};

export function createAppearanceSlice(set: StoreSet, get: StoreGet): AppearanceSlice {
  return {
    theme: getInitialTheme(),
    themePreference: getInitialThemePreference(),
    canvasBackground: getInitialCanvasBackground(),
    toggleTheme: () => {
      const state = get();
      state.setThemePreference(state.theme === 'dark' ? 'light' : 'dark');
    },
    setThemePreference: (themePreference) => {
      const theme = themePreference === 'system' ? getSystemTheme() : themePreference;
      applyDocumentTheme(theme);

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('canvio-theme-preference', themePreference);
        if (themePreference === 'system') {
          window.localStorage.removeItem('canvio-theme');
        } else {
          window.localStorage.setItem('canvio-theme', theme);
        }
      }

      set({ theme, themePreference });
    },
    syncSystemTheme: () => set((state) => {
      if (state.themePreference !== 'system') return state;

      const theme = getSystemTheme();
      applyDocumentTheme(theme);
      return theme === state.theme ? state : { theme };
    }),
    setCanvasBackground: (canvasBackground) => {
      persistCanvasBackground(canvasBackground);
      set({ canvasBackground });
    },
    setAppearance: (appearance) => set((state) => {
      const theme = state.themePreference === 'system' ? getSystemTheme() : state.themePreference;
      const canvasBackground = appearance.canvasBackground === undefined
        ? state.canvasBackground
        : appearance.canvasBackground;

      applyDocumentTheme(theme);
      persistCanvasBackground(canvasBackground);

      return { theme, canvasBackground };
    }),
  };
}
