// Structured data rendered inside a page (schema.org JSON-LD) — for data that only exists once the
// page has loaded (e.g. Stripe prices), so the prerendered copy carries it too. `<` is escaped so no
// value can close the script tag.
export default function JsonLd({ data }) {
  if (!data) return null;
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
