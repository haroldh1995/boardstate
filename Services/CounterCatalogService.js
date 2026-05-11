import { DEFAULT_COUNTER_TYPES } from "../Models/GameModels.js";

export function searchCounterTypes(query, recentSearches = []) {
  const normalizedQuery = normalizeQuery(query);
  const uniqueRecent = Array.from(new Set((recentSearches || []).map((entry) => normalizeCounterType(entry)).filter(Boolean)));
  const catalog = [...uniqueRecent, ...DEFAULT_COUNTER_TYPES.filter((entry) => !uniqueRecent.includes(entry))];

  if (!normalizedQuery) {
    return catalog;
  }

  return catalog.filter((entry) => entry.toLowerCase().includes(normalizedQuery));
}

export function updateRecentCounterSearches(recentSearches = [], counterType) {
  const normalized = normalizeCounterType(counterType);
  if (!normalized) {
    return Array.isArray(recentSearches) ? recentSearches.slice(0, 5) : [];
  }

  const next = [normalized, ...(Array.isArray(recentSearches) ? recentSearches : []).map(normalizeCounterType).filter(Boolean)];
  return Array.from(new Set(next)).slice(0, 5);
}

function normalizeCounterType(value) {
  if (typeof value !== "string") {
    return "";
  }
  const normalized = value.trim();
  return normalized || "";
}

function normalizeQuery(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().toLowerCase();
}
