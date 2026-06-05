import { useState, useEffect } from 'react';

const BASE = 'https://images.unsplash.com';
const UNSPLASH_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY || '';

const KNOWN_PHOTOS = {
  kyoto:      'photo-1493976040374-85c8e12f0c0e',
  tokyo:      'photo-1540959733332-eab4deabeeaf',
  bali:       'photo-1537996194471-e657df975ab4',
  paris:      'photo-1499856871958-5b9627545d1a',
  rome:       'photo-1552832230-c0197dd311b5',
  barcelona:  'photo-1539037116277-4db20889f2d4',
  amsterdam:  'photo-1534351590666-13e3e96b5017',
  london:     'photo-1513635269975-59663e0ac1ad',
  bangkok:    'photo-1563492065599-3520f775eeed',
  singapore:  'photo-1525625293386-3f8f99389edd',
  dubai:      'photo-1512453979798-5ea266f8880c',
  oaxaca:     'photo-1518638150340-f706e86654de',
  vietnam:    'photo-1528360983277-13d401cdc186',
  shimla:     'photo-1605649461784-bbb68578a55e',
  goa:        'photo-1512343879784-a960bf40e7f2',
  manali:     'photo-1626516011116-33bba50ec8ce',
  morocco:    'photo-1539020140153-e479b8c22e70',
  portugal:   'photo-1555881400-74d7acaacd8b',
  greece:     'photo-1533105079780-92b9be482077',
  nepal:      'photo-1544735716-392fe2489ffa',
  peru:       'photo-1526392060635-9d6019884377',
  japan:      'photo-1528360983277-13d401cdc186',
  india:      'photo-1524492412937-b28074a5d7da',
  indonesia:  'photo-1537996194471-e657df975ab4',
  thailand:   'photo-1528181304800-259b08848526',
  italy:      'photo-1516483638261-f4dbaf036963',
  spain:      'photo-1539037116277-4db20889f2d4',
  france:     'photo-1499856871958-5b9627545d1a',
  georgia:    'photo-1573739022854-abceaeb585dc',
  jordan:     'photo-1548199973-03cce0bbc87b',
  oman:       'photo-1578662996442-48f60103fc96',
  chile:      'photo-1501854140801-50d01698950b',
  colombia:   'photo-1576019280693-5a56c25d8dc6',
  mexico:     'photo-1518638150340-f706e86654de',
  iceland:    'photo-1504893524553-b855bce32c67',
  norway:     'photo-1501854140801-50d01698950b',
  albania:    'photo-1598300058816-b7cef6d4c90c',
  slovenia:   'photo-1587974928442-77dc3e0dba72',
  croatia:    'photo-1555990793-da11153b2473',
  'new york': 'photo-1485738422979-f5c462d49f74',
};

const SIZES = { card: [320, 180], hero: [800, 500], thumb: [200, 130] };
const FALLBACK_ID = 'photo-1469854523086-cc02fe5d8800';

// Module-level cache so repeated renders don't duplicate API calls
const _apiCache = new Map();

function buildUrl(id, size) {
  const [w, h] = SIZES[size] || SIZES.card;
  return `${BASE}/${id}?w=${w}&h=${h}&fit=crop&auto=format&q=70`;
}

// Sync lookup — returns known or fallback URL instantly
export function getDestinationPhoto(destination = '', keyword = '', size = 'card') {
  const name = (destination.split(',')[0].trim() || keyword.split(' ')[0] || '').toLowerCase();
  for (const [key, id] of Object.entries(KNOWN_PHOTOS)) {
    if (name.includes(key) || key.includes(name)) return buildUrl(id, size);
  }
  return buildUrl(FALLBACK_ID, size);
}

export function getFallbackPhoto(size = 'card') {
  return buildUrl(FALLBACK_ID, size);
}

// Async Unsplash search — caches results per keyword+size
async function fetchFromUnsplash(query, size) {
  if (!UNSPLASH_KEY || !query) return null;
  const cacheKey = `${query.toLowerCase()}_${size}`;
  if (_apiCache.has(cacheKey)) return _apiCache.get(cacheKey);

  try {
    const [w, h] = SIZES[size] || SIZES.card;
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const baseUrl = data.results?.[0]?.urls?.regular;
    if (!baseUrl) return null;
    const url = `${baseUrl}&w=${w}&h=${h}&fit=crop&q=70`;
    _apiCache.set(cacheKey, url);
    return url;
  } catch {
    return null;
  }
}

// React hook — returns sync fallback immediately, upgrades to Unsplash URL once fetched
export function useDestinationPhoto(destination = '', keyword = '', size = 'card') {
  const [src, setSrc] = useState(() => getDestinationPhoto(destination, keyword, size));

  useEffect(() => {
    setSrc(getDestinationPhoto(destination, keyword, size));
    const query = keyword || destination.split(',')[0].trim();
    if (!query) return;
    fetchFromUnsplash(query, size).then(url => { if (url) setSrc(url); });
  }, [destination, keyword, size]);

  return src;
}
