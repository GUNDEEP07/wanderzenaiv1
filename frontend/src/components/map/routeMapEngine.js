// MapLibre + OpenFreeMap, loaded only when a route map is shown (keeps the main bundle small).
// OpenFreeMap: free for commercial use, no key, no request limits; attribution is added
// automatically by MapLibre from the style (© OpenMapTiles, © OpenStreetMap).
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { markerGroups } from './routeMapUtils';

export const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
const TEAL = '#00a88a';

/** True when this browser can draw the map (WebGL). */
export function canRender() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

function markerEl(group, active) {
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = 'display:flex;align-items:center;gap:6px;pointer-events:none;transform:translateY(-2px)';
  const dot = document.createElement('div');
  dot.textContent = group.numbers.join(' · ');
  dot.style.cssText = `min-width:24px;height:24px;padding:0 6px;border-radius:12px;display:flex;align-items:center;justify-content:center;font:700 12px/1 system-ui,sans-serif;color:#fff;background:${active ? '#0a1628' : TEAL};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)`;
  const label = document.createElement('div');
  label.textContent = group.name;
  label.style.cssText = 'font:600 12px/1.2 system-ui,sans-serif;color:#0a1628;background:rgba(255,255,255,.92);padding:2px 6px;border-radius:6px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.2)';
  el.append(dot, label);
  return el;
}

const lineData = (stops) => ({
  type: 'FeatureCollection',
  features: stops.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: stops.map(s => [s.lng, s.lat]) } }] : [],
});

/**
 * Draws the route into `container`. Returns { update(stops, activeIndex), destroy() }.
 * `onError` fires if the map can't load (no WebGL, tiles blocked) so the caller can hide it.
 */
export function createRouteMap(container, { stops, activeIndex = -1, onError }) {
  const map = new maplibregl.Map({
    container,
    style: STYLE_URL,
    center: [stops[0].lng, stops[0].lat],
    zoom: 5,
    attributionControl: { compact: true },
    cooperativeGestures: true, // page scroll isn't hijacked; ctrl/two-finger to zoom
    dragRotate: false,
    pitchWithRotate: false,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  // Before the style has loaded, any error (style or tiles unreachable) means no usable map:
  // tell the caller so it hides the box. Later tile hiccups are left to MapLibre's retries.
  let loaded = false;
  map.on('error', (e) => { if (!loaded) onError?.(e?.error); });
  map.once('load', () => { loaded = true; });

  let markers = [];
  let current = { stops, activeIndex };

  const fit = (animate) => {
    const s = current.stops;
    if (s.length === 1) { map.jumpTo({ center: [s[0].lng, s[0].lat], zoom: 8 }); return; }
    const b = new maplibregl.LngLatBounds();
    s.forEach(p => b.extend([p.lng, p.lat]));
    map.fitBounds(b, { padding: { top: 40, bottom: 60, left: 40, right: 110 }, maxZoom: 10, duration: animate ? 600 : 0 });
  };

  const draw = (animate) => {
    markers.forEach(m => m.remove());
    const activeName = current.stops[current.activeIndex]?.name;
    markers = markerGroups(current.stops).map(g => new maplibregl.Marker({ element: markerEl(g, g.name === activeName), anchor: 'left', offset: [-12, 0] })
      .setLngLat([g.lng, g.lat]).addTo(map));
    const src = map.getSource('route');
    if (src) src.setData(lineData(current.stops));
    fit(animate);
  };

  map.on('load', () => {
    map.addSource('route', { type: 'geojson', data: lineData(current.stops) });
    map.addLayer({ id: 'route-casing', type: 'line', source: 'route', paint: { 'line-color': '#ffffff', 'line-width': 6, 'line-opacity': 0.9 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
    map.addLayer({ id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': TEAL, 'line-width': 3, 'line-dasharray': [2, 1.5] }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
    draw(false);
  });

  return {
    update(nextStops, nextActive = -1) {
      current = { stops: nextStops, activeIndex: nextActive };
      if (map.loaded() && map.getSource('route')) draw(true);
    },
    destroy() {
      markers.forEach(m => m.remove());
      map.remove();
    },
  };
}
