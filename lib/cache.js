// Simple in-memory cache for rarely-changing lookup data
// Departments, processes, projects, packages change very infrequently
// Cache them to avoid hitting the database on every request

const cache = new Map();

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

export function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCached(key, data, ttl = DEFAULT_TTL) {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttl
  });
}

export function invalidateCache(key) {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

// Cache keys
export const CACHE_KEYS = {
  DEPARTMENTS: 'departments',
  PROCESSES: 'processes',
  PROJECTS: 'projects',
  PACKAGES: 'packages',
  SUPPLIER_NAMES: 'supplier_names'
};
