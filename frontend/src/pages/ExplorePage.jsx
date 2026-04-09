import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Fraunces:ital,opsz,wght@0,9..144,600;0,9..144,700;1,9..144,400&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0f1e; }
`;

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
    { name: 'Portugal', img: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=400&h=280&fit=crop', tag: 'Crowd free', desc: 'Alentejo plains, fishing villages, azulejo-tiled towns', places: ['Évora', 'Óbidos', 'Monsanto', 'Tavira', 'Peneda-Gerês'] },
    { name: 'Slovenia', img: 'https://images.unsplash.com/photo-1587974928442-77dc3e0dba72?w=400&h=280&fit=crop', tag: 'Hidden gem', desc: 'Alpine lakes, karst caves, wine villages', places: ['Lake Bled', 'Piran', 'Soča Valley', 'Škocjan', 'Ptuj'] },
    { name: 'Greece', img: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=400&h=280&fit=crop', tag: 'Beyond the islands', desc: 'Mainland villages, Zagori trails, off-island life', places: ['Meteora', 'Zagori', 'Monemvasia', 'Pelion', 'Naxos'] },
    { name: 'Croatia', img: 'https://images.unsplash.com/photo-1555990793-da11153b2473?w=400&h=280&fit=crop', tag: 'Coastal magic', desc: 'Dalmatian islands, walled towns, olive grove trails', places: ['Hvar', 'Vis', 'Plitvice', 'Rovinj', 'Korčula'] },
    { name: 'Albania', img: 'https://images.unsplash.com/photo-1598300058816-b7cef6d4c90c?w=400&h=280&fit=crop', tag: 'Undiscovered', desc: 'Ottoman bazaars, Riviera bays, mountain villages', places: ['Berat', 'Gjirokastër', 'Theth', 'Ksamil', 'Valbona'] },
  ],
  africa: [
    { name: 'Morocco', img: 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=400&h=280&fit=crop', tag: 'Sensory overload', desc: 'Mountain Berber villages, Sahara camps, blue medinas', places: ['Chefchaouen', 'Merzouga', 'Essaouira', 'Aït Benhaddou', 'Imlil'] },
    { name: 'Ethiopia', img: 'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=400&h=280&fit=crop', tag: 'Ancient world', desc: 'Rock-hewn churches, tribal cultures, coffee origins', places: ['Lalibela', 'Omo Valley', 'Simien Mountains', 'Axum', 'Harar'] },
    { name: 'Tanzania', img: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=400&h=280&fit=crop', tag: 'Wildlife + culture', desc: 'Maasai villages, spice islands, remote beaches', places: ['Zanzibar', 'Ngorongoro', 'Pemba Island', 'Usambara', 'Stone Town'] },
    { name: 'Rwanda', img: 'https://images.unsplash.com/photo-1611348524140-53c9a25263d6?w=400&h=280&fit=crop', tag: 'Rising star', desc: 'Gorilla trekking, tea plantations, Lake Kivu villages', places: ['Volcanoes NP', 'Lake Kivu', 'Nyungwe', 'Musanze', 'Akagera'] },
  ],
  americas: [
    { name: 'Mexico', img: 'https://images.unsplash.com/photo-1518638150340-f706e86654de?w=400&h=280&fit=crop', tag: 'Beyond the resorts', desc: 'Colonial highland towns, cenote villages, Pacific coast', places: ['Oaxaca', 'San Cristóbal', 'Guanajuato', 'Bacalar', 'Mérida'] },
    { name: 'Colombia', img: 'https://images.unsplash.com/photo-1576019280693-5a56c25d8dc6?w=400&h=280&fit=crop', tag: 'Transformation story', desc: 'Coffee region fincas, Caribbean coast, flower towns', places: ['Salento', 'Cartagena', 'Barichara', 'Palomino', 'Villa de Leyva'] },
    { name: 'Peru', img: 'https://images.unsplash.com/photo-1526392060635-9d6019884377?w=400&h=280&fit=crop', tag: 'Beyond Machu Picchu', desc: 'Amazon villages, Lake Titicaca islands, Sacred Valley', places: ['Cusco', 'Huaraz', 'Chachapoyas', 'Colca Canyon', 'Pisac'] },
    { name: 'Chile', img: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&h=280&fit=crop', tag: 'End of the world', desc: 'Patagonia trails, lake district towns, Atacama villages', places: ['Torres del Paine', 'Chiloé', 'Pucón', 'Valle de Elqui', 'Punta Arenas'] },
  ],
  oceania: [
    { name: 'New Zealand', img: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400&h=280&fit=crop', tag: 'Nature paradise', desc: 'Fiordland walks, Māori culture, remote farmstays', places: ['Queenstown', 'Abel Tasman', 'Rotorua', 'Coromandel', 'Milford Sound'] },
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

const v = {
  navy: '#0a0f1e', navy2: '#111827', navy3: '#141d33',
  teal: '#00d4aa', tealGlow: 'rgba(0,212,170,0.12)', tealBorder: 'rgba(0,212,170,0.25)',
  coral: '#ff6b6b', gold: '#ffd93d',
  border: 'rgba(255,255,255,0.08)', border2: 'rgba(255,255,255,0.12)',
  w90: 'rgba(255,255,255,0.9)', w60: 'rgba(255,255,255,0.6)',
  w40: 'rgba(255,255,255,0.4)', w08: 'rgba(255,255,255,0.06)',
};

export default function ExplorePage() {
  const navigate = useNavigate();
  const [activeContinent, setActiveContinent] = useState('asia');
  const [activeCountry, setActiveCountry] = useState(null);
  const countries = COUNTRIES[activeContinent] || [];
  const country = activeCountry && countries.find(c => c.name === activeCountry);

  const handleContinentChange = (id) => {
    setActiveContinent(id);
    setActiveCountry(null);
  };

  const startPlan = (dest) => {
    navigate('/plan', { state: { prefill: { destination: dest } } });
  };

  return (
    <div style={{ background: v.navy, minHeight: '100vh', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>{css}</style>

      {/* Nav */}
      <nav style={{ height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2.5rem', background: v.navy2, borderBottom: `1px solid ${v.border}`, position: 'sticky', top: 0, zIndex: 100 }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: v.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: v.navy }}>W</div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>WanderZenAI</span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <a href="/" style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>Home</a>
          <a href="/pricing" style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>Pricing</a>
          <button onClick={() => navigate('/plan')} style={{ background: v.teal, color: v.navy, border: 'none', padding: '7px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Plan my trip
          </button>
        </div>
      </nav>

      {/* Hero bar */}
      <div style={{ padding: '3rem 2rem 0', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: v.teal, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ width: 24, height: 1, background: v.teal, display: 'inline-block' }} />
          Explore destinations
        </div>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(2rem,5vw,3.5rem)', fontWeight: 700, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '1rem' }}>
          Find your next<br /><span style={{ color: v.teal, fontStyle: 'italic' }}>slow travel</span> destination
        </h1>
        <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, maxWidth: 560, marginBottom: '2rem' }}>
          Browse trending destinations and hidden gems across every continent. Click any place to instantly generate your personalised itinerary.
        </p>
      </div>

      <div style={{ background: v.navy2, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── Trending now ── */}
      <section style={{ padding: '5rem 2rem 3rem', borderBottom: `1px solid ${v.border}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: v.teal, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ width: 24, height: 1, background: v.teal, display: 'inline-block' }} />
                Trending now
              </div>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(1.75rem,4vw,2.75rem)', fontWeight: 700, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                Where slow travellers<br />are going right now
              </h2>
            </div>
            <div style={{ fontSize: '0.875rem', color: v.w40, fontStyle: 'italic' }}>Updated weekly based on itinerary requests</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {TRENDING.map((t) => (
              <div
                key={t.dest}
                onClick={() => startPlan(t.dest)}
                style={{ borderRadius: 12, overflow: 'hidden', cursor: 'pointer', position: 'relative', aspectRatio: '3/2', transition: 'transform 0.3s' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <img src={t.img} alt={t.dest} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,15,30,0.95) 0%, rgba(10,15,30,0.2) 60%, transparent 100%)' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 14px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginBottom: 3 }}>{t.dest}</div>
                  <div style={{ fontSize: '0.7rem', color: v.teal, fontWeight: 600 }}>{t.trend}</div>
                </div>
                <div style={{ position: 'absolute', top: 10, right: 10, background: v.tealGlow, border: `1px solid ${v.tealBorder}`, borderRadius: 6, padding: '3px 8px', fontSize: '0.65rem', fontWeight: 700, color: v.teal, backdropFilter: 'blur(8px)' }}>
                  Plan this →
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Explore by continent ── */}
      <section style={{ padding: '5rem 2rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ marginBottom: '2.5rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: v.teal, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ width: 24, height: 1, background: v.teal, display: 'inline-block' }} />
              Explore the world
            </div>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(1.75rem,4vw,2.75rem)', fontWeight: 700, color: '#fff', letterSpacing: '-0.03em', marginBottom: '0.5rem', lineHeight: 1.1 }}>
              Where do you want<br />to <span style={{ color: v.teal, fontStyle: 'italic' }}>wander</span>?
            </h2>
            <p style={{ fontSize: '1rem', color: v.w40, lineHeight: 1.7 }}>Pick a region — we'll show you where locals actually go, not where the guidebooks send you.</p>
          </div>

          {/* Continent tabs */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '2.5rem' }}>
            {CONTINENTS.map(c => (
              <button
                key={c.id}
                onClick={() => handleContinentChange(c.id)}
                style={{
                  padding: '8px 18px', borderRadius: 100, border: `1px solid ${activeContinent === c.id ? v.teal : v.border}`,
                  background: activeContinent === c.id ? v.tealGlow : 'transparent',
                  color: activeContinent === c.id ? v.teal : v.w60,
                  fontSize: '0.875rem', fontWeight: activeContinent === c.id ? 700 : 400,
                  cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif",
                  transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <span style={{ fontSize: 14 }}>{c.emoji}</span>
                {c.name}
              </button>
            ))}
          </div>

          {/* Continent tagline */}
          <div style={{ fontSize: '0.9rem', color: v.w40, fontStyle: 'italic', marginBottom: '1.75rem' }}>
            {CONTINENTS.find(c => c.id === activeContinent)?.tagline}
          </div>

          {/* Country grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: '2rem' }}>
            {countries.map(c => (
              <div
                key={c.name}
                onClick={() => setActiveCountry(activeCountry === c.name ? null : c.name)}
                style={{
                  borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
                  border: `1px solid ${activeCountry === c.name ? v.teal : v.border}`,
                  background: v.navy3, transition: 'all 0.25s',
                }}
                onMouseEnter={e => { if (activeCountry !== c.name) e.currentTarget.style.borderColor = v.border2; }}
                onMouseLeave={e => { if (activeCountry !== c.name) e.currentTarget.style.borderColor = v.border; }}
              >
                <div style={{ position: 'relative', height: 160 }}>
                  <img src={c.img} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(20,29,51,1) 0%, rgba(20,29,51,0.1) 60%, transparent 100%)' }} />
                  <div style={{ position: 'absolute', top: 10, left: 12 }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(0,212,170,0.15)', color: v.teal, border: `1px solid ${v.tealBorder}`, letterSpacing: '0.08em' }}>
                      {c.tag}
                    </span>
                  </div>
                  <div style={{ position: 'absolute', bottom: 10, left: 12 }}>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: '1.2rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>{c.name}</div>
                  </div>
                </div>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: '0.85rem', color: v.w60, lineHeight: 1.6, marginBottom: 8 }}>{c.desc}</div>
                  <div style={{ fontSize: '0.75rem', color: v.w40 }}>
                    {c.places.slice(0, 3).join(' · ')} {c.places.length > 3 && `+${c.places.length - 3} more`}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Expanded country detail */}
          {country && (
            <div style={{
              background: v.navy3, border: `1px solid ${v.teal}`, borderRadius: 16,
              padding: '1.75rem 2rem', marginBottom: '2rem',
              animation: 'fadeIn 0.3s ease',
            }}>
              <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: '1.5rem', fontWeight: 700, color: '#fff', marginBottom: 6, letterSpacing: '-0.02em' }}>
                    Top places in {country.name}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: v.w40, fontStyle: 'italic' }}>
                    Our top slow-travel picks — hidden from the usual guidebooks
                  </div>
                </div>
                <button
                  onClick={() => startPlan(country.name)}
                  style={{ background: v.teal, color: v.navy, border: 'none', padding: '10px 22px', borderRadius: 10, fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: 'nowrap' }}
                >
                  Plan {country.name} trip →
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                {country.places.map((place, i) => (
                  <div
                    key={place}
                    onClick={() => startPlan(`${place}, ${country.name}`)}
                    style={{
                      background: v.w08, border: `1px solid ${v.border}`,
                      borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
                      transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 10,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = v.tealBorder; e.currentTarget.style.background = v.tealGlow; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = v.border; e.currentTarget.style.background = v.w08; }}
                  >
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: v.tealGlow, border: `1px solid ${v.tealBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, color: v.teal, flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fff', marginBottom: 2 }}>{place}</div>
                      <div style={{ fontSize: '0.7rem', color: v.teal }}>Plan this →</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom CTA */}
          <div style={{ textAlign: 'center', padding: '2rem 0 1rem', borderTop: `1px solid ${v.border}`, marginTop: '1rem' }}>
            <div style={{ fontSize: '0.875rem', color: v.w40, marginBottom: '1.25rem', fontStyle: 'italic' }}>
              Don't see your destination? We cover every country in the world.
            </div>
            <button
              onClick={() => navigate('/plan')}
              style={{ background: v.teal, color: v.navy, border: 'none', padding: '12px 28px', borderRadius: 12, fontSize: '1rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif' " }}
            >
              Plan any destination — free →
            </button>
          </div>
        </div>
      </section>
    </div>
    </div>
    </div>
    </div>
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '2rem 2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.25)' }}>© 2025 WanderZenAI</div>
      <div style={{ display: 'flex', gap: '1.5rem' }}>
        <a href="/" style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Home</a>
        <a href="/pricing" style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Pricing</a>
        <a href="/agency" style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>For agencies</a>
        <a href="mailto:travel@wanderzenai.com" style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Contact</a>
      </div>
    </div>
  );
}
