import { priceLines } from '../../utils/plans';

const s = {
  note: { display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 10px', margin: '0 0 14px', padding: '10px 14px', borderRadius: 12, background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.25)', fontSize: 14, lineHeight: 1.45, color: 'rgba(255,255,255,0.85)' },
  link: { color: '#00d4aa', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' },
};

/** One line on step 1 so nobody plans without knowing the cost. Hidden until Stripe prices load. */
export default function PriceNote({ pricing }) {
  const p = priceLines(pricing);
  if (!p) return null;
  return (
    <p style={s.note} data-testid="price-note">
      <span>Free: your route and Day 1. Every day: <b>{p.trip}</b>.</span>
      <a href="/pricing" target="_blank" rel="noopener noreferrer" style={s.link}>See pricing</a>
    </p>
  );
}
