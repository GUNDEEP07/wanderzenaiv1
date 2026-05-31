import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Landing.css';

const DESTINATIONS = [
  { name: 'Kyoto backstreets', color: '#00d4aa' },
  { name: 'Patagonia trails', color: '#ffd93d' },
  { name: 'Oaxaca markets', color: '#ff6b6b' },
  { name: 'Faroe Islands', color: '#00d4aa' },
  { name: 'Tbilisi wine country', color: '#ffd93d' },
  { name: 'Hoi An villages', color: '#ff6b6b' },
  { name: 'Lofoten Islands', color: '#00d4aa' },
  { name: 'Puglia farmhouses', color: '#ffd93d' },
  { name: 'Luang Prabang', color: '#ff6b6b' },
  { name: 'Bir Billing trails', color: '#00d4aa' },
  { name: 'Azores crater lakes', color: '#ffd93d' },
  { name: 'Georgia mountains', color: '#ff6b6b' },
];

// Curated Unsplash images — slow travel, nature, hidden places aesthetic
const PHOTO_STRIP = [
  { url: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=400&h=560&fit=crop&auto=format', alt: 'Kyoto temple path at dawn', label: 'Kyoto' },
  { url: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&h=560&fit=crop&auto=format', alt: 'Patagonia mountain trail', label: 'Patagonia' },
  { url: 'https://images.unsplash.com/photo-1539635278303-d4002c07eae3?w=400&h=560&fit=crop&auto=format', alt: 'Bali rice terraces', label: 'Bali' },
  { url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&h=560&fit=crop&auto=format', alt: 'European village street', label: 'Puglia' },
  { url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=560&fit=crop&auto=format', alt: 'Tropical beach hidden cove', label: 'Sri Lanka' },
  { url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&h=560&fit=crop&auto=format', alt: 'Mountain landscape trail', label: 'Faroe Islands' },
];

const SAMPLE_IMAGES = [
  'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=600&h=300&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=600&h=300&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&h=300&fit=crop&auto=format',
];

const FEATURES = [
  { icon: '⊘', title: 'Zero tourist traps', body: 'Every itinerary avoids the top-10 lists. We find the spots locals keep to themselves.' },
  { icon: '◎', title: 'Slow travel by design', body: 'Hidden cafes, morning trails, village markets — not 8 sights before noon.' },
  { icon: '△', title: 'Nature-first stays', body: 'Farmhouses, forest retreats and residential homestays — never city-centre chain hotels.' },
  { icon: '◆', title: 'One hidden gem daily', body: 'Every single day includes something most tourists never find. That\'s a promise.' },
  { icon: '◑', title: 'Your language', body: 'English, Hindi, Spanish, French, Japanese and 6 more languages supported.' },
  { icon: '▦', title: 'Beautiful PDF, forever', body: 'Print-ready PDF with day cards, local eats, insider tips and cost breakdown.' },
];

const STEPS = [
  { num: '01', title: 'Tell us your trip', body: 'Destination, budget, travel style, pace and interests. Two minutes, no account needed.' },
  { num: '02', title: 'AI crafts your plan', body: 'Built on slow-travel philosophy — hidden cafes, local guesthouses, scenic walks away from crowds.' },
  { num: '03', title: 'Itinerary in your inbox', body: 'A beautifully designed PDF lands in your email within 3 minutes. Yours forever.' },
];

const SAMPLES = [
  { day: 1, theme: 'Dawn temples & whispered gardens', gem: 'Nanzenji\'s back north gate at 6:30 AM — monks walking, mist on the canal, zero crowds', food: 'Okutan Kappa Zushi at 5:30 PM (opening) — locals dine here, tourists arrive at 7 PM' },
  { day: 2, theme: 'Mountain paths & artisan markets', gem: 'Fushimi Inari back trails via Inariyama Park — forested, quiet, maybe 3 other people', food: 'Demachi Masugata Shotengai — residential market where locals actually shop for lunch' },
  { day: 3, theme: 'Slow mornings & neighbourhood life', gem: 'Kiyomizu-dera back lanes going LEFT — family homes, tiny shrines, no souvenir shops', food: 'Yudofu Sagano — hot pot tofu in a wooden room, owner remembers regulars by name' },
];

export default function Landing() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const planRoute = () => navigate(currentUser ? '/plan' : '/signup');
  const sectionsRef = useRef([]);

  const [stats, setStats] = useState({
    totalTrips: 22, totalDays: 75, uniqueDestinations: 14,
    destinations: ['Kyoto, Japan', 'Kerala, India', 'Vietnam', 'Slovenia', 'Kashmir', 'Himachal Pradesh', 'Triund', 'Japan'],
  });

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/recommendations/public/stats`)
      .then(r => r.json())
      .then(d => { if (d.totalTrips) setStats(d); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    sectionsRef.current.forEach(el => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  const addRef = el => { if (el && !sectionsRef.current.includes(el)) sectionsRef.current.push(el); };

  return (
    <div style={{ background: '#0a0f1e', minHeight: '100vh' }}>

      {/* ── Nav ── */}
      <nav className="nav">
        <div className="nav-inner">
          <a className="nav-logo" href="/">
            <div className="nav-logo-mark">W</div>
            <span className="nav-logo-text">Wander<span>Zen</span>AI</span>
          </a>
          <a href="/explore" className="nav-link">Explore</a>
          <a href="#how" className="nav-link">How it works</a>
          <a href="#sample" className="nav-link">Sample plan</a>
          <a href="/pricing" className="nav-link">Pricing</a>
          <a href="/agency" className="nav-link">For agencies</a>
          <button className="nav-cta" onClick={planRoute}>Plan my trip</button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-bg">
          {/* Subtle background image with dark overlay */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 0,
            backgroundImage: 'url(https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1600&h=900&fit=crop&auto=format)',
            backgroundSize: 'cover', backgroundPosition: 'center',
            opacity: 0.08,
          }} />
          <div className="hero-grid" />
          <div className="hero-glow-1" />
          <div className="hero-glow-2" />
          <div className="hero-glow-3" />
        </div>

        <div className="hero-eyebrow">
          <div className="hero-eyebrow-dot" />
          AI-powered slow travel planning
        </div>

        <h1 className="hero-title hero-title-gradient">
          Find the <span className="hero-title-teal">real</span> destination<br />
          <span className="hero-title-dim">hiding behind the tourist trail</span>
        </h1>

        <p className="hero-sub">
          Personalised itineraries built on one belief — the best places are never in the guidebook.
          Hidden cafes, nature trails, village stays and morning markets, crafted by AI trained to avoid tourist traps.
        </p>

        <div className="hero-actions">
          <button className="btn-primary" onClick={planRoute}>
            Plan my trip — free <span>→</span>
          </button>
          <button className="btn-ghost" onClick={() => document.getElementById('sample').scrollIntoView({ behavior: 'smooth' })}>
            See a sample plan
          </button>
        </div>

        <div className="hero-tags">
          {DESTINATIONS.map((d, i) => (
            <div key={d.name} className="dest-tag" style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="dest-tag-dot" style={{ background: d.color }} />
              {d.name}
            </div>
          ))}
        </div>

        <div className="hero-proof reveal" ref={addRef}>
          <div className="proof-item"><div className="proof-num">{stats.totalTrips}+</div><div className="proof-label">itineraries generated</div></div>
          <div className="proof-item"><div className="proof-num">{stats.uniqueDestinations}+</div><div className="proof-label">destinations explored</div></div>
          <div className="proof-item"><div className="proof-num">{stats.totalDays}+</div><div className="proof-label">days of slow travel</div></div>
          <div className="proof-item"><div className="proof-num">$0</div><div className="proof-label">to get started</div></div>
        </div>
      </section>

      {/* ── Explore teaser ── */}
      <div style={{ textAlign: 'center', padding: '1rem 2rem 3rem', background: '#0a0f1e' }}>
        <a href="/explore" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '12px 24px', borderRadius: 100, border: '1px solid rgba(0,212,170,0.25)', background: 'rgba(0,212,170,0.06)', color: '#00d4aa', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, transition: 'all 0.2s' }}>
          <span>✦</span>
          Browse 50+ destinations across 6 continents
          <span>→</span>
        </a>
      </div>

      {/* ── Destination Wall ── */}
      <section style={{ background: '#0a0f1e', padding: '0 0 4rem' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem' }}>
          <div className="reveal" ref={addRef} style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h2 className="section-title" style={{ fontSize: 'clamp(1.5rem,3vw,2.2rem)' }}>
              Where our travelers have wandered
            </h2>
          </div>
          <div className="reveal" ref={addRef} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {stats.destinations.map((dest, i) => {
              const colors = ['rgba(0,212,170,0.12)', 'rgba(255,217,61,0.08)', 'rgba(96,165,250,0.08)', 'rgba(167,139,250,0.08)', 'rgba(251,146,60,0.08)'];
              const borders = ['rgba(0,212,170,0.25)', 'rgba(255,217,61,0.2)', 'rgba(96,165,250,0.2)', 'rgba(167,139,250,0.2)', 'rgba(251,146,60,0.2)'];
              const textColors = ['#00d4aa', '#ffd93d', '#60a5fa', '#a78bfa', '#fb923c'];
              const ci = i % 5;
              return (
                <div key={dest} style={{
                  padding: '8px 18px', borderRadius: 100,
                  background: colors[ci], border: `1px solid ${borders[ci]}`,
                  fontSize: 13, fontWeight: 600, color: textColors[ci],
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}>
                  {dest}
                </div>
              );
            })}
            {stats.totalTrips > stats.destinations.length && (
              <div style={{ padding: '8px 18px', borderRadius: 100, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.4)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                +{stats.totalTrips - stats.destinations.length} more destinations
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Photo strip ── */}
      <section style={{ background: '#0a0f1e', padding: '0 0 5rem', overflow: 'hidden' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 2rem' }}>
          <div className="reveal" ref={addRef} style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h2 className="section-title" style={{ fontSize: 'clamp(1.5rem,3vw,2.5rem)' }}>The places we actually send you to</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0,1fr))', gap: 8 }} className="reveal" ref={addRef}>
            {PHOTO_STRIP.map((photo, i) => (
              <div key={photo.label} style={{
                position: 'relative', borderRadius: 12, overflow: 'hidden',
                aspectRatio: '9/16', animationDelay: `${i * 0.1}s`,
              }}>
                <img
                  src={photo.url}
                  alt={photo.alt}
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.5s ease' }}
                  onMouseEnter={e => e.target.style.transform = 'scale(1.05)'}
                  onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                />
                {/* Dark gradient overlay */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(to top, rgba(10,15,30,0.85) 0%, rgba(10,15,30,0.1) 50%, transparent 100%)',
                }} />
                {/* Label */}
                <div style={{
                  position: 'absolute', bottom: 12, left: 12,
                  fontSize: '0.75rem', fontWeight: 700, color: '#fff',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>{photo.label}</div>
                {/* Teal accent line */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  height: 2, background: '#00d4aa', transform: 'scaleX(0)',
                  transition: 'transform 0.3s', transformOrigin: 'left',
                }} className="photo-accent" />
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>
            Photos via Unsplash
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="section how" id="how">
        <div className="section-inner">
          <div className="reveal" ref={addRef}>
            <div className="section-tag">How it works</div>
            <h2 className="section-title">Three steps.<br />One trip you'll never forget.</h2>
          </div>

          <div className="steps reveal" ref={addRef}>
            {STEPS.map(s => (
              <div key={s.num} className="step">
                <div className="step-num">{s.num}</div>
                <div className="step-icon">✦</div>
                <div className="step-title">{s.title}</div>
                <div className="step-body">{s.body}</div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '3rem' }} className="reveal" ref={addRef}>
            <button className="btn-primary" onClick={planRoute}>
              Start planning — it's free →
            </button>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="section" style={{ background: '#0a0f1e' }}>
        <div className="section-inner">
          {/* Feature image banner */}
          <div className="reveal" ref={addRef} style={{ borderRadius: 16, overflow: 'hidden', marginBottom: '4rem', position: 'relative', height: 280 }}>
            <img
              src="https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1200&h=400&fit=crop&auto=format"
              alt="Patagonia mountain trail slow travel"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(135deg, rgba(10,15,30,0.9) 0%, rgba(10,15,30,0.4) 60%, rgba(10,15,30,0.1) 100%)',
              display: 'flex', alignItems: 'center', padding: '0 3rem',
            }}>
              <div>
                <div className="section-tag">Why WanderZenAI</div>
                <h2 className="section-title" style={{ fontSize: 'clamp(1.75rem,4vw,3rem)', marginBottom: '0.75rem' }}>
                  Not another<br />generic travel app.
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1rem', maxWidth: 400, lineHeight: 1.7 }}>
                  Built on a slow-travel philosophy. Every feature exists to get you off the tourist trail and into the real destination.
                </p>
              </div>
            </div>
          </div>

          <div className="features-grid">
            {FEATURES.map((f, i) => (
              <div key={f.title} className={`feature reveal reveal-delay-${(i % 4) + 1}`} ref={addRef}>
                <span className="feature-icon" style={{ color: '#00d4aa', fontSize: 16 }}>{f.icon}</span>
                <div className="feature-title">{f.title}</div>
                <div className="feature-body">{f.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sample ── */}
      <section className="section sample" id="sample">
        <div className="section-inner">
          <div className="sample-header reveal" ref={addRef}>
            <div>
              <div className="section-tag">Sample plan</div>
              <h2 className="section-title">Quiet Kyoto:<br />Temples, Trails & Morning Mist</h2>
            </div>
            <p className="section-sub" style={{ maxWidth: 320 }}>
              A real WanderZenAI excerpt. Notice what's missing — no Senso-ji crowds, no Shibuya crossing.
            </p>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1rem', fontStyle: 'italic', marginTop: '0.5rem' }}>
              From {stats.totalTrips}+ real itineraries generated for slow travelers like you
            </p>
          </div>

          <div className="sample-cards">
            {SAMPLES.map((s, i) => (
              <div key={s.day} className={`sample-card reveal reveal-delay-${i + 1}`} ref={addRef}>
                {/* Photo header */}
                <div style={{ position: 'relative', height: 160, overflow: 'hidden' }}>
                  <img
                    src={SAMPLE_IMAGES[i]}
                    alt={s.theme}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(20,29,51,1) 0%, rgba(20,29,51,0.3) 60%, transparent 100%)' }} />
                  <div style={{ position: 'absolute', bottom: 14, left: 16 }}>
                    <div className="sample-day-badge">Day {s.day}</div>
                  </div>
                </div>

                <div className="sample-card-body" style={{ padding: '1.25rem 1.5rem' }}>
                  <div className="sample-card-theme" style={{ marginBottom: '1rem' }}>{s.theme}</div>
                  <div className="sample-gem-label">Hidden gem</div>
                  <div className="sample-gem">{s.gem}</div>
                  <div className="sample-food-label">Where to eat</div>
                  <div className="sample-food">{s.food}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      {/* ── Testimonials ── */}
      <section style={{ background: '#0a0f1e', padding: '0 0 5rem' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem' }}>
          <div className="reveal" ref={addRef} style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2 className="section-title" style={{ fontSize: 'clamp(1.5rem,3vw,2.2rem)' }}>Built for people who travel differently</h2>
          </div>
          <div className="reveal" ref={addRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {[
              { quote: "Finally a travel app that doesn't just list the Eiffel Tower. My Kyoto itinerary had me at a 6am temple before any tourists arrived — that's the kind of thing I can never find on my own.", name: 'Prabhsimran K.', location: 'Sydney, Australia', dest: '🇯🇵 Kyoto' },
              { quote: "I've used every travel planner out there. This is the first one that actually understood I don't want tourist traps — the Kerala backwaters route it gave me was completely off the usual trail.", name: 'Meena C.', location: 'Melbourne, Australia', dest: '🇮🇳 Kerala' },
              { quote: "Planned a solo trip to Shimla in under 3 minutes. The hidden gem section alone was worth it — a sunrise trek I'd never heard of that locals use. No crowds, no queues.", name: 'Jaideep S.', location: 'Chandigarh, India', dest: '🇮🇳 Shimla' },
            ].map((t, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Stars */}
                <div style={{ display: 'flex', gap: 3 }}>
                  {[...Array(5)].map((_, j) => (
                    <span key={j} style={{ color: '#ffd93d', fontSize: 14 }}>★</span>
                  ))}
                </div>
                {/* Quote */}
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.7, margin: 0, flex: 1 }}>
                  "{t.quote}"
                </p>
                {/* Attribution */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{t.location}</div>
                  </div>
                  <div style={{ padding: '5px 12px', background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.15)', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#00d4aa' }}>
                    {t.dest}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ background: '#0a0f1e' }}>
        <div className="section-inner">
          <div className="reveal" ref={addRef}>
            <div className="section-tag">Pricing</div>
            <h2 className="section-title">Simple, honest pricing.</h2>
            <p className="section-sub">No hidden fees. Cancel anytime. Your PDF is yours to keep forever.</p>
          </div>

          <div className="pricing-grid">
            <div className="plan-card reveal" ref={addRef}>
              <div className="plan-name">Explorer</div>
              <div className="plan-price">Free</div>
              <div className="plan-period">1 itinerary per month</div>
              <ul className="plan-features">
                {['Full day-by-day plan', 'Hidden gems every day', 'Local food picks', 'PDF download & email delivery'].map(f => (
                  <li key={f}><span className="plan-check">✓</span>{f}</li>
                ))}
              </ul>
              <button className="plan-btn plan-btn-outline" onClick={planRoute}>Get started free</button>
            </div>

            <div className="plan-card plan-card-featured reveal reveal-delay-1" ref={addRef}>
              <div className="plan-badge">Most popular</div>
              <div className="plan-name">Wanderer</div>
              <div className="plan-price">$9<span className="plan-price-sub">/mo</span></div>
              <div className="plan-period">5 itineraries per month</div>
              <ul className="plan-features">
                {['Everything in Free', '5 itineraries monthly', 'Longer detailed plans', 'Priority generation', 'Accommodation deep-dives', 'Cancel anytime'].map(f => (
                  <li key={f}><span className="plan-check">✓</span>{f}</li>
                ))}
              </ul>
              <button className="plan-btn plan-btn-filled" onClick={() => navigate('/pricing')}>Start Wanderer</button>
            </div>

            <div className="plan-card reveal reveal-delay-2" ref={addRef}>
              <div className="plan-name">Single Plan</div>
              <div className="plan-price">$7</div>
              <div className="plan-period">One-time payment</div>
              <ul className="plan-features">
                {['Everything in Free', '1 premium itinerary', 'No subscription needed', 'Pay once, keep forever'].map(f => (
                  <li key={f}><span className="plan-check">✓</span>{f}</li>
                ))}
              </ul>
              <button className="plan-btn plan-btn-outline" onClick={() => navigate('/pricing')}>Buy one plan</button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA with background image ── */}
      <section style={{ position: 'relative', overflow: 'hidden', padding: '8rem 2rem', textAlign: 'center' }}>
        {/* Background image */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: 'url(https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1600&h=800&fit=crop&auto=format)',
          backgroundSize: 'cover', backgroundPosition: 'center',
        }} />
        {/* Dark overlay */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'rgba(10,15,30,0.82)' }} />
        {/* Teal glow */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'radial-gradient(ellipse at center, rgba(0,212,170,0.08) 0%, transparent 70%)' }} />

        <div style={{ position: 'relative', zIndex: 2, maxWidth: 700, margin: '0 auto' }} className="reveal" ref={addRef}>
          <h2 className="cta-title">
            Your next adventure<br />starts <em style={{ color: '#00d4aa', fontStyle: 'italic' }}>here.</em>
          </h2>
          <p className="cta-sub">
            No tourist traps. No crowded itineraries. Just you and the real destination.
          </p>
          <button className="btn-primary" style={{ fontSize: '1.1rem', padding: '1.1rem 3rem' }} onClick={planRoute}>
            Plan my trip — free →
          </button>
          <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)' }}>
            No credit card · Delivered in 3 minutes · PDF yours forever
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="nav-logo">
            <div className="nav-logo-mark">W</div>
            <span className="nav-logo-text">Wander<span>Zen</span>AI</span>
          </div>
          <div className="footer-links">
            <a href="/pricing">Pricing</a>
            <a href="/agency">For agencies</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="https://instagram.com/wanderzenai">Instagram</a>
            <a href="mailto:travel@wanderzenai.com">Contact</a>
          </div>
          <div className="footer-copy">© 2025 WanderZenAI · Built for slow travellers</div>
        </div>
      </footer>
    </div>
  );
}
