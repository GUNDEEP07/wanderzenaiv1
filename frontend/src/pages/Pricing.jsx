import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { withCheckoutIdentity } from '../utils/paymentLink';
import { usePricing } from '../hooks/usePricing';
import { plansFrom } from '../utils/plans';
import JsonLd from '../seo/JsonLd';
import './Pricing.css';

const s = {
  page: { minHeight: '100vh', background: '#0a0f1e', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#fff' },
  inner: { maxWidth: 1100, margin: '0 auto', padding: '5rem 1.5rem 6rem' },
  notice: { background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)', borderRadius: 12, padding: '1rem 1.5rem', marginBottom: '2.5rem', fontSize: '0.95rem', color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  header: { textAlign: 'center', marginBottom: '4rem' },
  eyebrow: { display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#00d4aa', marginBottom: '1.25rem', padding: '6px 16px', border: '1px solid rgba(0,212,170,0.25)', borderRadius: 100, background: 'rgba(0,212,170,0.08)' },
  title: { fontFamily: "'Fraunces', serif", fontSize: 'clamp(2.5rem, 6vw, 4rem)', fontWeight: 700, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '1rem' },
  sub: { fontSize: '1.1rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, maxWidth: 520, margin: '0 auto' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '5rem', alignItems: 'start' },
  card: (featured) => ({
    background: featured ? 'linear-gradient(135deg, #141d33 0%, rgba(0,212,170,0.06) 100%)' : '#111827',
    border: `1px solid ${featured ? '#00d4aa' : 'rgba(255,255,255,0.08)'}`,
    borderRadius: 20, padding: '2.5rem',
    position: 'relative', overflow: 'hidden',
    transition: 'all 0.3s',
  }),
  cardTop: (featured) => ({
    content: '', position: 'absolute',
    top: 0, left: 0, right: 0, height: 2,
    background: featured ? 'linear-gradient(90deg, transparent, #00d4aa, transparent)' : 'transparent',
  }),
  badge: { position: 'absolute', top: -1, right: 24, background: '#00d4aa', color: '#0a0f1e', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 14px', borderRadius: '0 0 8px 8px' },
  planName: { fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: '1rem' },
  price: { fontFamily: "'Fraunces', serif", fontSize: '3.5rem', fontWeight: 700, color: '#fff', lineHeight: 1, letterSpacing: '-0.03em', marginBottom: '0.25rem' },
  priceSub: { fontSize: '1rem', fontWeight: 400, color: 'rgba(255,255,255,0.6)' },
  period: { fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)', marginBottom: '2rem', marginTop: '0.25rem' },
  features: { listStyle: 'none', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  featureItem: { fontSize: '0.95rem', color: 'rgba(255,255,255,0.65)', display: 'flex', alignItems: 'flex-start', gap: 10 },
  check: { color: '#00d4aa', flexShrink: 0, fontWeight: 700, marginTop: 1 },
  btnOutline: { width: '100%', padding: '0.9rem', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '0.95rem', fontWeight: 700, borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s', background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', letterSpacing: '-0.01em' },
  btnFilled: { width: '100%', padding: '0.9rem', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '0.95rem', fontWeight: 700, borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s', background: '#00d4aa', color: '#0a0f1e', border: 'none', letterSpacing: '-0.01em' },
  faqSection: { maxWidth: 800, margin: '0 auto 4rem' },
  faqTitle: { fontFamily: "'Fraunces', serif", fontSize: '2rem', fontWeight: 700, color: '#fff', textAlign: 'center', marginBottom: '2.5rem', letterSpacing: '-0.02em' },
  faqGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1rem' },
  faqItem: { background: '#111827', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '1.5rem', cursor: 'pointer', transition: 'border-color 0.2s' },
  faqQ: { fontSize: '1rem', fontWeight: 600, color: '#fff', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  faqA: { fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 },
  footer: { textAlign: 'center', fontSize: '0.875rem', color: 'rgba(255,255,255,0.55)' },
  footerLink: { color: '#00d4aa', textDecoration: 'none' },
};


const FAQS = [
  { q: 'How long does it take?', a: 'Your itinerary is generated and emailed about 5 minutes after you submit the form.' },
  { q: 'What format is the itinerary?', a: 'A beautifully designed PDF — print-ready with day cards, hidden gems, local food picks and cost breakdown.' },
  { q: 'Can I request any destination?', a: 'Yes — any city, region or country worldwide. The more specific your interests, the better the plan.' },
  { q: 'What makes this different?', a: 'We avoid tourist traps by design. Every plan includes hidden gems, local eats and off-the-beaten-path stays that most guides never mention.' },
  { q: 'Can I get my itinerary in another language?', a: 'Yes — choose from English, Hindi, Spanish, French, German, Japanese, Arabic, Portuguese, Italian and Dutch.' },
  { q: 'Is there a subscription?', a: 'No. You pay once for one trip, or once for a Trip Pass — nothing renews. On the older Wanderer monthly plan? You can cancel any time in Settings, and every itinerary you made is yours to keep.' },
  { q: 'Which currency are the prices in?', a: 'The currency is written next to every price. Stripe charges in that currency; if your card is in another one, your bank converts it.' },
  { q: 'How long does a Trip Pass last?', a: 'The time shown on the pass, counted from the day you buy it. Trips you don’t use by then expire; a single One trip never expires.' },
  { q: 'Do you store my payment details?', a: 'No — payments are handled entirely by Stripe. We never see or store your card details.' },
  { q: 'What if my itinerary fails?', a: 'Rare, but if it happens we regenerate it for free. Email travel@wanderzenai.com and we will sort it within the hour.' },
];

export default function Pricing() {
  const navigate = useNavigate();
  const location = useLocation();
  const reason = location.state?.reason;
  const [openFaq, setOpenFaq] = useState(null);
  const { currentUser } = useAuth();
  const pricing = usePricing();
  const PLANS = plansFrom(pricing);

  const handleCta = (plan) => {
    if (plan.buy && !plan.link) return; // prices still loading or unavailable
    if (!plan.link) { navigate('/plan'); return; }
    // A purchase must be tied to an account, or the webhook can't grant it.
    if (!currentUser) { navigate('/login', { state: { from: '/pricing' } }); return; }
    window.location.href = withCheckoutIdentity(plan.link, currentUser);
  };

  // Plans as structured data once Stripe's prices have loaded (the prerendered copy carries them).
  const paid = [pricing.trip, pricing.pass].filter(Boolean);
  const offersLd = paid.length ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'WanderZenAI trip plans',
    description: 'Slow-travel trip plans written day by day. Day 1 free; pay per trip or buy a Trip Pass.',
    brand: { '@type': 'Brand', name: 'WanderZenAI' },
    offers: [
      { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: paid[0].currency, description: 'Your route and Day 1 in full, every month', url: 'https://www.wanderzenai.com/pricing' },
      ...paid.map(p => ({
        '@type': 'Offer',
        name: p.name,
        price: String(p.amount),
        priceCurrency: p.currency,
        description: p.plan === 'pass' ? `${p.trips} full trips to use within ${p.validDays} days` : 'One full trip, never expires',
        url: 'https://www.wanderzenai.com/pricing',
        availability: 'https://schema.org/InStock',
      })),
    ],
  } : null;

  return (
    <div style={{...s.page, margin: 0, padding: 0, minHeight: '100vh', background: '#0a0f1e'}}>
      <JsonLd data={offersLd} />
      <style>{`
        * { box-sizing: border-box; }
        .plan-card:hover { transform: translateY(-4px); box-shadow: 0 24px 48px rgba(0,0,0,0.4); }
        .faq-item:hover { border-color: rgba(0,212,170,0.25) !important; }
        .btn-outline:hover { border-color: rgba(255,255,255,0.3) !important; background: rgba(255,255,255,0.05) !important; }
        .btn-filled:hover { background: #fff !important; transform: translateY(-1px); }
      `}</style>

      <nav className="pricing-nav" style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 var(--desktop-pad, 2.5rem)', background: 'rgba(10,15,30,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'sticky', top: 0, zIndex: 100 }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg,#00d4aa,#00916a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#0a0f1e', boxShadow: '0 0 12px rgba(0,212,170,0.3)' }}>W</div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>WanderZenAI</span>
        </a>
        <button onClick={() => navigate('/plan')} style={{ padding: '6px 14px', borderRadius: 8, background: '#00d4aa', color: '#0a0f1e', border: 'none', fontFamily: 'inherit', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
          Plan trip →
        </button>
      </nav>

      <div style={s.inner}>
        {reason === 'monthly_limit' && (
          <div style={{
            background: 'linear-gradient(135deg,rgba(0,212,170,0.1),rgba(0,168,126,0.06))',
            border: '1px solid rgba(0,212,170,0.3)',
            borderRadius: 16,
            padding: '24px 28px',
            marginBottom: 40,
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#00d4aa', marginBottom: 8 }}>
              Monthly limit reached
            </div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 6, lineHeight: 1.2 }}>
              You've used this month's 5 Wanderer itineraries
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
              They reset on your next billing date. Need one sooner? One trip adds an itinerary that
              never expires — your {location.state?.destination || 'next destination'} itinerary can generate straight after.
            </div>
          </div>
        )}

        {reason === 'unlock' && (
          <div style={{
            background: 'linear-gradient(135deg,rgba(0,212,170,0.1),rgba(0,168,126,0.06))',
            border: '1px solid rgba(0,212,170,0.3)',
            borderRadius: 16,
            padding: '24px 28px',
            marginBottom: 40,
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#00d4aa', marginBottom: 8 }}>
              Unlock your trip
            </div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 6, lineHeight: 1.2 }}>
              {location.state?.destination ? <>Every day of your {location.state.destination} trip is written</> : <>The rest of your trip is written</>}
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
              Unlocking uses one trip. Get One trip or a Trip Pass below, then open the trip from your
              dashboard and tap “Unlock the full trip” — every day opens straight away.
            </div>
          </div>
        )}

        {reason === 'free_limit' && (
          <div style={{
            background: 'linear-gradient(135deg,rgba(0,212,170,0.1),rgba(0,168,126,0.06))',
            border: '1px solid rgba(0,212,170,0.3)',
            borderRadius: 16,
            padding: '24px 28px',
            marginBottom: 40,
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)', fontSize: 64, color: 'rgba(0,212,170,0.06)', pointerEvents: 'none' }}>✦</div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#00d4aa', marginBottom: 8 }}>
              Free plan limit reached
            </div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 6, lineHeight: 1.2 }}>
              {location.state?.destination
                ? <>Your {location.state.destination} itinerary is waiting</>
                : <>Your itinerary is ready to be built</>}
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 18, lineHeight: 1.6 }}>
              You've used your free itinerary this month.
              Get One trip, or a Trip Pass if you plan more — your {location.state?.destination || 'next destination'} itinerary will generate immediately after.
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {['Pay per trip', 'Every day unlocked', 'No subscription', 'Keep all PDFs'].map(f => (
                <span key={f} style={{ padding: '5px 12px', background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#00d4aa' }}>
                  ✓ {f}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={s.header}>
          <div style={s.eyebrow}>Pricing</div>
          <h1 style={s.title}>Simple, honest pricing.</h1>
          <p style={s.sub}>Pay per trip — no subscription. Your PDF is yours to keep forever.</p>
        </div>

        <div style={s.grid} className="pricing-cards-grid">
          {PLANS.map(plan => (
            <div
              key={plan.name}
              className="plan-card"
              style={s.card(plan.featured)}
            >
              {plan.featured && (
                <>
                  <div style={s.cardTop(true)} />
                  <div style={s.badge}>No subscription</div>
                </>
              )}
              <div style={s.planName}>{plan.name}</div>
              <div style={s.price}>
                {plan.priceParts.main}
                {plan.priceParts.code && <span style={{ ...s.priceSub, marginLeft: 8, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, letterSpacing: '0.04em' }}>{plan.priceParts.code}</span>}
              </div>
              <div style={s.period}>{plan.period}</div>
              <ul style={s.features}>
                {plan.features.map(f => (
                  <li key={f} style={s.featureItem}>
                    <span style={s.check}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <button
                className={plan.featured ? 'btn-filled' : 'btn-outline'}
                style={{ ...(plan.featured ? s.btnFilled : s.btnOutline), ...(plan.buy && !plan.link ? { opacity: 0.5, cursor: 'default' } : {}) }}
                disabled={plan.buy && !plan.link}
                onClick={() => handleCta(plan)}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        {pricing.error && (
          <p style={{ ...s.footer, marginTop: '-3.5rem', marginBottom: '3rem' }}>
            Prices couldn’t load just now — refresh in a minute, or email us.
          </p>
        )}
        {!pricing.error && (pricing.trip || pricing.pass) && (
          <p style={{ ...s.footer, marginTop: '-3.5rem', marginBottom: '3rem' }}>
            Prices in {[...new Set([pricing.trip, pricing.pass].filter(Boolean).map(p => p.currency))].join(' / ')}, charged by Stripe. Your bank may convert to your own currency.
          </p>
        )}

        <div style={s.faqSection}>
          <h2 style={s.faqTitle}>Common questions</h2>
          <div style={s.faqGrid} className="pricing-faq-grid">
            {FAQS.map((faq, i) => (
              <div
                key={faq.q}
                className="faq-item"
                style={s.faqItem}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <div style={s.faqQ}>
                  <span>{faq.q}</span>
                  <span style={{ color: '#00d4aa', fontSize: '1.1rem', flexShrink: 0 }}>
                    {openFaq === i ? '−' : '+'}
                  </span>
                </div>
                {openFaq === i && <div style={s.faqA}>{faq.a}</div>}
              </div>
            ))}
          </div>
        </div>

        <div style={s.footer}>
          <p>Questions? Email <a href="mailto:travel@wanderzenai.com" style={s.footerLink}>travel@wanderzenai.com</a></p>
          <p style={{ marginTop: '0.5rem' }}>
            <a href="/privacy" style={{ ...s.footerLink, color: 'rgba(255,255,255,0.55)', marginRight: '1.5rem' }}>Privacy</a>
            <a href="/terms" style={{ ...s.footerLink, color: 'rgba(255,255,255,0.55)' }}>Terms</a>
          </p>
        </div>
      </div>
    </div>
  );
}
