import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Seo from './Seo';
import { canonicalUrl, clip } from './site';
import { prepareRoot, markPageReady, _reset } from './ready';

const head = (sel) => document.head.querySelector(sel);

test('sets title, description, canonical, og and json-ld without duplicates', () => {
  document.head.innerHTML = '<meta name="description" content="old"><link rel="canonical" href="https://www.wanderzenai.com/">';
  const { rerender } = render(
    <MemoryRouter initialEntries={['/guides/vietnam?x=1']}>
      <Seo title="Vietnam guide" description="Three routes." jsonLd={{ '@type': 'Thing', name: '</script>' }} />
    </MemoryRouter>
  );
  expect(document.title).toBe('Vietnam guide | WanderZenAI');
  expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
  expect(head('meta[name="description"]').content).toBe('Three routes.');
  expect(head('link[rel="canonical"]').href).toBe('https://www.wanderzenai.com/guides/vietnam');
  expect(head('meta[property="og:url"]').content).toBe('https://www.wanderzenai.com/guides/vietnam');
  expect(head('meta[name="robots"]').content).toMatch(/^index/);
  expect(head('script[data-seo-jsonld]').textContent).not.toContain('</script>');

  rerender(<MemoryRouter><Seo title="Sign in" noindex /></MemoryRouter>);
  expect(head('meta[name="robots"]').content).toBe('noindex, nofollow');
  expect(head('link[rel="canonical"]')).toBeNull();
  expect(head('script[data-seo-jsonld]')).toBeNull();
});

test('canonical and clip helpers', () => {
  expect(canonicalUrl('/')).toBe('https://www.wanderzenai.com/');
  expect(canonicalUrl('/blog/')).toBe('https://www.wanderzenai.com/blog');
  expect(canonicalUrl('/pricing?ref=x#top')).toBe('https://www.wanderzenai.com/pricing');
  const long = 'word '.repeat(60);
  expect(clip(long).length).toBeLessThanOrEqual(158);
  expect(clip(long).endsWith('…')).toBe(true);
  expect(clip('short')).toBe('short');
});

test('prerendered copy stays until the page is ready', () => {
  jest.useFakeTimers();
  _reset();
  document.documentElement.dataset.prerendered = 'true';
  document.body.innerHTML = '<div id="root"><h1>Saved copy</h1></div>';
  const live = prepareRoot(document);
  expect(live.id).toBe('root');
  expect(document.getElementById('prerendered-root')).not.toBeNull();
  expect(live.style.visibility).toBe('hidden');
  markPageReady();
  jest.runAllTimers();
  expect(document.getElementById('prerendered-root')).toBeNull();
  expect(live.style.visibility).toBe('');
  jest.useRealTimers();
  delete document.documentElement.dataset.prerendered;
});

test('no prerendered copy: renders straight into #root', () => {
  _reset();
  document.body.innerHTML = '<div id="root"></div>';
  expect(prepareRoot(document)).toBe(document.getElementById('root'));
});
