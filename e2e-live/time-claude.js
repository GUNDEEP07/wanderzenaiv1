// Times /route-plan's Claude step as deployed: parallel one-route calls, settleEnough, dedupe.
const r = require('./route-plan.js');
const KEY = process.env.CLAUDE_API_KEY;
const call = async (prompt) => {
  const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 6250, output_config: { effort: 'low' }, messages: [{ role: 'user', content: prompt }] }) });
  const j = await res.json(); if (!res.ok) throw new Error(JSON.stringify(j.error));
  return { text: j.content.filter(b => b.type === 'text').map(b => b.text).join(''), out: j.usage.output_tokens };
};
(async () => {
  const cases = [
    ['Vietnam', { kids: [3], transferComfort: 'short' }, true, ['Central coast, easy pace', 'The north, slowly', 'Classic north + centre']],
    ['Peru', {}, false, []],
    ['Morocco', { kids: [8] }, false, []],
    ['Vietnam', {}, true, ['Central coast, easy pace', 'The north, slowly', 'Classic north + centre']],
  ];
  for (const [dest, prefs, more, avoid] of cases) {
    const input = { destination: dest, days: 7, travelPace: 'balanced', interests: 'Hiking, Food tours', prefs: r.sanitizePrefs(prefs), avoid };
    const angles = r.routeAngles({ more, curated: false });
    const t = Date.now(); const each = [];
    const settled = await r.settleEnough(angles.map(a => { const s = Date.now(); return call(r.buildRouteOptionsPrompt({ ...input, angle: a })).then(x => { each.push(`${a} ${Date.now() - s}ms ${x.out}tok`); return r.parseRouteOptions(x.text, 7, `ai-${a}`); }); }), { enough: 2, graceMs: 3000, deadlineMs: 23000 });
    const wall = Date.now() - t;
    const kept = r.dedupeRoutes(settled.flatMap(s => s.status === 'fulfilled' ? s.value : []));
    console.log(`\n== ${dest} 7d ${JSON.stringify(prefs)} more=${more}: wall ${wall} ms; statuses ${settled.map(s => s.status)}; calls ${each.join(', ')}`);
    kept.forEach(o => console.log(`   ${o.name}: ${o.bases.map(b => `${b.name} ${b.days}`).join(' > ')} (max ${o.longestTransferHours} h) trips=${o.bases[0].dayTrips.map(d => d.name).join('/')}`));
  }
})();
