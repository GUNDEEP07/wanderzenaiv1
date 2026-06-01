# Dashboard & TravelChat Polish

**Date:** 2026-06-01
**Status:** Approved, ready for implementation
**Scope:** TravelChat suggestion pills layout + Dashboard trip card three-dot menu + status badge solid colours

---

## Change 1: TravelChat — horizontal scroll suggestion pills

**File:** `frontend/src/components/TravelChat.jsx`

**Problem:** The 5 suggestion pills render as a vertical column (`flexDirection: 'column'`), consuming most of the chat panel height before any message is sent.

**Fix:** Change the suggestions container to a horizontal scrolling row. Each pill gets `flexShrink: 0` and `whiteSpace: 'nowrap'` so it stays on one line.

Current container style (around line 147):
```jsx
<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
```

New container style:
```jsx
<div style={{
  display: 'flex', flexDirection: 'row', gap: 8,
  overflowX: 'auto', WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'none', paddingBottom: 4,
}}>
```

Each pill button gains `flexShrink: 0` and `whiteSpace: 'nowrap'`:
```jsx
style={{
  padding: '8px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 20, fontSize: 12, color: 'rgba(255,255,255,0.65)', cursor: 'pointer',
  fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s',
  flexShrink: 0, whiteSpace: 'nowrap',
}}
```

Also hide the webkit scrollbar in the existing `<style>` block by adding:
```css
.travel-chat-suggestions::-webkit-scrollbar { display: none; }
```
And add `className="travel-chat-suggestions"` to the suggestions container div.

---

## Change 2: Dashboard — three-dot context menu on trip cards

**File:** `frontend/src/pages/Dashboard.jsx`

**Problem:** Each trip card shows 4 buttons: "View itinerary →", "📥 PDF", "🔗 Share", "Re-plan". The 3 secondary actions create repetitive visual noise in a list of cards.

**Fix:**
- Keep "View itinerary →" as the primary teal CTA.
- Replace "📥 PDF", "🔗 Share", "Re-plan" with a single `···` button.
- Clicking `···` opens a small dropdown with those 3 actions.
- Only one dropdown open at a time — managed by a single `openMenuId` state (string: `trip.id` or `null`).
- Dropdown closes when clicking outside (use a `useEffect` with a `mousedown` listener on `document`).

**New state:**
```jsx
const [openMenuId, setOpenMenuId] = useState(null);
```

**Click-outside effect** (add inside the Dashboard component):
```jsx
useEffect(() => {
  const close = (e) => {
    if (!e.target.closest('[data-trip-menu]')) setOpenMenuId(null);
  };
  document.addEventListener('mousedown', close);
  return () => document.removeEventListener('mousedown', close);
}, []);
```

**Updated trip card actions row** — replace the current 4-button row with:
```jsx
<div style={{ padding: '10px 14px', display: 'flex', gap: 7, alignItems: 'center' }}>
  {trip.hasItinerary && (
    <button
      style={{ padding: '7px 14px', background: 'linear-gradient(135deg,#00d4aa,#00a87e)', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 800, color: '#06090f', cursor: 'pointer', fontFamily: 'inherit' }}
      onClick={e => { e.stopPropagation(); navigate(`/itinerary/${trip.id}`); }}
    >
      View itinerary →
    </button>
  )}
  {(trip.pdfUrl || trip.hasItinerary) && (
    <div data-trip-menu style={{ position: 'relative', marginLeft: 'auto' }}>
      <button
        onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === trip.id ? null : trip.id); }}
        style={{ width: 30, height: 30, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}
      >
        ···
      </button>
      {openMenuId === trip.id && (
        <div style={{ position: 'absolute', bottom: 36, right: 0, background: '#1a2540', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '4px 0', minWidth: 140, zIndex: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          {trip.pdfUrl && (
            <a href={trip.pdfUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
              style={{ display: 'block', padding: '9px 14px', fontSize: 12, color: 'rgba(255,255,255,0.75)', textDecoration: 'none', fontFamily: 'inherit' }}>
              📥 Download PDF
            </a>
          )}
          {trip.hasItinerary && (
            <button
              style={{ display: 'block', width: '100%', padding: '9px 14px', background: 'none', border: 'none', fontSize: 12, color: 'rgba(255,255,255,0.75)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
              onClick={async e => {
                e.stopPropagation();
                const url = `https://www.wanderzenai.com/itinerary/${trip.id}`;
                try { await navigator.clipboard.writeText(url); } catch { }
                e.currentTarget.textContent = '✓ Link copied';
                setTimeout(() => { if (e.currentTarget) e.currentTarget.textContent = '🔗 Share link'; }, 2000);
              }}
            >
              🔗 Share link
            </button>
          )}
          <button
            style={{ display: 'block', width: '100%', padding: '9px 14px', background: 'none', border: 'none', fontSize: 12, color: 'rgba(255,255,255,0.75)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
            onClick={e => { e.stopPropagation(); setOpenMenuId(null); navigate('/plan', { state: { prefill: { destinations: [{ name: trip.destination?.split(',')[0]?.trim(), lat: 0, lng: 0 }] } } }); }}
          >
            ↺ Re-plan trip
          </button>
        </div>
      )}
    </div>
  )}
</div>
```

---

## Change 3: Dashboard — solid status badge colours

**File:** `frontend/src/pages/Dashboard.jsx`

**Problem:** Status badges use `rgba(0,212,170,0.9)` and `rgba(255,217,61,0.9)` — the opacity causes them to look washed out against the dark photo overlay.

**Fix:** Remove opacity — use fully opaque colours:

Find the badge span (search for `✓ Done`):
```jsx
background: trip.status === 'email_sent' ? 'rgba(0,212,170,0.9)' : 'rgba(255,217,61,0.9)',
color: trip.status === 'email_sent' ? '#06090f' : '#06090f',
```

Replace with:
```jsx
background: trip.status === 'email_sent' ? '#00d4aa' : '#ffd93d',
color: '#06090f',
```

---

## Out of scope

- TravelChat send button dynamic colour (already implemented)
- TravelChat collapsible welcome (already implemented — hides when `history.length > 0`)
- Duplicate trip entries in the list (data/backend issue, not UI)
