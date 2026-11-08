import { lazy } from 'react';

const KEY = 'wz_chunk_reload_at';
const WINDOW_MS = 60 * 1000;

/** True for the errors browsers give when a code-split file can't be fetched. */
export function isChunkLoadError(err) {
  const msg = String(err?.message || err || '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk [\w-]+ failed/i.test(msg);
}

/**
 * React.lazy that survives a deploy. A tab opened before a deploy still points at the old
 * page files; if one can't be loaded, reload once to get the new version instead of
 * showing "Something went wrong". Guarded so a real outage can't cause a reload loop.
 * @param {() => Promise<{ default: any }>} importer
 * @param {{ reload?: () => void, storage?: Storage }} [deps] for tests
 */
export function lazyWithReload(importer, deps = {}) {
  return lazy(() => loadWithReload(importer, deps));
}

export async function loadWithReload(importer, { reload = () => window.location.reload(), storage } = {}) {
  try {
    return await importer();
  } catch (err) {
    if (!isChunkLoadError(err)) throw err;
    let store = storage;
    try { store = store || window.sessionStorage; } catch { store = null; }
    let last = 0;
    try { last = Number(store?.getItem(KEY)) || 0; } catch { /* storage blocked */ }
    if (Date.now() - last > WINDOW_MS) {
      try { store?.setItem(KEY, String(Date.now())); } catch { /* storage blocked */ }
      reload();
      return new Promise(() => {}); // keep Suspense showing until the reload happens
    }
    throw err; // already reloaded a moment ago: let the error boundary show
  }
}
