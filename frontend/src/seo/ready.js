/**
 * Hand-over from a prerendered page to the live app.
 *
 * Public pages are saved as finished HTML at build time (scripts/prerender.mjs) so search
 * engines and first visits see the real page. main.jsx keeps that copy on screen and renders
 * the app into a hidden root beside it; when the page says it is ready (its <Seo ready />
 * — data loaded) the copy is removed and the app shown, so there is no flash of a spinner
 * or "Loading…" in between. A safety timer shows the app anyway.
 */
const SAFETY_MS = 4000;
let swap = null;

/** Called once from main.jsx. Returns the element React should render into. */
export function prepareRoot(doc = document) {
  const root = doc.getElementById('root');
  if (!root || !root.firstElementChild || doc.documentElement.dataset.prerendered !== 'true') return root;

  root.id = 'prerendered-root';
  root.setAttribute('aria-hidden', 'false');
  const live = doc.createElement('div');
  live.id = 'root';
  // Laid out (so maps and measured elements size correctly) but invisible and out of the way.
  live.style.cssText = 'visibility:hidden;position:absolute;top:0;left:0;width:100%;pointer-events:none;';
  root.after(live);

  let done = false;
  swap = () => {
    if (done) return;
    done = true;
    root.remove();
    live.style.cssText = '';
  };
  setTimeout(swap, SAFETY_MS);
  return live;
}

/** Pages call this (through <Seo ready>) once their content is on screen. */
export function markPageReady() {
  // The prerender script waits for this before saving the page.
  if (typeof window !== 'undefined') window.__WZ_READY__ = true;
  if (!swap) return;
  // Next frame: let React paint the live tree before the copy goes.
  const run = swap;
  (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (f) => setTimeout(f, 0))(() => run());
}

/** Test hook. */
export function _reset() { swap = null; }
