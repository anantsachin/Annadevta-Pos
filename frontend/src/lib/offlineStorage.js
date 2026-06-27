// offlineStorage.js
// Persists server data locally so the app can run offline.

const KEYS = {
  MENU: "pos_offline_menu",
  CATEGORIES: "pos_offline_categories",
  SETTINGS: "pos_offline_settings",
  USER: "pos_offline_user",
};

function save(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch (e) {
    console.warn("offlineStorage.save failed:", e);
  }
}

function load(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw).data;
  } catch (e) {
    console.warn("offlineStorage.load failed:", e);
    return null;
  }
}

export const offlineStorage = {
  saveMenu: (data) => save(KEYS.MENU, data),
  loadMenu: () => load(KEYS.MENU) || [],

  saveCategories: (data) => save(KEYS.CATEGORIES, data),
  loadCategories: () => load(KEYS.CATEGORIES) || [],

  saveSettings: (data) => save(KEYS.SETTINGS, data),
  loadSettings: () => load(KEYS.SETTINGS) || null,

  saveUser: (data) => save(KEYS.USER, data),
  loadUser: () => load(KEYS.USER) || null,

  clear: () => {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  },
};
