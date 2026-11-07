// Times the route Claude call: old single call (3 routes) vs new parallel one-route calls.
const r = require('./route-plan.js');
const KEY = process.env.CLAUDE_API_KEY;
const call = async (prompt, textTokens) => {
  const t = Date.now();
  const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: textTokens, output_config: { effort: 'low' }, messages: [{ role: 'user', content: prompt }] }) });
  const j = await res.json();
  const ms = Date.now() - t;
  if (!res.ok) return { ms, error: JSON.stringify(j.error) };
  const text = j.content.filter(b => b.type === 'text').map(b => b.text).join('');
  let routes = '';
  try { routes = r.parseRouteOptions(text, 7).map(o => `${o.name}: ${o.bases.map(b => `${b.name} ${b.days}`).join(' > ')} (max ${o.longestTransferHours} h)`).join(' | '); } catch (e) { routes = 'PARSE FAIL ' + e.message; }
  return { ms, out: j.usage.output_tokens, stop: j.stop_reason, routes };
};
(async () => {
  for (const [dest, prefs, more] of [['Vietnam', { kids: [3], transferComfort: 'short' }, true], ['Peru', { kids: [], transferComfort: 'medium' }, false]]) {
    const input = { destination: dest, days: 7, travelPace: 'balanced', interests: 'Hiking, Food tours', prefs: r.sanitizePrefs(prefs), avoid: more ? ['Central coast, easy pace', 'The north, slowly', 'Classic north + centre'] : [] };
    console.log(`\n== ${dest} 7d ${JSON.stringify(prefs)} more=${more}`);
    const old = await call(r.buildRouteOptionsPrompt({ ...input, count: 3 }), 5600);
    console.log('OLD 1 call x3 routes:', JSON.stringify(old));
    const t = Date.now();
    const res = await Promise.all(r.routeAngles({ more, curated: false }).map(a => call(r.buildRouteOptionsPrompt({ ...input, angle: a }), 3500).then(x => ({ a, ...x }))));
    console.log(`NEW ${res.length} parallel calls, wall ${Date.now() - t} ms`);
    res.forEach(x => console.log('  ', JSON.stringify(x)));
  }
})();
