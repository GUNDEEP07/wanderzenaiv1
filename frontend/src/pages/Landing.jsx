// Home page — design E (approved Nov 22 2026): say what we do in the first screen, show the real
// output, then help people choose. Copy is region-neutral; every route, count and "starting with …"
// comes from the curated data (regions.json / guides.json, live regions only), so switching on a
// new region updates this page with no copy change. Prices come from Stripe (GET /pricing).
// Phone gets its own simpler layout via Home.css (one idea per screen, sticky "Plan my trip").
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Landing.css';
import './Home.css';
import { usePricing } from '../hooks/usePricing';
import { plansFrom } from '../utils/plans';
import GUIDES from '../data/guides.json';
import { CreditedPhoto } from '../components/PhotoCredit';
import JsonLd from '../seo/JsonLd';
import {
  LIVE_COUNTRIES, liveRegionLabel, ORIGINS, MONTHS_LONG, guessOrigin, saveOrigin, currentMonth,
  rankCountries, inSeason, routeLine, planPrefill,
} from '../utils/seasons';

const LIVE_GUIDES = GUIDES.filter(g => LIVE_COUNTRIES.includes(g.name));
const ROUTE_COUNT = LIVE_GUIDES.reduce((n, g) => n + g.routes.length, 0);

// The example day in the first screen and the cards under "What you get": an illustration of the
// output's shape (labelled "Example"), taken from a curated route so the photo is a real place.
const EXAMPLE = {
  country: 'Vietnam', photoQuery: 'Ninh Binh, Vietnam', place: 'Ninh Binh', day: 4, of: 8,
  title: 'Boats before the crowds, a walk at golden hour',
  items: [
    ['7:00', 'River boat through the caves, before the tour buses'],
    ['10:30', 'A quiet café by the rice fields'],
    ['16:30', 'A short walk up to a viewpoint for sunset'],
  ],
};

const STEPS = [
  { label: 'Step 1 · 2 minutes', title: 'Tell us the trip', body: 'Where, how many days, who’s coming and your pace. No account needed to start.' },
  { label: 'Step 2', title: 'Pick your route', body: 'Choose a hand-picked route or let us suggest one, then change the towns and the days in each.' },
  { label: 'Step 3 · a few minutes', title: 'Get your plan', body: 'Watch it being written day by day. It arrives as a PDF and as a trip page on your phone.' },
];

const COMPARE = [
  ['Time to a full plan', 'Days of tabs', 'Minutes, then lots of checking', 'A few minutes'],
  ['A route with short travel days', 'You work it out', 'Often too many stops', 'Planned around your travel limit'],
  ['Right for the season you go', 'If you check', 'Rarely mentioned', 'Built in, per region'],
  ['Places that exist', 'Yes, but often dated', 'Sometimes invented', 'Matched to real listings'],
  ['Usable on the road', 'Screenshots', 'A long chat', 'Trip page, offline, opens on today'],
];

// Sample days (Kyoto). Kept to places that are well established; no restaurant names.
const SAMPLES = [
  { day: 1, query: 'Nanzenji temple Kyoto', theme: 'Dawn temples and quiet gardens', body: 'Nanzen-ji’s back gate at 6:30 am: mist on the canal, monks walking, almost nobody else. Then the Philosopher’s Path before the crowds.' },
  { day: 2, query: 'Fushimi Inari trail Kyoto', theme: 'Mountain paths and a local market', body: 'Fushimi Inari’s upper trails through the forest, where most visitors turn back. Lunch from a neighbourhood shopping street.' },
  { day: 3, query: 'Kiyomizu-dera lanes Kyoto', theme: 'Slow mornings, old lanes', body: 'The side lanes below Kiyomizu-dera early, past family homes and tiny shrines, before the souvenir shops open.' },
];

const FAQ = [
  ['Which countries can I plan?', `Any country. ${LIVE_GUIDES.length} also have hand-picked routes and guides, starting with ${liveRegionLabel()}, and more are added over time.`],
  ['Is it all written by AI?', 'Routes in the countries we cover are hand-picked. AI writes the days around your dates, pace and interests, and places are matched to real listings.'],
  ['Can I change the plan?', 'Yes. Pick the towns and days before it’s written, and rewrite up to three days afterwards with a note.'],
  ['Does it work with kids?', 'Yes. Tell us who’s coming: travel days stay short and kid-friendly routes come first.'],
];

/** Top routes for this visitor and month: one per country, in season first, closest first. */
export function homePicks(origin, month = currentMonth(), count = 3) {
  return rankCountries(GUIDES, { month, origin })
    .map(c => ({ country: c.name, hours: c.hours, route: c.routes[0], good: inSeason(c.routes[0], month) }))
    .filter(x => x.route)
    .slice(0, count);
}

export default function Landing() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const plans = plansFrom(usePricing());
  const [menuOpen, setMenuOpen] = useState(false);
  const [origin, setOrigin] = useState(() => guessOrigin());
  const month = currentMonth();
  const picks = useMemo(() => homePicks(origin, month), [origin, month]);
  const plan = () => navigate('/plan');
  const planRoute = (country, route) => navigate('/plan', { state: { prefill: planPrefill(country, route) } });

  const changeOrigin = (e) => {
    const o = ORIGINS.find(x => x.id === e.target.value);
    if (o) { saveOrigin(o.id); setOrigin({ ...o, guessed: false }); }
  };

  return (
    <div className="lp">
      {/* The questions below, as structured data for search and AI answer engines. */}
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
      }} />
      <header className="lp-header">
        <nav className="lp-nav" aria-label="Main">
          <a className="lp-logo" href="/">
            <span className="lp-logo-mark" aria-hidden="true">W</span>
            WanderZen<span className="lp-accent">AI</span>
          </a>
          <button type="button" className="lp-menu-btn" aria-label="Menu" aria-expanded={menuOpen} aria-controls="lp-links" onClick={() => setMenuOpen(o => !o)}>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <div id="lp-links" className={`lp-links${menuOpen ? ' lp-links--open' : ''}`}>
            <a href="/explore">Explore</a>
            <a href="/guides">Guides</a>
            <a href="#sample" onClick={() => setMenuOpen(false)}>Sample plan</a>
            <a href="/pricing">Pricing</a>
            {currentUser ? <a href="/dashboard">Dashboard</a> : <a href="/login">Sign in</a>}
            <button type="button" className="lp-btn lp-btn--small" onClick={plan}>Plan my trip</button>
          </div>
        </nav>
      </header>

      <main>
        {/* 1 · What we do, and what it looks like */}
        <section className="lp-wrap lp-hero" aria-labelledby="lp-hero-h">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">Slow travel planner</p>
            <h1 id="lp-hero-h" className="lp-h1">Your slow-travel plan, written day by day.</h1>
            <p className="lp-lede">
              Tell us where, when and who’s coming. In a few minutes you get a route with fewer stops and longer stays,
              places to stay close to nature, and every day planned around a quiet café and a short walk<span className="lp-desk-only">,
              as a PDF and a trip page that works offline</span>.
            </p>
            <div className="lp-actions">
              <button type="button" className="lp-btn" onClick={plan}>Plan my trip, free</button>
              <a className="lp-btn lp-btn--ghost lp-desk-only" href="#sample">See a sample plan</a>
            </div>
            <ul className="lp-trust">
              <li>✓ Day 1 free, no card</li>
              <li>✓ Hand-picked routes, any country</li>
              <li>✓ Pay per trip, no subscription</li>
            </ul>
          </div>
          <figure className="lp-phone" aria-label="Example of a trip day">
            <CreditedPhoto destination={EXAMPLE.country} keyword={EXAMPLE.photoQuery} size="hero" alt={`${EXAMPLE.place}, ${EXAMPLE.country}`} loading="eager" style={{ height: 200 }} corner="bottom-right" />
            <div className="lp-phone-body">
              <div className="lp-phone-meta"><span>Example · Day {EXAMPLE.day} of {EXAMPLE.of} · {EXAMPLE.place}</span><span className="lp-desk-only">Today</span></div>
              <p className="lp-phone-title">{EXAMPLE.title}</p>
              <ol className="lp-times">
                {EXAMPLE.items.map(([t, what]) => <li key={t}><span>{t}</span>{what}</li>)}
              </ol>
              <div className="lp-tags lp-desk-only">
                <span className="lp-tag lp-tag--teal">Directions</span><span className="lp-tag">Mark as done</span><span className="lp-tag">Works offline</span>
              </div>
            </div>
          </figure>
        </section>

        {/* 2 · What you get */}
        <section className="lp-band" aria-labelledby="lp-get-h">
          <div className="lp-wrap">
            <h2 id="lp-get-h" className="lp-h2">What you get</h2>
            <p className="lp-sub lp-desk-only">Not a list of sights. A trip you can actually follow, from the first booking to the last morning.</p>
            <ol className="lp-get">
              <li className="lp-card">
                <span className="lp-num" aria-hidden="true">1</span>
                <div>
                  <h3>A route that makes sense</h3>
                  <p>Fewer stops, short travel days, and right for the season you’re going in.</p>
                  <div className="lp-example lp-desk-only">
                    <div><span>● Hanoi</span><span>3 days</span></div>
                    <div><span>● Ninh Binh</span><span>3 days · 2 h by road</span></div>
                    <div><span>● Lan Ha Bay</span><span>2 days · 2.5 h</span></div>
                  </div>
                </div>
              </li>
              <li className="lp-card">
                <span className="lp-num" aria-hidden="true">2</span>
                <div>
                  <h3>Every day planned</h3>
                  <p>Times from morning to evening, a quiet café and a short walk, local food to try and the busy spots to skip.</p>
                  <div className="lp-example lp-desk-only">
                    <div><b>Skip:</b>&nbsp;the midday boat queue, go at 7 am</div>
                    <div><b>Stay:</b>&nbsp;a homestay among the rice fields</div>
                  </div>
                </div>
              </li>
              <li className="lp-card">
                <span className="lp-num" aria-hidden="true">3</span>
                <div>
                  <h3>Ready for the road</h3>
                  <p>A booking checklist in route order, a PDF to keep, and a trip page that opens on today and works offline.</p>
                  <div className="lp-example lp-desk-only">
                    <div><span>☑ Hanoi · 3 nights</span><span className="lp-accent">Stays</span></div>
                    <div><span>☐ Flights</span><span className="lp-accent">Flights</span></div>
                  </div>
                </div>
              </li>
            </ol>
          </div>
        </section>

        {/* 3 · Not sure where? (live regions, in season this month, closest to the visitor) */}
        <section className="lp-wrap lp-section" aria-labelledby="lp-where-h">
          <div className="lp-row">
            <div>
              <h2 id="lp-where-h" className="lp-h2">Not sure where yet?</h2>
              <p className="lp-sub">
                At their best in {MONTHS_LONG[month - 1]}, closest to{' '}
                <label htmlFor="lp-from" className="lp-visually-hidden">Planning from</label>
                <select id="lp-from" className="lp-select" value={origin.id} onChange={changeOrigin}>
                  {ORIGINS.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>{' '}first.
              </p>
            </div>
            <a className="lp-link lp-desk-only" href="/explore">See all {ROUTE_COUNT} hand-picked routes →</a>
          </div>
          <div className="lp-picks">
            {picks.map(({ country, hours, route, good }) => (
              <article key={route.id} className="lp-pick">
                <CreditedPhoto destination={country} keyword={route.photoQuery} size="card" alt={`${route.name}, ${country}`} style={{ height: 190 }} corner="bottom-right" />
                <div className="lp-pick-body">
                  <span className="lp-pick-meta">{country}{hours ? ` · about ${hours} h flight` : ''}{good ? '' : ` · best ${route.bestLabel}`}</span>
                  <h3>{route.name}</h3>
                  <span className="lp-pick-line">{routeLine(route)} · {route.days} days</span>
                  <button type="button" className="lp-link-btn" onClick={() => planRoute(country, route)} aria-label={`Plan ${route.name}, ${country}`}>Plan this route →</button>
                </div>
              </article>
            ))}
          </div>
          <a className="lp-link lp-mob-only" href="/explore">See more routes →</a>
        </section>

        {/* 4 · How it works */}
        <section className="lp-band" id="how" aria-labelledby="lp-how-h">
          <div className="lp-wrap">
            <h2 id="lp-how-h" className="lp-h2">How it works</h2>
            <ol className="lp-steps">
              {STEPS.map(st => (
                <li key={st.title} className="lp-card lp-step">
                  <span className="lp-step-label">{st.label}</span>
                  <h3>{st.title}</h3>
                  <p className="lp-desk-only">{st.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 5 · Why not Google it or ask a general AI chat? */}
        <section className="lp-wrap lp-section" aria-labelledby="lp-why-h">
          <h2 id="lp-why-h" className="lp-h2"><span className="lp-desk-only">Why not just Google it, or ask ChatGPT?</span><span className="lp-mob-only">Why not just Google it?</span></h2>
          <div className="lp-table-box lp-desk-only">
            <table className="lp-table">
              <thead>
                <tr><td /><th scope="col">Blogs and maps</th><th scope="col">A general AI chat</th><th scope="col" className="lp-accent">WanderZenAI</th></tr>
              </thead>
              <tbody>
                {COMPARE.map(([row, a, b, us]) => (
                  <tr key={row}><th scope="row">{row}</th><td>{a}</td><td>{b}</td><td className="lp-us">{us}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="lp-why-list lp-mob-only">
            <li><b>Minutes, not days of tabs.</b> One plan instead of twenty blogs.</li>
            <li><b>Places that exist.</b> Matched to real listings, unlike a general AI chat.</li>
            <li><b>Made for the road.</b> Opens on today and works offline.</li>
          </ul>
        </section>

        {/* 6 · Sample */}
        <section className="lp-band" id="sample" aria-labelledby="lp-sample-h">
          <div className="lp-wrap">
            <div className="lp-row">
              <div>
                <h2 id="lp-sample-h" className="lp-h2">What a few days look like</h2>
                <p className="lp-sub">A sample from a 7-day plan for Kyoto.</p>
              </div>
            </div>
            <div className="lp-picks lp-desk-only">
              {SAMPLES.map(sm => (
                <article key={sm.day} className="lp-pick">
                  <CreditedPhoto destination="Kyoto" keyword={sm.query} size="card" alt={sm.theme} style={{ height: 170 }} corner="bottom-right" />
                  <div className="lp-pick-body">
                    <span className="lp-step-label">Day {sm.day}</span>
                    <h3>{sm.theme}</h3>
                    <p className="lp-pick-line">{sm.body}</p>
                  </div>
                </article>
              ))}
            </div>
            <div className="lp-mob-only lp-sample-mob">
              <p className="lp-pick-line"><b>Day 1 · {SAMPLES[0].theme}.</b> {SAMPLES[0].body}</p>
            </div>
          </div>
        </section>

        {/* 7 · Pricing (Stripe) */}
        <section className="lp-wrap lp-section" aria-labelledby="lp-price-h">
          <h2 id="lp-price-h" className="lp-h2">Try it free. Pay per trip.</h2>
          <p className="lp-sub">No subscription. The currency is shown with every price.</p>
          <ul className="lp-prices">
            {plans.map(p => (
              <li key={p.name} className={`lp-price${p.featured ? ' lp-price--featured' : ''}`}>
                <div>
                  <span className="lp-price-name">{p.name}</span>
                  <span className="lp-price-note">{p.period}</span>
                </div>
                <span className="lp-price-amount">
                  {p.priceParts.main}{p.priceParts.code && <small> {p.priceParts.code}</small>}
                </span>
              </li>
            ))}
          </ul>
          <a className="lp-link" href="/pricing">What’s in each plan →</a>
        </section>

        {/* 8 · Questions */}
        <section className="lp-band" aria-labelledby="lp-faq-h">
          <div className="lp-wrap lp-narrow">
            <h2 id="lp-faq-h" className="lp-h2">Questions</h2>
            {FAQ.map(([q, a]) => (
              <details key={q} className="lp-faq"><summary>{q}</summary><p>{a}</p></details>
            ))}
          </div>
        </section>

        {/* 9 · Close, over a live route's photo */}
        <section className="lp-close" aria-labelledby="lp-close-h">
          {LIVE_GUIDES[0] && (
            <CreditedPhoto destination={LIVE_GUIDES[0].name} keyword={LIVE_GUIDES[0].routes[0].photoQuery} size="hero" alt="" style={{ position: 'absolute', inset: 0 }} corner="bottom-right" />
          )}
          <div className="lp-close-inner">
            <h2 id="lp-close-h" className="lp-h2 lp-close-h">Plan fewer places. Stay longer. Start with Day 1, free.</h2>
            <button type="button" className="lp-btn" onClick={plan}>Plan my trip, free</button>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-inner">
          <div className="lp-footer-links">
            <a href="/explore">Explore</a>
            <a href="/guides">Guides</a>
            <a href="/blog">Stories</a>
            <a href="/pricing">Pricing</a>
            <a href="/contact">Contact</a>
            <a href="/contact?type=partnership">For agencies</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="https://instagram.com/wanderzenai">Instagram</a>
          </div>
          <div className="lp-footer-links" aria-label="Slow travel guides">
            {/* Every guide, live regions first (internal links help search engines find them). */}
            {[...LIVE_GUIDES, ...GUIDES.filter(g => !LIVE_COUNTRIES.includes(g.name))].map(g => <a key={g.slug} href={`/guides/${g.slug}`}>{g.name}</a>)}
          </div>
          <div className="lp-footer-copy">© {new Date().getFullYear()} WanderZenAI · Built for slow travellers</div>
        </div>
      </footer>

      {/* Phone only: the one action, always in reach */}
      <div className="lp-sticky lp-mob-only">
        <button type="button" className="lp-btn lp-btn--block" onClick={plan}>Plan my trip, free</button>
      </div>
    </div>
  );
}
