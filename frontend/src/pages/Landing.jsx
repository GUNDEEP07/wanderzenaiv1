import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Landing.css';

const NAV_LINKS = ['How it works', 'Pricing', 'Sample'];

const FEATURES = [
  { icon: '◦', title: 'Off the beaten path', body: 'No tourist traps. We find the hidden cafes, morning markets and local trails that never make the top-10 lists.' },
  { icon: '◦', title: 'Slow travel philosophy', body: 'Built by a traveller who believes the best moments happen when you stop rushing. Each plan has breathing room.' },
  { icon: '◦', title: 'Local stays, not chain hotels', body: 'We suggest homestays, village guesthouses and Airbnbs in residential neighbourhoods — not city-centre towers.' },
  { icon: '◦', title: 'Genuine hidden gems', body: 'Every single day includes one place or experience that most tourists never discover. That\'s our promise.' },
  { icon: '◦', title: 'Fully personalised', body: 'Tell us your budget, travel style and interests. Claude crafts an itinerary that fits you, not a template.' },
  { icon: '◦', title: 'Beautiful PDF, yours to keep', body: 'Download a print-ready PDF with your full plan, local food picks, insider tips and daily cost breakdown.' },
];

const STEPS = [
  { num: '01', title: 'Tell us about your trip', body: 'Destination, dates, budget, travel style. Takes 2 minutes.' },
  { num: '02', title: 'AI crafts your plan', body: 'Claude — trained on slow travel philosophy — builds a day-by-day itinerary tailored to you.' },
  { num: '03', title: 'Receive your PDF', body: 'A beautiful, print-ready itinerary lands in your inbox within minutes. Yours to keep forever.' },
];

const SAMPLE_DAYS = [
  { day: 1, theme: 'Arrival & first wander', gem: 'Nakameguro canal at dusk — locals walk their dogs here, tourists rarely find it', food: 'Ramen at a no-name shop behind Shibuya station — follow the steam' },
  { day: 2, theme: 'Mountains & morning mist', gem: 'Mitake-san hiking trail — 90 min from central Tokyo, cedar forest, almost no English speakers', food: 'Soba at a 100-year-old family restaurant near the trailhead' },
  { day: 3, theme: 'Markets & slow mornings', gem: 'Koenji flea market — vinyl records, ceramics, vintage film cameras, open only on odd Sundays', food: 'Kissaten coffee culture — find a 1970s-era kissaten and order morning set' },
];

export default function Landing() {
  const navigate = useNavigate();
  const heroRef = useRef(null);
  const sectionsRef = useRef([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    sectionsRef.current.forEach(el => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  const addRef = (el) => { if (el && !sectionsRef.current.includes(el)) sectionsRef.current.push(el); };

  return (
    <div className="lp">
      {/* ── Nav ── */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <div className="lp-logo">WanderZen<span>AI</span></div>
          <div className="lp-nav-links">
            {NAV_LINKS.map(l => <a key={l} href={`#${l.toLowerCase().replace(/ /g, '-')}`} className="lp-nav-link">{l}</a>)}
          </div>
          <button className="lp-nav-cta" onClick={() => navigate('/plan')}>Plan my trip</button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="lp-hero" ref={heroRef}>
        <div className="lp-hero-bg">
          <div className="lp-hero-grain" />
          <div className="lp-hero-lines" />
        </div>
        <div className="lp-hero-inner">
          <div className="lp-hero-eyebrow">AI-powered slow travel planning</div>
          <h1 className="lp-hero-title">
            Travel like<br />
            a <em>local</em> knows<br />
            the secret.
          </h1>
          <p className="lp-hero-sub">
            Personalised itineraries built on a simple belief —
            the best places are never in the guidebook.
            Hidden cafes, nature trails, village stays and morning markets,
            curated by AI trained to avoid tourist traps.
          </p>
          <div className="lp-hero-ctas">
            <button className="lp-btn-primary" onClick={() => navigate('/plan')}>
              Plan my trip — it's free
            </button>
            <a href="#how-it-works" className="lp-btn-ghost">See how it works</a>
          </div>
          <div className="lp-hero-proof">
            <span>✦ No tourist traps</span>
            <span>✦ Ready in 3 minutes</span>
            <span>✦ Beautiful PDF</span>
          </div>
        </div>
        <div className="lp-hero-scroll-hint">scroll</div>
      </section>

      {/* ── How it works ── */}
      <section className="lp-section lp-how" id="how-it-works" ref={addRef}>
        <div className="lp-section-inner">
          <div className="lp-section-label">How it works</div>
          <h2 className="lp-section-title">Three steps.<br />One unforgettable trip.</h2>
          <div className="lp-steps">
            {STEPS.map(s => (
              <div key={s.num} className="lp-step" ref={addRef}>
                <div className="lp-step-num">{s.num}</div>
                <div className="lp-step-content">
                  <div className="lp-step-title">{s.title}</div>
                  <div className="lp-step-body">{s.body}</div>
                </div>
              </div>
            ))}
          </div>
          <button className="lp-btn-primary" style={{ marginTop: '2.5rem' }} onClick={() => navigate('/plan')}>
            Start planning →
          </button>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="lp-section lp-features" id="features" ref={addRef}>
        <div className="lp-section-inner">
          <div className="lp-section-label">Why WanderZenAI</div>
          <h2 className="lp-section-title">Not another<br />generic travel app.</h2>
          <div className="lp-features-grid">
            {FEATURES.map(f => (
              <div key={f.title} className="lp-feature" ref={addRef}>
                <div className="lp-feature-icon">{f.icon}</div>
                <div className="lp-feature-title">{f.title}</div>
                <div className="lp-feature-body">{f.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sample itinerary ── */}
      <section className="lp-section lp-sample" id="sample" ref={addRef}>
        <div className="lp-section-inner">
          <div className="lp-section-label">Sample plan</div>
          <h2 className="lp-section-title">Quiet Tokyo:<br />Mountains, Markets & Morning Mist</h2>
          <p className="lp-sample-sub">A real excerpt from a WanderZenAI-generated itinerary. Notice what's missing — no Shibuya crossing photo, no Senso-ji crowds.</p>
          <div className="lp-sample-cards">
            {SAMPLE_DAYS.map(d => (
              <div key={d.day} className="lp-sample-card" ref={addRef}>
                <div className="lp-sample-day-num">Day {d.day}</div>
                <div className="lp-sample-theme">{d.theme}</div>
                <div className="lp-sample-gem-label">Hidden gem</div>
                <div className="lp-sample-gem">{d.gem}</div>
                <div className="lp-sample-food-label">Where to eat</div>
                <div className="lp-sample-food">{d.food}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing preview ── */}
      <section className="lp-section lp-pricing" id="pricing" ref={addRef}>
        <div className="lp-section-inner">
          <div className="lp-section-label">Pricing</div>
          <h2 className="lp-section-title">Simple, honest pricing.</h2>
          <div className="lp-pricing-grid">
            <div className="lp-plan">
              <div className="lp-plan-name">Explorer</div>
              <div className="lp-plan-price">Free</div>
              <div className="lp-plan-period">1 itinerary per month</div>
              <ul className="lp-plan-features">
                <li>Full day-by-day plan</li>
                <li>Hidden gems every day</li>
                <li>PDF download</li>
                <li>Email delivery</li>
              </ul>
              <button className="lp-plan-btn" onClick={() => navigate('/plan')}>Get started free</button>
            </div>
            <div className="lp-plan lp-plan-featured">
              <div className="lp-plan-badge">Most popular</div>
              <div className="lp-plan-name">Wanderer</div>
              <div className="lp-plan-price">$9<span>/mo</span></div>
              <div className="lp-plan-period">5 itineraries per month</div>
              <ul className="lp-plan-features">
                <li>Everything in Free</li>
                <li>Longer detailed plans</li>
                <li>Priority generation</li>
                <li>Accommodation deep-dives</li>
                <li>Affiliate-free recommendations</li>
              </ul>
              <button className="lp-plan-btn lp-plan-btn-featured" onClick={() => navigate('/plan')}>Start planning</button>
            </div>
            <div className="lp-plan">
              <div className="lp-plan-name">Single plan</div>
              <div className="lp-plan-price">$7</div>
              <div className="lp-plan-period">One-time, one trip</div>
              <ul className="lp-plan-features">
                <li>Everything in Free</li>
                <li>No subscription</li>
                <li>Pay once, download forever</li>
              </ul>
              <button className="lp-plan-btn" onClick={() => navigate('/plan')}>Buy one plan</button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="lp-section lp-cta-final" ref={addRef}>
        <div className="lp-cta-inner">
          <h2 className="lp-cta-title">Your next adventure<br />starts here.</h2>
          <p className="lp-cta-sub">No tourist traps. No crowded itineraries. Just you and the real destination.</p>
          <button className="lp-btn-primary lp-btn-large" onClick={() => navigate('/plan')}>
            Plan my trip — free →
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-logo">WanderZen<span>AI</span></div>
          <div className="lp-footer-links">
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="https://instagram.com/wanderzenai">Instagram</a>
            <a href="mailto:hello@wanderzenai.com">Contact</a>
          </div>
          <div className="lp-footer-copy">© 2025 WanderZenAI. Built for slow travellers.</div>
        </div>
      </footer>
    </div>
  );
}
