import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

/**
 * While the banner shows, its height is published as --wz-cookie-h on <html>, so bars pinned
 * to the bottom of the screen (the planner's Back/Continue footer) sit above it, not under it.
 */
export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const root = document.documentElement;
    if (!visible || !ref.current) { root.style.removeProperty('--wz-cookie-h'); return undefined; }
    const set = () => root.style.setProperty('--wz-cookie-h', `${ref.current?.offsetHeight || 0}px`);
    set();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(set) : null;
    ro?.observe(ref.current);
    window.addEventListener('resize', set);
    return () => { ro?.disconnect(); window.removeEventListener('resize', set); root.style.removeProperty('--wz-cookie-h'); };
  }, [visible]);

  useEffect(() => {
    const accepted = localStorage.getItem('wz_cookies_accepted');
    if (!accepted) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem('wz_cookies_accepted', '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    // data-prerender-skip: never saved into prerendered pages (it depends on this visitor's choice).
    <div ref={ref} data-prerender-skip="" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: 'rgba(10,14,24,0.97)', backdropFilter: 'blur(16px)',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      padding: '16px 24px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', flex: 1, minWidth: 260 }}>
        We use essential cookies for authentication and to remember your preferences.{' '}
        <Link to="/privacy" style={{ color: '#00d4aa', textDecoration: 'none', fontWeight: 600 }}>
          Privacy Policy
        </Link>
      </div>
      <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
        <button
          onClick={accept}
          style={{ padding: '9px 20px', background: 'linear-gradient(135deg,#00d4aa,#00a87e)', border: 'none', borderRadius: 9, color: '#06090f', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
        >
          Accept
        </button>
      </div>
    </div>
  );
}
