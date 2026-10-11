import { create } from 'zustand';
import { readerApi, User, AuthConfig, UserSettings } from '../lib/api/readerApi';

interface AppState {
  user: User | null;
  authConfig: AuthConfig | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  settings: UserSettings;

  // Actions
  fetchAuthConfig: () => Promise<void>;
  fetchUser: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  login: (credentials: any) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const DEFAULT_SETTINGS: UserSettings = {
  reading_theme: 'dark',
  font_size: 'base',
  line_spacing: 'relaxed',
  audio_speed: 1.0,
  auto_scroll: true,
  tts_wake_lock: true,
  tts_auto_advance: false,
};

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  authConfig: null,
  isLoggedIn: false,
  isLoading: true,
  settings: DEFAULT_SETTINGS,

  fetchAuthConfig: async () => {
    try {
      const config = await readerApi.getAuthConfig();
      set({ authConfig: config });
    } catch (e) {
      console.error('Failed to fetch auth configuration', e);
    }
  },

  fetchUser: async () => {
    try {
      const res = await readerApi.getMe();
      if (res && res.authenticated && res.user) {
        set({ user: res.user, isLoggedIn: true, isLoading: false });
        // Fetch DB-backed settings for zero localStorage compliance
        get().fetchSettings();
      } else {
        set({ user: null, isLoggedIn: false, isLoading: false });
      }
    } catch (e) {
      set({ user: null, isLoggedIn: false, isLoading: false });
    }
  },

  fetchSettings: async () => {
    try {
      const dbSettings = await readerApi.getUserSettings();
      if (dbSettings) {
        set({ settings: dbSettings });
      }
    } catch (e) {
      console.warn('Could not fetch remote settings, using defaults', e);
    }
  },

  updateSettings: async (partial: Partial<UserSettings>) => {
    const current = get().settings;
    const updated = { ...current, ...partial };
    set({ settings: updated });
    try {
      await readerApi.updateUserSettings(partial);
    } catch (e) {
      console.error('Failed to save settings to DB', e);
    }
  },

  login: async (credentials: any) => {
    try {
      const res = await readerApi.login(credentials);
      if (res && res.status === 'success') {
        set({ user: res.user, isLoggedIn: true });
        get().fetchSettings();
        return { success: true };
      }
      return { success: false, error: res.message || 'Login failed' };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.detail || 'Network or server error' };
    }
  },

  logout: async () => {
    try {
      await readerApi.logout();
    } catch (e) {}
    set({ user: null, isLoggedIn: false });
    window.location.href = '/login';
  },
}));
