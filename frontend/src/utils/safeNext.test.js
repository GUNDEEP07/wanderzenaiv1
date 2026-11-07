import { safeNext, nextQuery } from './safeNext';

test('allows same-site paths only', () => {
  expect(safeNext('/plan')).toBe('/plan');
  expect(safeNext('/blog/123?x=1')).toBe('/blog/123?x=1');
  for (const bad of ['//evil.com', '/\\evil.com', 'https://evil.com', 'javascript:alert(1)', '/', '', null, undefined, '/ plan', 'plan']) {
    expect(safeNext(bad)).toBe('/dashboard');
  }
  expect(safeNext('//evil.com', '/onboarding')).toBe('/onboarding');
});

test('nextQuery builds the query part, or nothing', () => {
  expect(nextQuery('/plan')).toBe('next=%2Fplan');
  expect(nextQuery('//evil.com')).toBe('');
});
