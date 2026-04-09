import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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

const FEATURES = [
  { icon: '◈', title: 'Zero tourist traps', body: 'Every itinerary is built to avoid the top-10 lists. We find the spots locals keep to themselves.' },
  { icon: '◈', title: 'Slow travel by design', body: 'Breathing room is built in. Hidden cafes, morning trails, village markets — not 8 sights before noon.' },
  { icon: '◈', title: 'Nature-first stays', body: 'We suggest farmhouses, forest retreats and residential homestays — never city-centre chain hotels.' },
  { icon: '◈', title: 'One hidden gem daily', body: 'Every single day includes something most tourists never find. That\'s not a feature — it\'s a promise.' },
  { icon: '◈', title: 'Your language', body: 'Receive your itinerary in English, Hindi, Spanish, French, Japanese and 6 more languages.' },
  { icon: '◈', title: 'Beautiful PDF, forever', body: 'A print-ready PDF with day cards, local eats, insider tips and cost breakdown. Yours to keep.' },
];

const STEPS = [
  { icon: '✦', num: '01', title: 'Tell us your trip', body: 'Destination, budget, travel style, pace and interests. Two minutes, no account needed.' },
  { icon: '✦', num: '02', title: 'AI crafts your plan', body: 'Built on slow-travel philosophy — hidden cafes, local guesthouses, scenic walks away from crowds.' },
  { icon: '✦', num: '03', title: 'Itinerary in your inbox', body: 'A beautifully designed PDF lands in your email within 3 minutes. Yours forever.' },
];

const SAMPLES = [
  {
    day: 1, theme: 'Dawn temples & whispered gardens',
    gem: 'Nanzenji\'s back north gate at 6:30 AM — monks walking, mist on the canal, zero crowds',
    food: 'Okutan Kappa Zushi at 5:30 PM (opening) — locals dine here, tourists arrive at 7 PM',
  },
  {
    day: 2, theme: 'Mountain paths & artisan markets',
    gem: 'Fushimi Inari back trails via Inariyama Park — forested, quiet, maybe 3 other people',
    food: 'Demachi Masugata Shotengai — residential market where locals actually shop for lunch',
  },
  {
    day: 3, theme: 'Slow mornings & neighbourhood life',
    gem: 'Kiyomizu-dera back lanes going LEFT — family homes, tiny shrines, no souvenir shops',
    food: 'Yudofu Sagano — hot pot tofu in a wooden room, owner remembers regulars by name',
  },
];

export default function Landing() {
  const navigate = useNavigate();
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
          <a href="#how" className="nav-link">How it works</a>
          <a href="#sample" className="nav-link">Sample plan</a>
          <a href="/pricing" className="nav-link">Pricing</a>
          <a href="/agency" className="nav-link">For agencies</a>
          <button className="nav-cta" onClick={() => navigate('/plan')}>Plan my trip</button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-bg">
          <div className="hero-grid" />
          <div className="hero-glow-1" />
          <div className="hero-glow-2" />
        </div>

        <div className="hero-eyebrow">
          <div className="hero-eyebrow-dot" />
          AI-powered slow travel planning
        </div>

        <h1 className="hero-title">
          Find the <span className="hero-title-teal">real</span> destination<br />
          <span className="hero-title-dim">hiding behind the tourist trail</span>
        </h1>

        <p className="hero-sub">
          Personalised itineraries built on one belief — the best places are never in the guidebook.
          Hidden cafes, nature trails, village stays and morning markets, crafted by AI trained to avoid tourist traps.
        </p>

        <div className="hero-actions">
          <button className="btn-primary" onClick={() => navigate('/plan')}>
            Plan my trip — free
            <span>→</span>
          </button>
          <button className="btn-ghost" onClick={() => document.getElementById('sample').scrollIntoView({ behavior: 'smooth' })}>
            See a sample plan
          </button>
        </div>

        <div className="hero-tags">
          {DESTINATIONS.map((d, i) => (
            <div
              key={d.name}
              className="dest-tag"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="dest-tag-dot" style={{ background: d.color }} />
              {d.name}
            </div>
          ))}
        </div>

        <div className="hero-proof reveal" ref={addRef}>
          <div className="proof-item">
            <div className="proof-num">3 min</div>
            <div className="proof-label">avg delivery time</div>
          </div>
          <div className="proof-item">
            <div className="proof-num">0</div>
            <div className="proof-label">tourist traps included</div>
          </div>
          <div className="proof-item">
            <div className="proof-num">10+</div>
            <div className="proof-label">languages supported</div>
          </div>
          <div className="proof-item">
            <div className="proof-num">$0</div>
            <div className="proof-label">to get started</div>
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
            {STEPS.map((s, i) => (
              <div key={s.num} className="step">
                <div className="step-num">{s.num}</div>
                <div className="step-icon">{s.icon}</div>
                <div className="step-title">{s.title}</div>
                <div className="step-body">{s.body}</div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '3rem' }} className="reveal" ref={addRef}>
            <button className="btn-primary" onClick={() => navigate('/plan')}>
              Start planning — it's free →
            </button>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="section" style={{ background: '#0a0f1e' }}>
        <div className="section-inner">
          <div className="reveal" ref={addRef}>
            <div className="section-tag">Why WanderZenAI</div>
            <h2 className="section-title">Not another<br />generic travel app.</h2>
            <p className="section-sub">
              Built on a slow-travel philosophy. Every feature exists to get you off the tourist trail and into the real destination.
            </p>
          </div>

          <div className="features-grid" style={{ marginTop: '4rem' }}>
            {FEATURES.map((f, i) => (
              <div key={f.title} className={`feature reveal reveal-delay-${(i % 4) + 1}`} ref={addRef}>
                <span className="feature-icon" style={{ color: '#00d4aa', fontSize: '16px' }}>{f.icon}</span>
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
            <p className="section-sub" style={{ maxWidth: '320px' }}>
              A real WanderZenAI itinerary excerpt. Notice what's missing — no Senso-ji crowds, no Shibuya crossing.
            </p>
          </div>

          <div className="sample-cards">
            {SAMPLES.map((s, i) => (
              <div key={s.day} className={`sample-card reveal reveal-delay-${i + 1}`} ref={addRef}>
                <div className="sample-card-header">
                  <div>
                    <div className="sample-day-badge">Day {s.day}</div>
                    <div className="sample-card-theme">{s.theme}</div>
                  </div>
                </div>
                <div className="sample-card-body">
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
              <button className="plan-btn plan-btn-outline" onClick={() => navigate('/plan')}>Get started free</button>
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

      {/* ── Final CTA ── */}
      <section className="cta-section">
        <div className="cta-inner reveal" ref={addRef}>
          <h2 className="cta-title">
            Your next adventure<br />starts <em>here.</em>
          </h2>
          <p className="cta-sub">
            No tourist traps. No crowded itineraries. Just you and the real destination.
          </p>
          <button className="btn-primary" style={{ fontSize: '1.1rem', padding: '1.1rem 3rem' }} onClick={() => navigate('/plan')}>
            Plan my trip — free →
          </button>
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
