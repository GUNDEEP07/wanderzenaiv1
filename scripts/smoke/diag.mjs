// One-off diagnostics: is the database reachable from Lambda at all?
const API = 'https://y44o2x9cu1.execute-api.ap-southeast-2.amazonaws.com/prod';
for (const p of ['/recommendations/public/stats', '/blog', '/itinerary/wz_smoke_doesnotexist', '/recommendations/trending']) {
  const r = await fetch(API + p, { signal: AbortSignal.timeout(25000) });
  console.log(p, r.status, (await r.text()).slice(0, 300));
}
