/**
 * The CloudFront viewer-request function, exactly as deployed: the code is read from
 * infra/template.yaml (FrontendRewriteFunction) and run here.
 */
const fs = require('fs');
const path = require('path');

function loadHandler() {
  const yaml = fs.readFileSync(path.resolve(__dirname, '../../../infra/template.yaml'), 'utf8').split('\n');
  const start = yaml.findIndex((l) => /^\s+FunctionCode: \|\s*$/.test(l));
  expect(start).toBeGreaterThan(-1);
  const indent = yaml[start + 1].match(/^\s*/)[0].length;
  const body = [];
  for (let i = start + 1; i < yaml.length; i++) {
    const l = yaml[i];
    if (l.trim() && l.match(/^\s*/)[0].length < indent) break;
    body.push(l.slice(indent));
  }
  // eslint-disable-next-line no-new-func
  return new Function(`${body.join('\n')}\nreturn handler;`)();
}

const handler = loadHandler();
const req = (uri, querystring = {}) => handler({ request: { uri, querystring, headers: {} } });

test('home and files pass through', () => {
  expect(req('/').uri).toBe('/index.html');
  expect(req('/assets/index-abc.js').uri).toBe('/assets/index-abc.js');
  expect(req('/sitemap.xml').uri).toBe('/sitemap.xml');
  expect(req('/og-image.png').uri).toBe('/og-image.png');
});

test('public pages map to their prerendered file', () => {
  expect(req('/pricing').uri).toBe('/pricing/index.html');
  expect(req('/guides/vietnam').uri).toBe('/guides/vietnam/index.html');
  expect(req('/blog/vietnam-slowly-08a02053').uri).toBe('/blog/vietnam-slowly-08a02053/index.html');
  expect(req('/no-such-page').uri).toBe('/no-such-page/index.html'); // missing → 404.html with 404
});

test('app pages get the shell', () => {
  for (const u of ['/plan', '/dashboard', '/settings', '/login', '/signup', '/admin/blog', '/itinerary/abc', '/confirmation', '/onboarding', '/agency']) {
    expect(req(u).uri).toBe('/_shell.html');
  }
  expect(req('/planner-tips').uri).toBe('/planner-tips/index.html'); // not an app page
});

test('trailing slash → 301 to the canonical address, query kept', () => {
  const r = req('/blog/', { page: { value: '2' }, tag: { value: 'a', multiValue: [{ value: 'a' }, { value: 'b' }] } });
  expect(r.statusCode).toBe(301);
  expect(r.headers.location.value).toBe('/blog?page=2&tag=a&tag=b');
  expect(req('/guides///').headers.location.value).toBe('/guides');
});
