// Prints the curated routes (backend/layers/shared/nodejs/curated-routes.js) as Markdown
// for the Notion review page, so the page and the app never drift apart.
// Run: node scripts/curated-routes-to-markdown.mjs > /tmp/curated-routes.md
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { COUNTRIES, fitDays, longestTransfer } = require('../backend/layers/shared/nodejs/curated-routes.js');

const esc = (s) => String(s ?? '').replace(/\|/g, '/').replace(/\n/g, ' ');
const transfer = (t) => (t ? `${t.mode} ~${t.hours} h${t.note ? ` — ${t.note}` : ''}` : 'arrival');
const split = (bases, days) => fitDays(bases, days).map(b => `${b.name} ${b.days}`).join(' → ');

const out = [];
for (const c of Object.values(COUNTRIES)) {
  out.push(`## ${c.name}`, '');
  for (const r of c.routes) {
    out.push(`### ${r.name}`);
    out.push(`${r.summary}`);
    out.push(`<b>Kid-friendly:</b> ${r.kidFriendly ? 'yes' : 'no'} · <b>Longest transfer:</b> ~${longestTransfer(r.bases)} h · <b>id:</b> <code>${r.id}</code>`, '');
    out.push('| Stop | Share of days | Getting there | Stay | Why | Day trips |');
    out.push('| --- | --- | --- | --- | --- | --- |');
    for (const b of r.bases) {
      out.push(`| ${esc(b.name)} (${esc(b.region)}) | ${b.weight} | ${esc(transfer(b.transferIn))} | ${esc(b.stayType)} | ${esc(b.why)} | ${esc((b.dayTrips || []).join(', '))} |`);
    }
    out.push('', `<b>How it splits:</b> 7 days: ${split(r.bases, 7)} · 10 days: ${split(r.bases, 10)} · 14 days: ${split(r.bases, 14)}`, '');
  }
}
process.stdout.write(out.join('\n'));
