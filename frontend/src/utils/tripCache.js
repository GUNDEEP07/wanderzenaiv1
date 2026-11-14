/**
 * Keeps the last loaded copy of a trip (and which stops are done) on this device, so the
 * trip page still works without signal. Storage can be full, blocked or wiped: every call
 * is best-effort and never throws.
 */
const TRIP_KEY = (id) => `wz_trip_${id}`;
const DONE_KEY = (id) => `wz_done_${id}`;
const MAX_TRIPS = 5;
const INDEX_KEY = 'wz_trip_index';

const read = (key) => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const write = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

/** The saved copy: { data, savedAt } or null. */
export const loadSavedTrip = (id) => {
  const v = read(TRIP_KEY(id));
  return v && v.data && v.savedAt ? v : null;
};

/** Saves a trip (keeps the 5 most recent). Returns true when it was stored. */
export function saveTrip(id, data, now = Date.now()) {
  if (!id || !data) return false;
  const index = (read(INDEX_KEY) || []).filter(x => x !== id);
  index.unshift(id);
  for (const old of index.splice(MAX_TRIPS)) {
    try { window.localStorage.removeItem(TRIP_KEY(old)); } catch { /* ignore */ }
  }
  write(INDEX_KEY, index);
  // The travel date is the owner's; it's fine on their own device.
  return write(TRIP_KEY(id), { data, savedAt: now });
}

/** Stops marked done on this device: Set of "day:stopId". */
export const loadDone = (id) => new Set(read(DONE_KEY(id)) || []);
export const saveDone = (id, set) => write(DONE_KEY(id), [...set].slice(0, 500));
