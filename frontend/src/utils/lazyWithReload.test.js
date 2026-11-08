import { isChunkLoadError, loadWithReload } from './lazyWithReload';

const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('recognises chunk load errors from each browser', () => {
  expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/a.js'))).toBe(true);
  expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
  expect(isChunkLoadError(new Error('error loading dynamically imported module'))).toBe(true);
  expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
});

test('loads normally when the file is there', async () => {
  const mod = { default: 'Page' };
  expect(await loadWithReload(async () => mod, { reload: jest.fn(), storage: mem() })).toBe(mod);
});

test('stale file → reload once; a second failure right after is shown, not looped', async () => {
  const storage = mem(); const reload = jest.fn();
  const fail = async () => { throw new TypeError('Failed to fetch dynamically imported module: x'); };
  const pending = loadWithReload(fail, { reload, storage });
  await Promise.resolve(); await Promise.resolve();
  expect(reload).toHaveBeenCalledTimes(1);
  await expect(loadWithReload(fail, { reload, storage })).rejects.toThrow(/dynamically imported/);
  expect(reload).toHaveBeenCalledTimes(1);
  void pending;
});

test('other errors are not swallowed', async () => {
  const reload = jest.fn();
  await expect(loadWithReload(async () => { throw new Error('boom'); }, { reload, storage: mem() })).rejects.toThrow('boom');
  expect(reload).not.toHaveBeenCalled();
});
