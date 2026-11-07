import { chatTripToPrefill } from './chatHandoff';

test('a launch country becomes the country chip with coordinates; kids carried into who\'s travelling', () => {
  const p = chatTripToPrefill({ destination: 'Sri Lanka', days: 7, travelerType: 'Family', adults: 2, kids: [4], travelStyle: ['Nature', 'Foodie'], budget: 'Mid-range' });
  expect(p.destinations[0]).toMatchObject({ name: 'Sri Lanka', country: 'Sri Lanka', isCountry: true });
  expect(p.destinations[0].lat).not.toBe(0);
  expect(p.tripPrefs).toMatchObject({ adults: 2, kids: [4], overnightOk: false });
  expect(p.interests).toBe('Nature, Foodie'); // Step 1 requires interests
  expect(p.budget).toBe('3000');
});

test('other places pass through; adults inferred from traveller type; bad values clamped', () => {
  const p = chatTripToPrefill({ destination: 'Oaxaca, Mexico', days: 99, travelerType: 'Solo', kids: ['x', 40, 3] });
  expect(p.destinations).toEqual([{ name: 'Oaxaca', lat: 0, lng: 0 }]);
  expect(p.days).toBe(30);
  expect(p.tripPrefs.adults).toBe(1);
  expect(p.tripPrefs.kids).toEqual([17, 3]);
  expect(p.travelerType).toBe('Solo');
});

test('kids without a traveller type → Family; empty trip still yields a usable form', () => {
  expect(chatTripToPrefill({ kids: [2] }).travelerType).toBe('Family');
  const empty = chatTripToPrefill();
  expect(empty).toMatchObject({ destinations: [], days: 5, budget: '3000' });
  expect(empty.tripPrefs.adults).toBe(2);
});
