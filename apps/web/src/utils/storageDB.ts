/**
 * Asynchronous IndexedDB Storage Utility
 * Provides reliable, quota-free local storage for Canvio worlds (overcoming localStorage 5MB limit).
 */

const DB_NAME = 'CanvioDB';
const DB_VERSION = 1;
const STORE_NAME = 'worlds';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getStorageItem<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => resolve((request.result as T) ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn(`[storageDB] IndexedDB get error for key "${key}", falling back to localStorage`, err);
    try {
      const fallback = localStorage.getItem(key);
      return fallback ? (JSON.parse(fallback) as T) : null;
    } catch {
      return null;
    }
  }
}

export async function setStorageItem<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(value, key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn(`[storageDB] IndexedDB set error for key "${key}", falling back to localStorage`, err);
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage quota fallback
    }
  }
}

export async function removeStorageItem(key: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore
    }
  }
}
