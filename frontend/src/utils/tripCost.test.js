import { tripCost, budgetCheck, money } from './tripCost';

const plan = [{ name: 'Queenstown', country: 'New Zealand', nights: 3 }, { name: 'Te Anau', country: 'New Zealand', nights: 1 }, { name: 'Last', country: 'NZ', nights: 0 }];
const estimates = {
  'Queenstown, New Zealand': { currency: 'AUD', stays: [{ style: 'homestay', label: 'Homestay', low: 180, high: 260 }, { style: 'boutique', label: 'Boutique', low: 320, high: 450 }], flights: { cheapest: { low: 400, high: 500 }, direct: { low: 550, high: 650 } } },
  'Te Anau, New Zealand': { currency: 'AUD', stays: [{ style: 'homestay', label: 'Motel', low: 170, high: 240 }] },
};

test('stays × nights × rooms, flights × seats; first option by default', () => {
  const c = tripCost({ plan, estimates, adults: 2, firstLabel: 'Queenstown, New Zealand' });
  expect(c.rooms).toBe(1);
  expect(c.stays.map((s) => [s.name, s.low, s.high])).toEqual([['Queenstown', 540, 780], ['Te Anau', 170, 240]]);
  expect(c.flights).toMatchObject({ kind: 'cheapest', low: 800, high: 1000 });
  expect([c.low, c.high, c.mid]).toEqual([1510, 2020, 1770]);
});

test('choices: boutique stay, direct flights; 3 adults need 2 rooms, kids add seats', () => {
  const c = tripCost({ plan, estimates, stayChoices: { 'Queenstown, New Zealand': 'boutique' }, flightChoice: 'direct', adults: 3, kids: 1, firstLabel: 'Queenstown, New Zealand' });
  expect(c.rooms).toBe(2);
  expect(c.stays[0]).toMatchObject({ low: 320 * 3 * 2, high: 450 * 3 * 2 });
  expect(c.flights).toMatchObject({ kind: 'direct', seats: 4, low: 2200 });
});

test('direct asked but none exist → cheapest; no estimates yet → counted as missing', () => {
  const e = { ...estimates, 'Queenstown, New Zealand': { ...estimates['Queenstown, New Zealand'], flights: { cheapest: { low: 400, high: 500 }, direct: null } } };
  expect(tripCost({ plan, estimates: e, flightChoice: 'direct', firstLabel: 'Queenstown, New Zealand' }).flights.kind).toBe('cheapest');
  const none = tripCost({ plan, estimates: {}, firstLabel: 'x' });
  expect(none.missingStays).toBe(2);
  expect(none.flights).toBeNull();
});

test('budget check only for whole-trip budgets', () => {
  expect(budgetCheck({ mid: 2600 }, 3000, 'full-trip', 5)).toEqual({ budget: 3000, left: 400, perDay: 80, over: false });
  expect(budgetCheck({ mid: 3600 }, 3000, 'full-trip', 5).over).toBe(true);
  expect(budgetCheck({ mid: 2600 }, 3000, 'activities', 5)).toBeNull();
  expect(budgetCheck({ mid: 2600 }, '', 'full-trip', 5)).toBeNull();
  expect(money(2650, 'AUD')).toBe('A$2,650');
});
