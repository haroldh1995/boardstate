import { createDefaultProfile } from "../state/schema.js";

const DB_NAME = "boardstate";
const STORE_NAME = "profiles";
const ACTIVE_KEY = "active-profile";
const FALLBACK_KEY = "boardstate-profile";
const LEGACY_FALLBACK_KEYS = ["boardstate-hybrid-profile"];

function openDatabase() {
  if (!("indexedDB" in globalThis)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

export async function loadProfile() {
  const database = await openDatabase();
  if (!database) {
    return loadFallbackProfile();
  }

  const profile = await new Promise((resolve) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(ACTIVE_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
  database.close();
  return profile || loadFallbackProfile();
}

export async function saveProfile(profile) {
  const database = await openDatabase();
  if (!database) {
    saveFallbackProfile(profile);
    return profile;
  }

  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(profile, ACTIVE_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
  saveFallbackProfile(profile);
  return profile;
}

export function exportProfile(profile) {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      app: "BoardState",
      profile,
    },
    null,
    2
  );
}

export function parseImportedProfile(text) {
  const payload = JSON.parse(text);
  return payload.profile || payload;
}

function loadFallbackProfile() {
  try {
    const raw = localStorage.getItem(FALLBACK_KEY) || LEGACY_FALLBACK_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
    return raw ? JSON.parse(raw) : createDefaultProfile();
  } catch {
    return createDefaultProfile();
  }
}

function saveFallbackProfile(profile) {
  try {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(profile));
  } catch {
    // Local gameplay still continues in memory if persistent storage is unavailable.
  }
}
