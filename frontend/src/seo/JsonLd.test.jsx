import { render } from '@testing-library/react';
import { readFileSync } from 'fs';
import path from 'path';
import JsonLd from './JsonLd';

test('renders valid JSON-LD and cannot be broken out of the script tag', () => {
  const { container } = render(<JsonLd data={{ '@type': 'Thing', name: '</script><img src=x onerror=alert(1)>' }} />);
  const el = container.querySelector('script[type="application/ld+json"]');
  expect(el.innerHTML).not.toMatch(/<\/script>/i);
  expect(JSON.parse(el.innerHTML).name).toBe('</script><img src=x onerror=alert(1)>');
  expect(render(<JsonLd data={null} />).container.innerHTML).toBe('');
});

test('llms.txt is generated from the route data: every guide, best months, no prices', () => {
  const txt = readFileSync(path.join(__dirname, '../../public/llms.txt'), 'utf8');
  const guides = JSON.parse(readFileSync(path.join(__dirname, '../data/guides.json'), 'utf8'));
  expect(txt.startsWith('# WanderZenAI\n\n> ')).toBe(true);
  for (const g of guides) expect(txt).toContain(`(https://www.wanderzenai.com/guides/${g.slug})`);
  expect(txt).toMatch(/best [A-Z][a-z]{2}/);
  expect(txt).not.toMatch(/\$\d|AUD|USD/);
});
