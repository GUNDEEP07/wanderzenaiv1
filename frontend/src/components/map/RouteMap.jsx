import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Map of a route: numbered stops joined by a dashed line (MapLibre + OpenFreeMap tiles).
 * The map library loads on first use. Stops without coordinates are skipped; with none, or
 * when the browser can't draw maps, nothing is rendered (the stop list beside it still says it all).
 *
 * @param {{ stops: {name:string, lat:number|null, lng:number|null}[], activeIndex?: number,
 *           height?: number, label?: string }} props
 */
export default function RouteMap({ stops = [], activeIndex = -1, height = 240, label }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const [failed, setFailed] = useState(false);

  const located = useMemo(
    () => stops.filter(s => Number.isFinite(s?.lat) && Number.isFinite(s?.lng) && Math.abs(s.lat) <= 90 && Math.abs(s.lng) <= 180),
    [stops],
  );
  const signature = located.map(s => `${s.name}:${s.lat.toFixed(3)},${s.lng.toFixed(3)}`).join('>');
  // activeIndex refers to `stops`; translate it to the located list.
  const activeLocated = activeIndex >= 0 && stops[activeIndex] ? located.indexOf(stops[activeIndex]) : -1;

  // Always draw the latest stops, even if they changed while the library was loading.
  const latest = useRef({ located, activeLocated });
  latest.current = { located, activeLocated };
  const loading = useRef(false);
  const unmounted = useRef(false);

  useEffect(() => {
    if (!located.length || failed || !ref.current) return;
    if (mapRef.current) { mapRef.current.update(located, activeLocated); return; }
    if (loading.current) return; // the pending load will draw latest.current
    loading.current = true;
    import('./routeMapEngine')
      .then(({ canRender, createRouteMap }) => {
        if (unmounted.current || !ref.current) return;
        if (!canRender()) { setFailed(true); return; }
        mapRef.current = createRouteMap(ref.current, {
          stops: latest.current.located,
          activeIndex: latest.current.activeLocated,
          onError: () => setFailed(true),
        });
      })
      .catch(() => { if (!unmounted.current) setFailed(true); })
      .finally(() => { loading.current = false; });
  }, [signature, activeLocated, failed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    unmounted.current = false; // StrictMode re-mounts in dev
    return () => { unmounted.current = true; mapRef.current?.destroy(); mapRef.current = null; };
  }, []);

  if (!located.length || failed) return null;
  return (
    <div
      ref={ref}
      role="region"
      aria-label={label || `Map of your route: ${located.map(s => s.name).join(' → ')}`}
      data-testid="route-map"
      style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: '#e9edf0', marginBottom: '1rem' }}
    />
  );
}
