import { formatPrice } from '../api/pricing';
import { passTerm } from '../hooks/usePricing';

// Pricing design D (approved Nov 16 2026): pay per trip, or a Trip Pass for several trips.
// Prices, currencies and payment links come from Stripe via GET /pricing — never hard-coded.
// The $9/month Wanderer plan is off sale; existing subscribers keep it (Settings → billing).
export function plansFrom({ trip, pass, loading }) {
  const price = (p) => (p ? formatPrice(p.amount, p.currency) : loading ? '…' : '—');
  // Big number + small currency code on cards ("A$19" / "AUD"), so the price never wraps.
  const parts = (p) => (p ? { main: formatPrice(p.amount, p.currency).replace(/\s+[A-Z]{3}$/, ''), code: p.currency } : { main: price(p), code: '' });
  return [
    {
      name: 'Try it',
      price: 'Free',
      priceParts: { main: 'Free', code: '' },
      period: 'every month',
      features: ['Your route, ready to confirm', 'Day 1 written in full', 'Every later day’s theme and base', 'Any destination worldwide'],
      cta: 'Plan a trip free',
      link: null,
      featured: false,
    },
    {
      name: trip?.name || 'One trip',
      price: price(trip),
      priceParts: parts(trip),
      period: 'one-time · per trip',
      features: ['Every day unlocked', 'Where to stay, tips & traps to skip', 'Adjust up to 3 days', 'PDF + offline trip page', 'Or unlock a free trip you made', 'Never expires'],
      cta: 'Unlock one trip',
      link: trip?.url || null,
      buy: true,
      featured: true,
    },
    {
      name: pass?.name || 'Trip Pass',
      price: price(pass),
      priceParts: parts(pass),
      period: pass ? `one-time · ${passTerm(pass)}` : 'one-time',
      features: [pass ? `${pass.trips} full trips` : 'Several full trips', 'Everything in One trip', 'No subscription, no auto-renew', 'Use them on any destinations'],
      cta: 'Get the Trip Pass',
      link: pass?.url || null,
      buy: true,
      featured: false,
    },
  ];
}
