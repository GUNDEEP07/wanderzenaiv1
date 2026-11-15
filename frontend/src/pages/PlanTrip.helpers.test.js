import { travelerTypeOf, formForApi, stopsOf } from './PlanTrip';
import { resumeStep } from '../utils/planSteps';

jest.mock('../context/AuthContext', () => ({ useAuth: () => ({}) }));
jest.mock('../api/itinerary', () => ({}));
jest.mock('../components/plantrip/StepRoute', () => ({ __esModule: true, default: () => null, routeKey: () => '' }));
jest.mock('../components/plantrip/StepBasics', () => () => null);
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn(), useLocation: () => ({}) }));

test('traveller type comes from who is travelling (no separate question)', () => {
  expect(travelerTypeOf({ adults: 1, kids: [] })).toBe('Solo');
  expect(travelerTypeOf({ adults: 2, kids: [] })).toBe('Couple');
  expect(travelerTypeOf({ adults: 2, kids: [6] })).toBe('Family');
  expect(travelerTypeOf({ adults: 4 })).toBe('Group of friends');
});

test('dates are dropped when not fixed', () => {
  const f = formForApi({ datesFlexible: true, travelDate: '2026-12-25', travelDateEnd: '2026-12-29', tripPrefs: { adults: 2 } });
  expect([f.travelDate, f.travelDateEnd, f.travelerType]).toEqual(['', '', 'Couple']);
  expect(formForApi({ travelDate: '2026-12-25', tripPrefs: {} }).travelDate).toBe('2026-12-25');
});

test('stops carry their trip days; a town visited twice keeps its first visit', () => {
  const form = { destinations: [{ name: 'Vietnam' }], route: { bases: [
    { name: 'Hanoi', days: 2, lat: 21, lng: 105 }, { name: 'Sapa', days: 3 }, { name: 'Hanoi', days: 1 },
  ] } };
  expect(stopsOf(form).map(s => [s.name, s.fromDay, s.toDay, s.country])).toEqual([['Hanoi', 1, 2, 'Vietnam'], ['Sapa', 3, 5, 'Vietnam']]);
});

test('old saved plans resume at the matching new step', () => {
  expect([0, 1, 2, 3, 4, 5].map(n => resumeStep({}, n))).toEqual([0, 0, 1, 3, 2, 4]);
  expect(resumeStep({ planVersion: 3 }, 2)).toBe(2);
  expect(resumeStep({ planVersion: 3 }, 9)).toBe(4);
});
