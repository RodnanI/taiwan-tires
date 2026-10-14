// localStorage wrapper that never throws (private mode, blocked storage, quota) and falls back to memory.
const memory = new Map();
function ls() { try { return globalThis.localStorage || null; } catch { return null; } }

export const storage = {
  get(key, fallback = null) {
    try {
      const raw = ls()?.getItem(key) ?? memory.get(key) ?? null;
      return raw == null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value) {
    const raw = JSON.stringify(value);
    memory.set(key, raw);
    try { ls()?.setItem(key, raw); return true; } catch { return false; }
  },
  remove(key) { memory.delete(key); try { ls()?.removeItem(key); } catch { /* ignore */ } },
};
