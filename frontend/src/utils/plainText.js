/**
 * Itinerary text from the generator can hold markdown links ("[View on map](https://…(…)…)")
 * and bare URLs. React escapes them safely, but they read as junk, so drop them and keep
 * a label only when it isn't a generic "View on map". Parentheses inside URLs are balanced.
 */
const GENERIC = /^\s*(view|open|see)?\s*(on|in)?\s*(google\s*)?maps?\s*$/i;

export function plainText(text) {
  if (text == null) return '';
  const s = String(text);
  let out = '';
  let i = 0;
  while (i < s.length) {
    if (s[i] === '[') {
      const close = s.indexOf('](', i + 1);
      if (close !== -1 && close - i < 200 && /^https?:\/\//i.test(s.slice(close + 2, close + 10))) {
        let j = close + 2;
        let depth = 0;
        for (; j < s.length; j++) {
          if (s[j] === '(') depth++;
          else if (s[j] === ')') { if (depth === 0) break; depth--; }
          else if (/\s/.test(s[j])) break;
        }
        const label = s.slice(i + 1, close);
        if (!GENERIC.test(label)) out += label;
        i = s[j] === ')' ? j + 1 : j;
        continue;
      }
    }
    const bare = /^https?:\/\/\S+/i.exec(s.slice(i, i + 2048));
    if (bare && (i === 0 || /\s/.test(s[i - 1]))) { i += bare[0].replace(/[.,;:!?]+$/, '').length; continue; }
    out += s[i];
    i++;
  }
  return out.replace(/[ \t]{2,}/g, ' ').replace(/ +([,.;:!?])/g, '$1').trim();
}
