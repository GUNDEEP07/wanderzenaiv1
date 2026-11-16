import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Landing.css';
import { usePricing } from '../hooks/usePricing';
import { plansFrom } from '../utils/plans';
import GUIDES from '../data/guides-index.json';
import SeasonHero from '../components/home/SeasonHero';

// The focus is Asia (Nov 2026): these guides lead wherever guides are listed.
const ASIA = new Set(['Vietnam', 'Japan', 'India', 'Thailand', 'Sri Lanka', 'Indonesia', 'Nepal']);
const ASIA_GUIDES = GUIDES.filter(g => ASIA.has(g.name));

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
  { icon: '◑', title: 'Your language', body: 'English, Hindi, Spanish, French, Japanese and 5 more languages.' },
  { icon: '▦', title: 'Beautiful PDF, forever', body: 'Print-ready PDF with day cards, local eats, insider tips and cost breakdown.' },
];

const STEPS = [
  { num: '01', title: 'Tell us your trip', body: 'Destination, budget, travel style, pace and interests. Two minutes, no account needed to start.' },
  { num: '02', title: 'AI crafts your plan', body: 'Built on slow-travel philosophy — hidden cafes, local guesthouses, scenic walks away from crowds.' },
  { num: '03', title: 'Itinerary in your inbox', body: 'Watch it being written day by day — usually a few minutes — then a beautifully designed PDF lands in your email. Yours forever.' },
];

const SAMPLES = [
  { day: 1, theme: 'Dawn temples & whispered gardens', gem: 'Nanzenji\'s back north gate at 6:30 AM — monks walking, mist on the canal, zero crowds', food: 'Okutan Kappa Zushi at 5:30 PM (opening) — locals dine here, tourists arrive at 7 PM' },
  { day: 2, theme: 'Mountain paths & artisan markets', gem: 'Fushimi Inari back trails via Inariyama Park — forested, quiet, maybe 3 other people', food: 'Demachi Masugata Shotengai — residential market where locals actually shop for lunch' },
  { day: 3, theme: 'Slow mornings & neighbourhood life', gem: 'Kiyomizu-dera back lanes going LEFT — family homes, tiny shrines, no souvenir shops', food: 'Yudofu Sagano — hot pot tofu in a wooden room, owner remembers regulars by name' },
];

export default function Landing() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  // Anyone can plan; sign-in comes at Submit (Nov 2026).
  const planRoute = () => navigate('/plan');
  const plans = plansFrom(usePricing());
  const sectionsRef = useRef([]);


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
          <a href="/guides" className="nav-link">Guides</a>
          <a href="/blog" className="nav-link">Stories</a>
          <a href="#how" className="nav-link">How it works</a>
          <a href="#sample" className="nav-link">Sample plan</a>
          <a href="/pricing" className="nav-link">Pricing</a>
          <a href="/contact" className="nav-link">Contact</a>
          <a href="/contact?type=partnership" className="nav-link">For agencies</a>
          {currentUser ? (
            <a href="/dashboard" className="nav-link">Dashboard</a>
          ) : (
            <a href="/login" className="nav-link nav-signin">Sign in</a>
          )}
          <button className="nav-cta" onClick={planRoute}>
            {currentUser ? 'Plan my trip' : 'Try it free'}
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-bg">
          {/* Subtle background image with dark overlay */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 0,
            backgroundImage: 'url(https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1000&h=560&fit=crop&auto=format&q=45)', // at 8% opacity a small image looks the same
            backgroundSize: 'cover', backgroundPosition: 'center',
            opacity: 0.08,
          }} />
          <div className="hero-grid" />
          <div className="hero-glow-1" />
          <div className="hero-glow-2" />
          <div className="hero-glow-3" />
        </div>

        {/* Design A (Nov 16 2026): in-season countries first, closest to the visitor; a real route + photo. */}
        <SeasonHero />

        <div className="hero-proof reveal" ref={addRef}>
          <div className="proof-item"><div className="proof-num">{GUIDES.length}</div><div className="proof-label">countries with hand-picked routes</div></div>
          <div className="proof-item"><div className="proof-num">{ASIA_GUIDES.length}</div><div className="proof-label">of them in Asia</div></div>
          <div className="proof-item"><div className="proof-num">Day 1</div><div className="proof-label">free to read before you pay</div></div>
          <div className="proof-item"><div className="proof-num">$0</div><div className="proof-label">to get started</div></div>
        </div>
      </section>

      {/* ── Explore teaser ── */}
      <div style={{ textAlign: 'center', padding: '1rem 2rem 3rem', background: '#0a0f1e' }}>
        <a href="/explore" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '12px 24px', borderRadius: 100, border: '1px solid rgba(0,212,170,0.25)', background: 'rgba(0,212,170,0.06)', color: '#00d4aa', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, transition: 'all 0.2s' }}>
          <span>✦</span>
          Explore destinations — Asia first
          <span>→</span>
        </a>
      </div>

      {/* ── Slow routes (country guides, Asia first) ── */}
      <section style={{ background: '#0a0f1e', padding: '0 0 4rem' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem' }}>
          <div className="reveal" ref={addRef} style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h2 className="section-title" style={{ fontSize: 'clamp(1.5rem,3vw,2.2rem)' }}>
              Slow routes, ready to go
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem', marginTop: '0.5rem' }}>
              Hand-picked routes with fewer stops and longer stays — most of them in Asia.
            </p>
          </div>
          <div className="reveal" ref={addRef} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {[...ASIA_GUIDES, ...GUIDES.filter(g => !ASIA.has(g.name))].map((g, i) => (
              <a key={g.slug} href={`/guides/${g.slug}`} style={{
                display: 'inline-flex', alignItems: 'center', minHeight: 40, padding: '8px 18px', borderRadius: 100,
                background: ASIA.has(g.name) ? 'rgba(0,212,170,0.1)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${ASIA.has(g.name) ? 'rgba(0,212,170,0.3)' : 'rgba(255,255,255,0.12)'}`,
                fontSize: 13, fontWeight: 600, color: ASIA.has(g.name) ? '#00d4aa' : 'rgba(255,255,255,0.75)',
                textDecoration: 'none', fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}>
                {g.name}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── Photo strip ── */}
      <section style={{ background: '#0a0f1e', padding: '0 0 5rem', overflow: 'hidden' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 2rem' }}>
          <div className="reveal" ref={addRef} style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h2 className="section-title" style={{ fontSize: 'clamp(1.5rem,3vw,2.5rem)' }}>The places we actually send you to</h2>
          </div>
          <div className="reveal photo-strip-grid" ref={addRef}>
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
          <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)', fontStyle: 'italic' }}>
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
              A WanderZenAI sample. Notice what's missing — no midday crush in the Arashiyama bamboo grove, no selfie queues in Gion.
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
      {/* Testimonials: removed until there are real ones (Nov 2026) — never invent reviews. */}

      <section className="section" style={{ background: '#0a0f1e' }}>
        <div className="section-inner">
          <div className="reveal" ref={addRef}>
            <div className="section-tag">Pricing</div>
            <h2 className="section-title">Simple, honest pricing.</h2>
            <p className="section-sub">Pay per trip — no subscription. Your PDF is yours to keep forever.</p>
          </div>

          {/* Same plans and Stripe prices as /pricing (design D) — nothing hard-coded. */}
          <div className="pricing-grid">
            {plans.map((plan, i) => (
              <div key={plan.name} className={`plan-card${plan.featured ? ' plan-card-featured' : ''} reveal${i ? ` reveal-delay-${i}` : ''}`} ref={addRef}>
                {plan.featured && <div className="plan-badge">Most trips</div>}
                <div className="plan-name">{plan.name}</div>
                <div className="plan-price">{plan.price}</div>
                <div className="plan-period">{plan.period}</div>
                <ul className="plan-features">
                  {plan.features.slice(0, 4).map(f => (
                    <li key={f}><span className="plan-check">✓</span>{f}</li>
                  ))}
                </ul>
                <button className={`plan-btn ${plan.featured ? 'plan-btn-filled' : 'plan-btn-outline'}`} onClick={() => (plan.buy ? navigate('/pricing') : planRoute())}>
                  {plan.cta}
                </button>
              </div>
            ))}
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
          <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)' }}>
            No credit card · Ready in minutes · PDF yours forever
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
            <a href="/guides">Guides</a>
            <a href="/blog">Stories</a>
            <a href="/pricing">Pricing</a>
            <a href="/contact?type=partnership">For agencies</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/contact">Contact</a>
            <a href="https://instagram.com/wanderzenai">Instagram</a>
          </div>
          <div className="footer-links" aria-label="Slow travel guides">
            {GUIDES.map(g => <a key={g.slug} href={`/guides/${g.slug}`}>{g.name}</a>)}
          </div>
          <div className="footer-copy">© {new Date().getFullYear()} WanderZenAI · Built for slow travellers</div>
        </div>
      </footer>
    </div>
  );
}
