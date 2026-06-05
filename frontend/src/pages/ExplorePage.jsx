import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL;
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDestinationPhoto, getFallbackPhoto } from '../utils/destinationPhotos';

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
    { name: 'Japan', img: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=400&h=280&fit=crop', tag: 'Slow travel favourite', desc: 'Backstreet Kyoto, mountain onsen towns, morning fish markets', places: ['Kyoto', 'Kanazawa', 'Yakushima', 'Naoshima', 'Takayama'] },
    { name: 'Vietnam', img: 'https://images.unsplash.com/photo-1528127269322-539801943592?w=400&h=280&fit=crop', tag: 'Hidden gem', desc: 'Mekong villages, limestone karsts, lantern-lit old towns', places: ['Hoi An', 'Ha Giang', 'Ninh Binh', 'Phong Nha', 'Mui Ne'] },
    { name: 'India', img: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=400&h=280&fit=crop', tag: 'Cultural depth', desc: 'Rajasthani villages, spice routes, Himalayan trails', places: ['Varanasi', 'Hampi', 'Coorg', 'Spiti Valley', 'Pondicherry'] },
    { name: 'Sri Lanka', img: 'https://images.unsplash.com/photo-1553526665-dbfe31a25a55?w=400&h=280&fit=crop', tag: 'Rising star', desc: 'Tea plantation stays, whale watching, ancient rock temples', places: ['Ella', 'Galle', 'Sigiriya', 'Trincomalee', 'Kandy'] },
    { name: 'Indonesia', img: 'https://images.unsplash.com/photo-1539635278303-d4002c07eae3?w=400&h=280&fit=crop', tag: 'Nature first', desc: 'Rice terrace villages, volcano hikes, surf towns', places: ['Ubud', 'Lombok', 'Flores', 'Nusa Penida', 'Sumba'] },
    { name: 'Georgia', img: 'https://images.unsplash.com/photo-1601974984960-4e1d498e3b2f?w=400&h=280&fit=crop', tag: 'Undiscovered', desc: 'Wine country, Caucasus peaks, ancient cave cities', places: ['Tbilisi', 'Mestia', 'Sighnaghi', 'Kazbegi', 'Uplistsikhe'] },
  ],
  europe: [
    { name: 'Italy', img: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=400&h=280&fit=crop', tag: 'Slow travel icon', desc: 'Puglia farmhouses, Dolomite villages, Sicilian markets', places: ['Matera', 'Alberobello', 'Orvieto', 'Noto', 'Civita di Bagnoregio'] },
    { name: 'Portugal', img: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=400&h=280&fit=crop', tag: 'Crowd free', desc: 'Alentejo plains, fishing villages, azulejo-tiled towns', places: ['Evora', 'Obidos', 'Monsanto', 'Tavira', 'Peneda-Geres'] },
    { name: 'Slovenia', img: 'https://images.unsplash.com/photo-1587974928442-77dc3e0dba72?w=400&h=280&fit=crop', tag: 'Hidden gem', desc: 'Alpine lakes, karst caves, wine villages', places: ['Lake Bled', 'Piran', 'Soca Valley', 'Skocjan', 'Ptuj'] },
    { name: 'Greece', img: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=400&h=280&fit=crop', tag: 'Beyond the islands', desc: 'Mainland villages, Zagori trails, off-island life', places: ['Meteora', 'Zagori', 'Monemvasia', 'Pelion', 'Naxos'] },
    { name: 'Croatia', img: 'https://images.unsplash.com/photo-1555990793-da11153b2473?w=400&h=280&fit=crop', tag: 'Coastal magic', desc: 'Dalmatian islands, walled towns, olive grove trails', places: ['Hvar', 'Vis', 'Plitvice', 'Rovinj', 'Korcula'] },
    { name: 'Albania', img: 'https://images.unsplash.com/photo-1598300058816-b7cef6d4c90c?w=400&h=280&fit=crop', tag: 'Undiscovered', desc: 'Ottoman bazaars, Riviera bays, mountain villages', places: ['Berat', 'Gjirokaster', 'Theth', 'Ksamil', 'Valbona'] },
  ],
  africa: [
    { name: 'Morocco', img: 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=400&h=280&fit=crop', tag: 'Sensory overload', desc: 'Mountain Berber villages, Sahara camps, blue medinas', places: ['Chefchaouen', 'Merzouga', 'Essaouira', 'Ait Benhaddou', 'Imlil'] },
    { name: 'Ethiopia', img: 'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=400&h=280&fit=crop', tag: 'Ancient world', desc: 'Rock-hewn churches, tribal cultures, coffee origins', places: ['Lalibela', 'Omo Valley', 'Simien Mountains', 'Axum', 'Harar'] },
    { name: 'Tanzania', img: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=400&h=280&fit=crop', tag: 'Wildlife + culture', desc: 'Maasai villages, spice islands, remote beaches', places: ['Zanzibar', 'Ngorongoro', 'Pemba Island', 'Usambara', 'Stone Town'] },
    { name: 'Rwanda', img: 'https://images.unsplash.com/photo-1611348524140-53c9a25263d6?w=400&h=280&fit=crop', tag: 'Rising star', desc: 'Gorilla trekking, tea plantations, Lake Kivu villages', places: ['Volcanoes NP', 'Lake Kivu', 'Nyungwe', 'Musanze', 'Akagera'] },
  ],
  americas: [
    { name: 'Mexico', img: 'https://images.unsplash.com/photo-1518638150340-f706e86654de?w=400&h=280&fit=crop', tag: 'Beyond the resorts', desc: 'Colonial highland towns, cenote villages, Pacific coast', places: ['Oaxaca', 'San Cristobal', 'Guanajuato', 'Bacalar', 'Merida'] },
    { name: 'Colombia', img: 'https://images.unsplash.com/photo-1576019280693-5a56c25d8dc6?w=400&h=280&fit=crop', tag: 'Transformation story', desc: 'Coffee region fincas, Caribbean coast, flower towns', places: ['Salento', 'Cartagena', 'Barichara', 'Palomino', 'Villa de Leyva'] },
    { name: 'Peru', img: 'https://images.unsplash.com/photo-1526392060635-9d6019884377?w=400&h=280&fit=crop', tag: 'Beyond Machu Picchu', desc: 'Amazon villages, Lake Titicaca islands, Sacred Valley', places: ['Cusco', 'Huaraz', 'Chachapoyas', 'Colca Canyon', 'Pisac'] },
    { name: 'Chile', img: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&h=280&fit=crop', tag: 'End of the world', desc: 'Patagonia trails, lake district towns, Atacama villages', places: ['Torres del Paine', 'Chiloe', 'Pucon', 'Valle de Elqui', 'Punta Arenas'] },
  ],
  oceania: [
    { name: 'New Zealand', img: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400&h=280&fit=crop', tag: 'Nature paradise', desc: 'Fiordland walks, Maori culture, remote farmstays', places: ['Queenstown', 'Abel Tasman', 'Rotorua', 'Coromandel', 'Milford Sound'] },
    { name: 'Australia', img: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=280&fit=crop', tag: 'Beyond the cities', desc: 'Outback stations, Cape York, Kimberley gorges', places: ['Blue Mountains', 'Margaret River', 'Daintree', 'Flinders Ranges', 'Byron Bay'] },
    { name: 'Fiji', img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=280&fit=crop', tag: 'Village life', desc: 'Off-grid island villages, coral reefs, local kava ceremonies', places: ['Yasawa Islands', 'Taveuni', 'Kadavu', 'Vanua Levu', 'Beqa'] },
  ],
  mideast: [
    { name: 'Jordan', img: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400&h=280&fit=crop', tag: 'Ancient wonder', desc: 'Rose-red Petra, Wadi Rum camps, Dead Sea shores', places: ['Petra', 'Wadi Rum', 'Aqaba', 'Wadi Mujib', 'Dana Reserve'] },
    { name: 'Oman', img: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=280&fit=crop', tag: 'Underrated gem', desc: 'Wadis, frankincense towns, dhow sailing, Bedouin camps', places: ['Muscat', 'Salalah', 'Nizwa', 'Wahiba Sands', 'Jebel Akhdar'] },
  ],
};

const TRENDING = [
  { dest: 'Kyoto, Japan', img: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=300&h=200&fit=crop', trend: '+34% this month' },
  { dest: 'Oaxaca, Mexico', img: 'https://images.unsplash.com/photo-1518638150340-f706e86654de?w=300&h=200&fit=crop', trend: '+28% this month' },
  { dest: 'Bali, Indonesia', img: 'https://images.unsplash.com/photo-1539635278303-d4002c07eae3?w=300&h=200&fit=crop', trend: '+22% this month' },
  { dest: 'Tbilisi, Georgia', img: 'https://images.unsplash.com/photo-1601974984960-4e1d498e3b2f?w=300&h=200&fit=crop', trend: '+41% this month' },
  { dest: 'Matera, Italy', img: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=300&h=200&fit=crop', trend: '+19% this month' },
  { dest: 'Chefchaouen, Morocco', img: 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=300&h=200&fit=crop', trend: '+31% this month' },
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

export default function ExplorePage() {
  const navigate = useNavigate();
  const [activeContinent, setActiveContinent] = useState('asia');
  const [activeCountry, setActiveCountry] = useState(null);
  const [apiTrending, setApiTrending]   = useState([]);
  const [apiCountries, setApiCountries] = useState({});
  const { currentUser, getIdToken } = useAuth();
  const [personalRecs, setPersonalRecs] = useState([]);
  const [countryInsights, setCountryInsights] = useState(null);

  // Fetch recommendations from API — falls back to hardcoded data if unavailable
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const res  = await fetch(`${API_URL}/recommendations?limit=6`);
        const data = await res.json();
        if (data.data?.destinations?.length) {
          setApiTrending(data.data.destinations.slice(0, 6));
        }
      } catch { /* use hardcoded fallback */ }
    };
    fetchAll();
  }, []);

  useEffect(() => {
    const fetchContinent = async () => {
      try {
        const res  = await fetch(`${API_URL}/recommendations?continent=${activeContinent}&limit=12`);
        const data = await res.json();
        if (data.data?.destinations?.length) {
          setApiCountries(prev => ({ ...prev, [activeContinent]: data.data.destinations }));
        }
      } catch { /* use hardcoded fallback */ }
    };
    if (!apiCountries[activeContinent]) fetchContinent();
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
    if (!activeCountry) { setCountryInsights(null); return; }
    const start = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];
    const end   = new Date(Date.now() + 67 * 86400000).toISOString().split('T')[0];
    fetch(`${API_URL}/destination-insights?destination=${encodeURIComponent(activeCountry)}&startDate=${start}&endDate=${end}`)
      .then(r => r.json())
      .then(d => { if (d.insights) setCountryInsights(d.insights); })
      .catch(() => {});
  }, [activeCountry]);

  const countries = COUNTRIES[activeContinent] || [];
  const country = activeCountry ? countries.find(c => c.name === activeCountry) : null;

  const handleContinent = (id) => {
    setActiveContinent(id);
    setActiveCountry(null);
  };

  const startPlan = (dest) => {
    navigate('/plan', { state: { prefill: { destination: dest } } });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ background: navy, minHeight: '100vh', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#fff', margin: 0, padding: 0 }}>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
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
                <div key={i} onClick={() => startPlan(rec.destination)}
                  style={{ borderRadius: 14, overflow: 'hidden', cursor: 'pointer', border: `1px solid ${border}`, background: navy3, transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = tealBorder; e.currentTarget.style.transform = 'translateY(-3px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.transform = 'none'; }}>
                  <div style={{ height: 120, position: 'relative', overflow: 'hidden' }}>
                    <img src={getDestinationPhoto(rec.destination || '', '', 'card')} alt={rec.destination}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      onError={e => { e.target.src = getFallbackPhoto('card'); }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,15,30,0.9), transparent 60%)' }} />
                    <div style={{ position: 'absolute', bottom: 8, left: 12, fontSize: 14, fontWeight: 700, color: '#fff' }}>{rec.destination?.split(',')[0]}</div>
                  </div>
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5, marginBottom: 8 }}>{rec.reason}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: teal }}>Plan this →</div>
                  </div>
                </div>
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
            {(apiTrending.length ? apiTrending.map(t => ({ dest: t.destination + (t.country ? `, ${t.country}` : ''), img: t.image_url || getDestinationPhoto(t.destination || '', '', 'card'), trend: t.count ? `${t.count} travelers` : 'Trending' })) : TRENDING).map(t => (
              <div
                key={t.dest}
                onClick={() => startPlan(t.dest)}
                style={{ borderRadius: 12, overflow: 'hidden', cursor: 'pointer', position: 'relative', aspectRatio: '3/2', transition: 'transform 0.3s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <img src={t.img || getDestinationPhoto(t.dest, '', 'card')} alt={t.dest} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" onError={e => { e.target.src = getFallbackPhoto('card'); }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,15,30,0.95) 0%, rgba(10,15,30,0.2) 60%, transparent 100%)' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 14px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginBottom: 3 }}>{t.dest}</div>
                  <div style={{ fontSize: '0.7rem', color: teal, fontWeight: 600 }}>{t.trend}</div>
                </div>
                <div style={{ position: 'absolute', top: 10, right: 10, background: tealGlow, border: `1px solid ${tealBorder}`, borderRadius: 6, padding: '3px 8px', fontSize: '0.65rem', fontWeight: 700, color: teal }}>
                  Plan this
                </div>
              </div>
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
                  <img src={c.img} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
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

          {/* Expanded country detail */}
          {country && (
            <div style={{ background: navy3, border: `1px solid ${teal}`, borderRadius: 16, padding: '1.75rem 2rem', marginBottom: '2rem', animation: 'fadeIn 0.3s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: '1.5rem', fontWeight: 700, color: '#fff', marginBottom: 6, letterSpacing: '-0.02em' }}>
                    Top places in {country.name}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: w40, fontStyle: 'italic' }}>
                    Our top slow-travel picks — hidden from the usual guidebooks
                  </div>
                </div>
                <button
                  onClick={() => startPlan(country.name)}
                  style={{ background: teal, color: navy, border: 'none', padding: '10px 22px', borderRadius: 10, fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap' }}
                >
                  Plan {country.name} trip
                </button>
              </div>
              {countryInsights && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                  {countryInsights.weather && <span style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)', fontSize: 11, fontWeight: 700, color: '#60a5fa' }}>☀️ {countryInsights.weather.split(/[,(]/)[0].trim()}</span>}
                  {countryInsights.crowdLevel && <span style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(255,217,61,0.08)', border: '1px solid rgba(255,217,61,0.2)', fontSize: 11, fontWeight: 700, color: '#ffd93d' }}>👥 {countryInsights.crowdLevel} crowds</span>}
                  {countryInsights.bestMonths?.slice(0, 2).length > 0 && <span style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)', fontSize: 11, fontWeight: 700, color: teal }}>🗓 Best: {countryInsights.bestMonths.slice(0, 2).join(' & ')}</span>}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: countryInsights?.thingsToDo?.length ? 16 : 0 }}>
                {country.places.map((place) => (
                  <div key={place} onClick={() => startPlan(`${place}, ${country.name}`)}
                    style={{ borderRadius: 12, overflow: 'hidden', cursor: 'pointer', border: `1px solid ${border}`, transition: 'all 0.2s', position: 'relative', aspectRatio: '4/3' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = teal; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.transform = 'none'; }}>
                    <img src={getDestinationPhoto(`${place}, ${country.name}`, place.toLowerCase(), 'thumb')} alt={place} loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      onError={e => { e.target.src = getFallbackPhoto('thumb'); }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,15,30,0.9) 0%, rgba(10,15,30,0.1) 60%, transparent 100%)' }} />
                    <div style={{ position: 'absolute', bottom: 8, left: 10, right: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{place}</div>
                      <div style={{ fontSize: 10, color: teal, marginTop: 2 }}>Plan this →</div>
                    </div>
                  </div>
                ))}
              </div>
              {countryInsights?.thingsToDo?.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>AI curated experiences</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {countryInsights.thingsToDo.slice(0, 3).map((thing, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${border}`, borderRadius: 10 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                          <img src={getDestinationPhoto(thing.name || '', thing.unsplashKeyword || '', 'thumb')} alt={thing.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            onError={e => { e.target.src = getFallbackPhoto('thumb'); }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{thing.emoji} {thing.name}</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{thing.reason}</div>
                        </div>
                        {thing.openingHours && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', flexShrink: 0, paddingTop: 2 }}>🕐 {thing.openingHours.split(',')[0]}</div>}
                      </div>
                    ))}
                  </div>
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
