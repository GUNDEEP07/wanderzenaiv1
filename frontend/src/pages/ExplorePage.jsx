import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL;
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDestinationPhoto, getFallbackPhoto, useDestinationPhoto } from '../utils/destinationPhotos';

const CONTINENTS = [
  { id: 'asia', name: 'Asia', emoji: '🏯', tagline: 'Ancient temples, mountain villages, street food' },
  { id: 'europe', name: 'Europe', emoji: '🏰', tagline: 'Countryside lanes, hilltop towns, hidden trattorias' },
  { id: 'africa', name: 'Africa', emoji: '🌍', tagline: 'Desert trails, tribal markets, untouched coastlines' },
  { id: 'americas', name: 'Americas', emoji: '🌎', tagline: 'Cloud forests, colonial towns, coastal villages' },
  { id: 'oceania', name: 'Oceania', emoji: '🌏', tagline: 'Remote islands, bush walks, indigenous culture' },
  { id: 'mideast', name: 'Middle East', emoji: '🕌', tagline: 'Ancient souks, desert camps, sea villages' },
];

const COUNTRIES = {
  asia: [
    { name: 'Japan',       tag: 'Slow travel favourite', desc: 'Backstreet Kyoto, mountain onsen towns, morning fish markets',  places: ['Kyoto', 'Kanazawa', 'Yakushima', 'Naoshima', 'Takayama'] },
    { name: 'Vietnam',     tag: 'Hidden gem',            desc: 'Mekong villages, limestone karsts, lantern-lit old towns',      places: ['Hoi An', 'Ha Giang', 'Ninh Binh', 'Phong Nha', 'Mui Ne'] },
    { name: 'India',       tag: 'Cultural depth',        desc: 'Rajasthani villages, spice routes, Himalayan trails',           places: ['Varanasi', 'Hampi', 'Coorg', 'Spiti Valley', 'Pondicherry'] },
    { name: 'Sri Lanka',   tag: 'Rising star',           desc: 'Tea plantation stays, whale watching, ancient rock temples',    places: ['Ella', 'Galle', 'Sigiriya', 'Trincomalee', 'Kandy'] },
    { name: 'Indonesia',   tag: 'Nature first',          desc: 'Rice terrace villages, volcano hikes, surf towns',              places: ['Ubud', 'Lombok', 'Flores', 'Nusa Penida', 'Sumba'] },
    { name: 'Georgia',     tag: 'Undiscovered',          desc: 'Wine country, Caucasus peaks, ancient cave cities',             places: ['Tbilisi', 'Mestia', 'Sighnaghi', 'Kazbegi', 'Uplistsikhe'] },
  ],
  europe: [
    { name: 'Italy',       tag: 'Slow travel icon',      desc: 'Puglia farmhouses, Dolomite villages, Sicilian markets',        places: ['Matera', 'Alberobello', 'Orvieto', 'Noto', 'Civita di Bagnoregio'] },
    { name: 'Portugal',    tag: 'Crowd free',            desc: 'Alentejo plains, fishing villages, azulejo-tiled towns',        places: ['Evora', 'Obidos', 'Monsanto', 'Tavira', 'Peneda-Geres'] },
    { name: 'Slovenia',    tag: 'Hidden gem',            desc: 'Alpine lakes, karst caves, wine villages',                      places: ['Lake Bled', 'Piran', 'Soca Valley', 'Skocjan', 'Ptuj'] },
    { name: 'Greece',      tag: 'Beyond the islands',    desc: 'Mainland villages, Zagori trails, off-island life',             places: ['Meteora', 'Zagori', 'Monemvasia', 'Pelion', 'Naxos'] },
    { name: 'Croatia',     tag: 'Coastal magic',         desc: 'Dalmatian islands, walled towns, olive grove trails',           places: ['Hvar', 'Vis', 'Plitvice', 'Rovinj', 'Korcula'] },
    { name: 'Albania',     tag: 'Undiscovered',          desc: 'Ottoman bazaars, Riviera bays, mountain villages',              places: ['Berat', 'Gjirokaster', 'Theth', 'Ksamil', 'Valbona'] },
  ],
  africa: [
    { name: 'Morocco',     tag: 'Sensory overload',      desc: 'Mountain Berber villages, Sahara camps, blue medinas',          places: ['Chefchaouen', 'Merzouga', 'Essaouira', 'Ait Benhaddou', 'Imlil'] },
    { name: 'Ethiopia',    tag: 'Ancient world',         desc: 'Rock-hewn churches, tribal cultures, coffee origins',           places: ['Lalibela', 'Omo Valley', 'Simien Mountains', 'Axum', 'Harar'] },
    { name: 'Tanzania',    tag: 'Wildlife + culture',    desc: 'Maasai villages, spice islands, remote beaches',                places: ['Zanzibar', 'Ngorongoro', 'Pemba Island', 'Usambara', 'Stone Town'] },
    { name: 'Rwanda',      tag: 'Rising star',           desc: 'Gorilla trekking, tea plantations, Lake Kivu villages',         places: ['Volcanoes NP', 'Lake Kivu', 'Nyungwe', 'Musanze', 'Akagera'] },
  ],
  americas: [
    { name: 'Mexico',      tag: 'Beyond the resorts',    desc: 'Colonial highland towns, cenote villages, Pacific coast',       places: ['Oaxaca', 'San Cristobal', 'Guanajuato', 'Bacalar', 'Merida'] },
    { name: 'Colombia',    tag: 'Transformation story',  desc: 'Coffee region fincas, Caribbean coast, flower towns',           places: ['Salento', 'Cartagena', 'Barichara', 'Palomino', 'Villa de Leyva'] },
    { name: 'Peru',        tag: 'Beyond Machu Picchu',   desc: 'Amazon villages, Lake Titicaca islands, Sacred Valley',         places: ['Cusco', 'Huaraz', 'Chachapoyas', 'Colca Canyon', 'Pisac'] },
    { name: 'Chile',       tag: 'End of the world',      desc: 'Patagonia trails, lake district towns, Atacama villages',       places: ['Torres del Paine', 'Chiloe', 'Pucon', 'Valle de Elqui', 'Punta Arenas'] },
  ],
  oceania: [
    { name: 'New Zealand', tag: 'Nature paradise',       desc: 'Fiordland walks, Maori culture, remote farmstays',              places: ['Queenstown', 'Abel Tasman', 'Rotorua', 'Coromandel', 'Milford Sound'] },
    { name: 'Australia',   tag: 'Beyond the cities',     desc: 'Outback stations, Cape York, Kimberley gorges',                 places: ['Blue Mountains', 'Margaret River', 'Daintree', 'Flinders Ranges', 'Byron Bay'] },
    { name: 'Fiji',        tag: 'Village life',          desc: 'Off-grid island villages, coral reefs, local kava ceremonies',  places: ['Yasawa Islands', 'Taveuni', 'Kadavu', 'Vanua Levu', 'Beqa'] },
  ],
  mideast: [
    { name: 'Jordan',      tag: 'Ancient wonder',        desc: 'Rose-red Petra, Wadi Rum camps, Dead Sea shores',               places: ['Petra', 'Wadi Rum', 'Aqaba', 'Wadi Mujib', 'Dana Reserve'] },
    { name: 'Oman',        tag: 'Underrated gem',        desc: 'Wadis, frankincense towns, dhow sailing, Bedouin camps',        places: ['Muscat', 'Salalah', 'Nizwa', 'Wahiba Sands', 'Jebel Akhdar'] },
  ],
};

// TRENDING uses getDestinationPhoto — no hardcoded URLs that can rot when Unsplash deletes photos
const TRENDING = [
  { dest: 'Kyoto, Japan',         trend: 'Slow travel favourite' },
  { dest: 'Oaxaca, Mexico',       trend: 'Hidden gem' },
  { dest: 'Bali, Indonesia',      trend: 'Nature first' },
  { dest: 'Tbilisi, Georgia',     trend: 'Undiscovered' },
  { dest: 'Matera, Italy',        trend: 'Slow travel icon' },
  { dest: 'Chefchaouen, Morocco', trend: 'Sensory overload' },
];

const MONTH_PICKS = {
  0:  { label: 'January',   picks: ['Morocco', 'Thailand', 'New Zealand'],    tip: 'Escape winter — North Africa and Southeast Asia are at their best' },
  1:  { label: 'February',  picks: ['Japan', 'Jordan', 'Colombia'],           tip: 'Cherry blossom season begins in Japan' },
  2:  { label: 'March',     picks: ['Portugal', 'Vietnam', 'Peru'],           tip: 'Shoulder season gold — before the crowds arrive' },
  3:  { label: 'April',     picks: ['Japan', 'Italy', 'Nepal'],               tip: 'Ideal hiking weather in Nepal and Tuscany' },
  4:  { label: 'May',       picks: ['Greece', 'Georgia', 'Ireland'],          tip: 'Peak wildflower season before summer crowds' },
  5:  { label: 'June',      picks: ['Iceland', 'Norway', 'Albania'],          tip: 'Endless daylight in Scandinavia, the Balkans opening up' },
  6:  { label: 'July',      picks: ['Chile', 'Morocco', 'Oman'],              tip: 'Southern hemisphere winter is perfect for Patagonia' },
  7:  { label: 'August',    picks: ['Croatia', 'Slovenia', 'Colombia'],       tip: 'The Balkans are quieter than Italy this month' },
  8:  { label: 'September', picks: ['Bali', 'Nepal', 'Portugal'],             tip: 'Dry season returns to Southeast Asia — best month for Bali' },
  9:  { label: 'October',   picks: ['Japan', 'Vietnam', 'Ethiopia'],          tip: 'Autumn foliage in Japan, cool season in Vietnam' },
  10: { label: 'November',  picks: ['India', 'Tanzania', 'Peru'],             tip: 'Post-monsoon magic in India and East Africa' },
  11: { label: 'December',  picks: ['New Zealand', 'Colombia', 'Thailand'],   tip: 'Southern summer — New Zealand is at its absolute best' },
};

const navy = '#0a0f1e';
const navy2 = '#111827';
const navy3 = '#141d33';
const teal = '#00d4aa';
const tealGlow = 'rgba(0,212,170,0.12)';
const tealBorder = 'rgba(0,212,170,0.25)';
const border = 'rgba(255,255,255,0.08)';
const border2 = 'rgba(255,255,255,0.12)';
const w60 = 'rgba(255,255,255,0.6)';
const w40 = 'rgba(255,255,255,0.4)';
const w08 = 'rgba(255,255,255,0.06)';

function ThingPhoto({ name, keyword, style }) {
  const src = useDestinationPhoto(name || '', keyword || '', 'thumb');
  return <img src={src} alt={name} style={style} onError={e => { e.target.src = getFallbackPhoto('thumb'); }} />;
}

function CountryPhoto({ name, style }) {
  const src = useDestinationPhoto(name || '', '', 'card');
  return <img src={src} alt={name} style={style} loading="lazy" onError={e => { e.target.src = getFallbackPhoto('card'); }} />;
}

function PersonalRecCard({ rec, onClick }) {
  const src = useDestinationPhoto(rec.destination || '', '', 'card');
  return (
    <div onClick={onClick}
      style={{ borderRadius: 14, overflow: 'hidden', cursor: 'pointer', border: `1px solid ${border}`, background: navy3, transition: 'all 0.2s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = tealBorder; e.currentTarget.style.transform = 'translateY(-3px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.transform = 'none'; }}>
      <div style={{ height: 120, position: 'relative', overflow: 'hidden' }}>
        <img src={src} alt={rec.destination} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={e => { e.target.src = getFallbackPhoto('card'); }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,15,30,0.9), transparent 60%)' }} />
        <div style={{ position: 'absolute', bottom: 8, left: 12, fontSize: 14, fontWeight: 700, color: '#fff' }}>{rec.destination?.split(',')[0]}</div>
      </div>
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5, marginBottom: 8 }}>{rec.reason}</div>
        <div style={{ fontSize: 10, fontWeight: 700, color: teal }}>Plan this →</div>
      </div>
    </div>
  );
}

function TrendingCard({ t, onClick }) {
  const src = useDestinationPhoto(t.dest || '', '', 'card');
  return (
    <div
      onClick={onClick}
      style={{ borderRadius: 12, overflow: 'hidden', cursor: 'pointer', position: 'relative', aspectRatio: '3/2', transition: 'transform 0.3s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <img src={src} alt={t.dest} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" onError={e => { e.target.src = getFallbackPhoto('card'); }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,15,30,0.95) 0%, rgba(10,15,30,0.2) 60%, transparent 100%)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 14px' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginBottom: 3 }}>{t.dest}</div>
        <div style={{ fontSize: '0.7rem', color: teal, fontWeight: 600 }}>{t.trend}</div>
      </div>
      <div style={{ position: 'absolute', top: 10, right: 10, background: tealGlow, border: `1px solid ${tealBorder}`, borderRadius: 6, padding: '3px 8px', fontSize: '0.65rem', fontWeight: 700, color: teal }}>
        Plan this
      </div>
    </div>
  );
}

export default function ExplorePage() {
  const navigate = useNavigate();
  const [activeContinent, setActiveContinent] = useState('asia');
  const [activeCountry, setActiveCountry] = useState(null);
  const [apiTrending, setApiTrending]   = useState([]);
  const [apiCountries, setApiCountries] = useState({});
  const { currentUser, getIdToken } = useAuth();
  const [personalRecs, setPersonalRecs] = useState([]);
  const [countryInsights, setCountryInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [selectedPlaces, setSelectedPlaces] = useState(new Set());

  // Fetch trending destinations — uses /recommendations/trending (existing route)
  useEffect(() => {
    fetch(`${API_URL}/recommendations/trending`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.trending?.length) {
          setApiTrending(d.trending.map(t => ({
            dest: t.destination,
            img: getDestinationPhoto(t.destination, '', 'card'),
            trend: t.count ? `${t.count} travelers` : (t.badge || 'Trending'),
          })));
        }
      })
      .catch(() => { /* fall back to hardcoded TRENDING */ });
  }, []);

  // Continent data — hardcoded COUNTRIES is the source of truth (no API route exists for this)
  // apiCountries kept as state in case a future endpoint is added
  useEffect(() => {
    // Country grid uses hardcoded data — continent filter handled client-side
  }, [activeContinent]);

  // Personalised recommendations for logged-in users
  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      try {
        const token = await getIdToken();
        const res = await fetch(`${API_URL}/recommendations/personalised`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await res.json();
        if (d.recommendations?.length) setPersonalRecs(d.recommendations.slice(0, 4));
      } catch { /* graceful */ }
    })();
  }, [currentUser]);

  // Live destination insights when a country is expanded
  useEffect(() => {
    if (!activeCountry) { setCountryInsights(null); setInsightsLoading(false); setSelectedPlaces(new Set()); return; }
    setCountryInsights(null);
    setSelectedPlaces(new Set());
    setInsightsLoading(true);
    const start = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];
    const end   = new Date(Date.now() + 67 * 86400000).toISOString().split('T')[0];
    fetch(`${API_URL}/destination-insights?destination=${encodeURIComponent(activeCountry)}&startDate=${start}&endDate=${end}`)
      .then(r => r.json())
      .then(d => { if (d.insights) setCountryInsights(d.insights); })
      .catch(() => {})
      .finally(() => setInsightsLoading(false));
  }, [activeCountry]);

  const countries = COUNTRIES[activeContinent] || [];
  const country = activeCountry ? countries.find(c => c.name === activeCountry) : null;

  const handleContinent = (id) => {
    setActiveContinent(id);
    setActiveCountry(null);
  };

  const startPlan = (dest) => {
    // destinations must be an array of { name, lat, lng } for PlanTrip to pre-fill
    const destName = dest.split(',')[0].trim();
    navigate('/plan', { state: { prefill: { destinations: [{ name: destName, lat: 0, lng: 0 }] } } });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ background: navy, minHeight: '100vh', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#fff', margin: 0, padding: 0 }}>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .explore-tabs::-webkit-scrollbar { display: none; }
        @media (max-width: 768px) {
          .explore-nav-links { display: none !important; }
        }
        @media (max-width: 640px) {
          .explore-nav { padding: 0 1rem !important; }
          .explore-hero { padding: 2rem 1rem 1.5rem !important; }
          .explore-country-grid { grid-template-columns: 1fr !important; }
          .explore-trending-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Nav */}
      <nav className="explore-nav" style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2.5rem', background: navy2, borderBottom: `1px solid ${border}`, position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(20px)' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: navy }}>W</div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>WanderZenAI</span>
        </a>
        <div className="explore-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <a href="/" style={{ fontSize: 12, color: w40, textDecoration: 'none' }}>Home</a>
          <a href="/pricing" style={{ fontSize: 12, color: w40, textDecoration: 'none' }}>Pricing</a>
        </div>
        <button onClick={() => navigate('/plan')} style={{ background: teal, color: navy, border: 'none', padding: '7px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Plan my trip
        </button>
      </nav>

      {/* Page hero */}
      <div className="explore-hero" style={{ padding: '3rem 2rem 2rem', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: teal, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ width: 24, height: 1, background: teal, display: 'inline-block' }} />
          Explore destinations
        </div>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(2rem,5vw,3.5rem)', fontWeight: 700, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '0.75rem' }}>
          Find your next <span style={{ color: teal, fontStyle: 'italic' }}>slow travel</span> destination
        </h1>
        <p style={{ fontSize: '1rem', color: w40, lineHeight: 1.7, maxWidth: 560, marginBottom: '2rem' }}>
          Browse trending destinations and hidden gems across every continent. Click any place to instantly generate your personalised itinerary.
        </p>
      </div>

      {/* Seasonal context banner */}
      {(() => {
        const month = MONTH_PICKS[new Date().getMonth()];
        return (
          <div style={{ background: 'rgba(0,212,170,0.04)', borderTop: `1px solid ${border}`, borderBottom: `1px solid ${border}`, padding: '12px 2rem' }}>
            <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: teal, flexShrink: 0 }}>🗓 {month.label} picks</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', fontStyle: 'italic', flex: 1, minWidth: 200 }}>{month.tip}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {month.picks.map(p => (
                  <button key={p} type="button" onClick={() => startPlan(p)}
                    style={{ padding: '5px 12px', borderRadius: 20, background: tealGlow, border: `1px solid ${tealBorder}`, fontSize: 12, fontWeight: 700, color: teal, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Personalised for logged-in users */}
      {personalRecs.length > 0 && (
        <div style={{ padding: '3rem 2rem', borderBottom: `1px solid ${border}` }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: teal, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ width: 24, height: 1, background: teal, display: 'inline-block' }} />✦ Picked for you
            </div>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(1.25rem,2.5vw,1.75rem)', fontWeight: 700, color: '#fff', letterSpacing: '-0.03em', marginBottom: '1.25rem', lineHeight: 1.1 }}>
              Based on your travel history
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
              {personalRecs.map((rec, i) => (
                <PersonalRecCard key={i} rec={rec} onClick={() => startPlan(rec.destination)} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Trending */}
      <div style={{ padding: '0 2rem 4rem', borderBottom: `1px solid ${border}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: teal, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ width: 24, height: 1, background: teal, display: 'inline-block' }} />
                Trending now
              </div>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(1.5rem,3vw,2.25rem)', fontWeight: 700, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                Where slow travellers are going right now
              </h2>
            </div>
            <div style={{ fontSize: '0.8rem', color: w40, fontStyle: 'italic' }}>Updated weekly</div>
          </div>
          <div className="explore-trending-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {(apiTrending.length ? apiTrending : TRENDING).map(t => (
              <TrendingCard key={t.dest} t={t} onClick={() => startPlan(t.dest)} />
            ))}
          </div>
        </div>
      </div>

      {/* Continent browser */}
      <div style={{ padding: '4rem 2rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: teal, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ width: 24, height: 1, background: teal, display: 'inline-block' }} />
              Explore the world
            </div>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(1.5rem,3vw,2.25rem)', fontWeight: 700, color: '#fff', letterSpacing: '-0.03em', marginBottom: '0.5rem', lineHeight: 1.1 }}>
              Where do you want to <span style={{ color: teal, fontStyle: 'italic' }}>wander</span>?
            </h2>
            <p style={{ fontSize: '0.95rem', color: w40, lineHeight: 1.7 }}>Pick a region to see where locals actually go.</p>
          </div>

          {/* Continent tabs */}
          <div className="explore-tabs" style={{
            display: 'flex', gap: 8, marginBottom: '2rem',
            overflowX: 'auto', WebkitOverflowScrolling: 'touch',
            msOverflowStyle: 'none', scrollbarWidth: 'none',
          }}>
            {CONTINENTS.map(c => (
              <div
                key={c.id}
                onClick={() => handleContinent(c.id)}
                style={{
                  flexShrink: 0, whiteSpace: 'nowrap',
                  padding: '8px 16px', borderRadius: 100, cursor: 'pointer',
                  fontSize: '0.875rem', fontWeight: 600,
                  border: `1px solid ${activeContinent === c.id ? tealBorder : border}`,
                  background: activeContinent === c.id ? tealGlow : w08,
                  color: activeContinent === c.id ? teal : w40,
                  transition: 'all 0.2s',
                }}
              >
                {c.emoji} {c.name}
              </div>
            ))}
          </div>

          <div style={{ fontSize: '0.875rem', color: w40, fontStyle: 'italic', marginBottom: '1.5rem' }}>
            {CONTINENTS.find(c => c.id === activeContinent)?.tagline}
          </div>

          {/* Country grid */}
          <div className="explore-country-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: '1.5rem' }}>
            {countries.map(c => (
              <div
                key={c.name}
                onClick={() => setActiveCountry(activeCountry === c.name ? null : c.name)}
                style={{ borderRadius: 14, overflow: 'hidden', cursor: 'pointer', border: `1px solid ${activeCountry === c.name ? teal : border}`, background: navy3, transition: 'all 0.25s' }}
                onMouseEnter={e => { if (activeCountry !== c.name) e.currentTarget.style.borderColor = border2; }}
                onMouseLeave={e => { if (activeCountry !== c.name) e.currentTarget.style.borderColor = border; }}
              >
                <div style={{ position: 'relative', height: 160 }}>
                  <CountryPhoto name={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(20,29,51,1) 0%, rgba(20,29,51,0.1) 60%, transparent 100%)' }} />
                  <div style={{ position: 'absolute', top: 10, left: 12 }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(0,212,170,0.15)', color: teal, border: `1px solid ${tealBorder}`, letterSpacing: '0.08em' }}>
                      {c.tag}
                    </span>
                  </div>
                  <div style={{ position: 'absolute', bottom: 10, left: 12 }}>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: '1.2rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>{c.name}</div>
                  </div>
                </div>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: '0.85rem', color: w60, lineHeight: 1.6, marginBottom: 6 }}>{c.desc}</div>
                  <div style={{ fontSize: '0.75rem', color: w40 }}>
                    {c.places.slice(0, 3).join(' · ')}{c.places.length > 3 ? ` +${c.places.length - 3} more` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Destination Brief — unified panel with multi-select ── */}
          {country && (
            <div style={{ background: navy3, border: `1px solid ${teal}`, borderRadius: 16, padding: '1.75rem 2rem', marginBottom: '2rem', animation: 'fadeIn 0.3s ease' }}>

              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: '1.75rem', fontWeight: 700, color: '#fff', marginBottom: 5, letterSpacing: '-0.02em' }}>
                    {country.name}
                  </div>
                  {countryInsights?.seasonalHighlights && (
                    <div style={{ fontSize: '0.875rem', color: w40, fontStyle: 'italic', maxWidth: 400 }}>
                      {countryInsights.seasonalHighlights}
                    </div>
                  )}
                  {!countryInsights && !insightsLoading && (
                    <div style={{ fontSize: '0.875rem', color: w40, fontStyle: 'italic' }}>
                      {country.desc}
                    </div>
                  )}
                </div>
                <button onClick={() => startPlan(country.name)}
                  style={{ background: teal, color: navy, border: 'none', padding: '10px 22px', borderRadius: 10, fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap' }}>
                  Plan {country.name} trip
                </button>
              </div>

              {/* Insight badges */}
              {insightsLoading && !countryInsights && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '8px 12px', background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.15)', borderRadius: 8 }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(0,212,170,0.3)', borderTopColor: '#00d4aa', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'rgba(0,212,170,0.8)' }}>Loading destination insights…</span>
                </div>
              )}
              {countryInsights && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                  {countryInsights.weather && <span style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)', fontSize: 11, fontWeight: 700, color: '#60a5fa' }}>☀️ {countryInsights.weather.split(/[,(]/)[0].trim()}</span>}
                  {countryInsights.crowdLevel && <span style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(255,217,61,0.08)', border: '1px solid rgba(255,217,61,0.2)', fontSize: 11, fontWeight: 700, color: '#ffd93d' }}>👥 {countryInsights.crowdLevel} crowds</span>}
                  {countryInsights.bestMonths?.slice(0, 2).length > 0 && <span style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)', fontSize: 11, fontWeight: 700, color: teal }}>🗓 Best: {countryInsights.bestMonths.slice(0, 2).join(' & ')}</span>}
                </div>
              )}

              {/* AI experience cards — selectable */}
              {countryInsights?.thingsToDo?.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>
                    Select experiences — tap to add to your trip
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {countryInsights.thingsToDo.slice(0, 3).map((thing) => {
                      const isSelected = selectedPlaces.has(thing.name);
                      return (
                        <div
                          key={thing.name}
                          onClick={() => setSelectedPlaces(prev => { const s = new Set(prev); s.has(thing.name) ? s.delete(thing.name) : s.add(thing.name); return s; })}
                          style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', background: isSelected ? 'rgba(0,212,170,0.07)' : 'rgba(255,255,255,0.03)', border: `1.5px solid ${isSelected ? teal : border}`, borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s' }}
                        >
                          <div style={{ width: 64, height: 64, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
                            <ThingPhoto name={thing.name} keyword={thing.unsplashKeyword} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{thing.emoji} {thing.name}</div>
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4, marginBottom: thing.visitorTip ? 5 : 0 }}>{thing.reason}</div>
                            {thing.visitorTip && (
                              <div style={{ fontSize: 11, color: teal, display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                                <span style={{ flexShrink: 0 }}>💡</span><span>{thing.visitorTip}</span>
                              </div>
                            )}
                          </div>
                          <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 3, border: `2px solid ${isSelected ? teal : 'rgba(255,255,255,0.2)'}`, background: isSelected ? teal : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                            {isSelected && <span style={{ color: '#0a0f1e', fontSize: 12, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Budget teaser */}
              {countryInsights?.budgetEstimateUSD && (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 12, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${border}`, borderRadius: 8 }}>
                  💰 Est. <strong style={{ color: 'rgba(255,255,255,0.6)' }}>${countryInsights.budgetEstimateUSD.flightsLow}–${countryInsights.budgetEstimateUSD.flightsHigh}</strong> flights · <strong style={{ color: 'rgba(255,255,255,0.6)' }}>${countryInsights.budgetEstimateUSD.accommodationPerNightLow}–${countryInsights.budgetEstimateUSD.accommodationPerNightHigh}/night</strong> stays
                </div>
              )}

              {/* Travel tip */}
              {countryInsights?.travelTip && (
                <div style={{ fontSize: 12, color: 'rgba(0,212,170,0.85)', marginBottom: 18, padding: '8px 12px', background: 'rgba(0,212,170,0.04)', border: '1px solid rgba(0,212,170,0.18)', borderRadius: 8 }}>
                  ✦ {countryInsights.travelTip}
                </div>
              )}

              {/* Region pills — selectable */}
              <div style={{ marginBottom: selectedPlaces.size > 0 ? 14 : 0 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>
                  Or pick a region
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {country.places.map((place) => {
                    const isSelected = selectedPlaces.has(place);
                    return (
                      <button key={place} type="button"
                        onClick={() => setSelectedPlaces(prev => { const s = new Set(prev); s.has(place) ? s.delete(place) : s.add(place); return s; })}
                        style={{ padding: '6px 14px', borderRadius: 20, fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', border: `1px solid ${isSelected ? teal : 'rgba(255,255,255,0.15)'}`, background: isSelected ? 'rgba(0,212,170,0.12)' : 'rgba(255,255,255,0.04)', color: isSelected ? teal : w60 }}>
                        {isSelected && '✓ '}{place}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Plan bar — appears when items are selected */}
              {selectedPlaces.size > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', background: 'linear-gradient(135deg,rgba(0,212,170,0.12),rgba(0,212,170,0.06))', border: '1px solid rgba(0,212,170,0.3)', borderRadius: 12, marginTop: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 13, color: '#fff', minWidth: 0 }}>
                    <span style={{ fontWeight: 800, color: teal }}>{selectedPlaces.size}</span>
                    <span style={{ color: 'rgba(255,255,255,0.5)', marginLeft: 6 }}>{selectedPlaces.size === 1 ? 'stop' : 'stops'} selected</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginLeft: 8, wordBreak: 'break-word' }}>{[...selectedPlaces].join(' · ')}</span>
                  </div>
                  <button type="button"
                    onClick={() => {
                      const destinations = [...selectedPlaces].map(name => ({ name, lat: 0, lng: 0 }));
                      navigate('/plan', { state: { prefill: { destinations } } });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    style={{ padding: '10px 22px', background: '#00d4aa', border: 'none', borderRadius: 10, color: '#0a0f1e', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    Plan {selectedPlaces.size} {selectedPlaces.size === 1 ? 'stop' : 'stops'} →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Bottom CTA */}
          <div style={{ textAlign: 'center', padding: '2rem 0 1rem', borderTop: `1px solid ${border}` }}>
            <div style={{ fontSize: '0.875rem', color: w40, marginBottom: '1.25rem', fontStyle: 'italic' }}>
              Don't see your destination? We cover every country in the world.
            </div>
            <button
              onClick={() => navigate('/plan')}
              style={{ background: teal, color: navy, border: 'none', padding: '12px 28px', borderRadius: 12, fontSize: '1rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Plan any destination — free
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${border}`, padding: '2rem 2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.25)' }}>© 2025 WanderZenAI · Built for slow travellers</div>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <a href="/" style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Home</a>
          <a href="/pricing" style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Pricing</a>
          <a href="/agency" style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>For agencies</a>
          <a href="mailto:travel@wanderzenai.com" style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Contact</a>
        </div>
      </div>
    </div>
  );
}
