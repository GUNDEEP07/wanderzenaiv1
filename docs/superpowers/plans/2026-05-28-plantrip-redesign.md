# PlanTrip Full Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the PlanTrip form to a full-bleed dark layout with a two-panel Step 2 (AI picks left, activity grid + YouTube + venues right), unified expandable cards with an embedded day-assignment list on both sides, and a slim segmented progress bar replacing the numbered-dots bar.

**Architecture:** PlanTrip.jsx renders Step 2 full-width (outside the narrow 680px card). VenueSelection renders the two-panel layout using a shared `DayList` component used identically by AI pick cards (left) and venue cards (right). Day assignments flow up to PlanTrip form state as `dayAssignments: Record<string, string>` and are passed to the itinerary API. CSS uses the existing inline-style + CSS-file pattern — no new styling libraries.

**Tech Stack:** React 18, Jest + RTL, vanilla CSS, existing `venueselection-redesign.css`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/components/plantrip/subcomponents/DayList.jsx` | **Create** | Shared embedded day-list UI; renders Day 1…N rows with dates; fires `onSelect(day)` |
| `frontend/src/components/plantrip/subcomponents/DayList.test.jsx` | **Create** | Tests: renders correct count, highlights selected, fires callback |
| `frontend/src/components/plantrip/subcomponents/ActivityGrid.jsx` | **Rewrite** | 4-col grid, per-category colour tints, selected state |
| `frontend/src/components/plantrip/subcomponents/ActivityGrid.test.jsx` | **Modify** | Update for new 4-col + colour-tint structure |
| `frontend/src/components/plantrip/subcomponents/VenuesList.jsx` | **Rewrite** | 2-col grid, expandable cards, DayList inside each card |
| `frontend/src/components/plantrip/subcomponents/VenuesList.test.jsx` | **Modify** | Update for new 2-col + day-assignment behaviour |
| `frontend/src/components/plantrip/subcomponents/DestinationInsightsPanel.jsx` | **Modify** | Add chevron expand, DayList inside each AI-pick card, fires `onDayAssign(name, day)` |
| `frontend/src/components/plantrip/subcomponents/DestinationInsightsPanel.test.jsx` | **Modify** | Add tests for expand/collapse and day assignment |
| `frontend/src/components/plantrip/VenueSelection.jsx` | **Rewrite** | Two-panel layout; aggregates `dayAssignments` state; passes it to `onSubmit` |
| `frontend/src/components/plantrip/styles/venueselection-redesign.css` | **Rewrite** | Full design: full-bleed panels, DayList styles, unified card shell, 4-col grid |
| `frontend/src/pages/PlanTrip.jsx` | **Modify** | Slim progress bar; Step 2 breaks out of card; adds `dayAssignments` to form state |

---

## Task 1: DayList shared component

**Files:**
- Create: `frontend/src/components/plantrip/subcomponents/DayList.jsx`
- Create: `frontend/src/components/plantrip/subcomponents/DayList.test.jsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/plantrip/subcomponents/DayList.test.jsx`:

```jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { DayList } from './DayList';

test('renders the correct number of day rows', () => {
  render(<DayList days={5} startDate="2026-05-31" selectedDay={null} onSelect={jest.fn()} />);
  expect(screen.getAllByRole('button')).toHaveLength(5);
  expect(screen.getByText('Day 1')).toBeInTheDocument();
  expect(screen.getByText('Day 5')).toBeInTheDocument();
});

test('renders dates when startDate provided', () => {
  render(<DayList days={3} startDate="2026-05-31" selectedDay={null} onSelect={jest.fn()} />);
  expect(screen.getByText(/31 May/)).toBeInTheDocument();
});

test('highlights selected day', () => {
  const { container } = render(
    <DayList days={5} startDate="2026-05-31" selectedDay="Day 2" onSelect={jest.fn()} />
  );
  const rows = container.querySelectorAll('.day-list__row');
  expect(rows[1].className).toContain('day-list__row--chosen');
});

test('fires onSelect with day label when row clicked', () => {
  const onSelect = jest.fn();
  render(<DayList days={5} startDate="2026-05-31" selectedDay={null} onSelect={onSelect} />);
  fireEvent.click(screen.getByText('Day 3').closest('button'));
  expect(onSelect).toHaveBeenCalledWith('Day 3');
});

test('renders without dates when no startDate', () => {
  render(<DayList days={3} startDate={null} selectedDay={null} onSelect={jest.fn()} />);
  expect(screen.getByText('Day 1')).toBeInTheDocument();
  expect(screen.queryByText(/May/)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx jest --testPathPatterns=DayList.test --no-coverage 2>&1 | tail -10
```

Expected: FAIL — DayList not found.

- [ ] **Step 3: Create DayList.jsx**

Create `frontend/src/components/plantrip/subcomponents/DayList.jsx`:

```jsx
export function DayList({ days, startDate, selectedDay, onSelect }) {
  const rows = Array.from({ length: days }, (_, i) => {
    const label = `Day ${i + 1}`;
    let dateStr = '';
    if (startDate) {
      const d = new Date(new Date(startDate).getTime() + i * 86400000);
      dateStr = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    }
    return { label, dateStr };
  });

  return (
    <div className="day-list">
      {rows.map(({ label, dateStr }) => {
        const chosen = selectedDay === label;
        return (
          <button
            key={label}
            className={`day-list__row${chosen ? ' day-list__row--chosen' : ''}`}
            onClick={() => onSelect(label)}
          >
            <span className="day-list__num">{label}</span>
            {dateStr && <span className="day-list__date">{dateStr}</span>}
            <span className="day-list__tick">{chosen ? '✓' : ''}</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx jest --testPathPatterns=DayList.test --no-coverage 2>&1 | tail -10
```

Expected: `Tests: 5 passed, 5 total`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/plantrip/subcomponents/DayList.jsx \
        frontend/src/components/plantrip/subcomponents/DayList.test.jsx
git commit -m "feat: add shared DayList component for embedded day assignment"
```

---

## Task 2: CSS — full design system rewrite

**Files:**
- Rewrite: `frontend/src/components/plantrip/styles/venueselection-redesign.css`

- [ ] **Step 1: Replace the full contents of venueselection-redesign.css**

```css
/* ─── Two-panel layout ──────────────────────────────────────────────── */

.venue-split {
  display: flex;
  flex-direction: row;
  height: 100%;
  overflow: hidden;
}

.venue-panel-left {
  width: 340px;
  flex-shrink: 0;
  border-right: 1px solid rgba(255,255,255,0.05);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.venue-panel-left::before {
  content: '';
  position: absolute;
  top: -60px; left: -80px;
  width: 420px; height: 360px;
  background: radial-gradient(ellipse at 40% 40%, rgba(0,212,170,0.08) 0%, transparent 68%);
  pointer-events: none;
  z-index: 0;
}

.venue-panel-right {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.venue-panel-right__scroll {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px 0;
  scrollbar-width: none;
}
.venue-panel-right__scroll::-webkit-scrollbar { display: none; }

/* ─── Left panel header ─────────────────────────────────────────────── */

.venue-left-head {
  padding: 24px 24px 12px;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}

.venue-eyebrow {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #00d4aa;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.venue-eyebrow::before {
  content: '';
  display: inline-block;
  width: 14px;
  height: 1.5px;
  background: #00d4aa;
  border-radius: 2px;
}

.venue-headline {
  font-family: 'Fraunces', serif;
  font-size: 34px;
  font-weight: 900;
  line-height: 1.06;
  color: #fff;
  letter-spacing: -0.025em;
  margin-bottom: 12px;
}

.venue-headline em {
  font-style: italic;
  font-weight: 300;
  color: transparent;
  background: linear-gradient(135deg, rgba(255,255,255,0.5), rgba(255,255,255,0.2));
  -webkit-background-clip: text;
  background-clip: text;
}

.venue-dest-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(0,212,170,0.07);
  border: 1px solid rgba(0,212,170,0.2);
  border-radius: 100px;
  padding: 4px 12px 4px 8px;
  font-size: 11px;
  color: #00d4aa;
  font-weight: 600;
}

.venue-dest-pill__dot {
  width: 6px;
  height: 6px;
  background: #00d4aa;
  border-radius: 50%;
  box-shadow: 0 0 6px rgba(0,212,170,0.8);
  animation: venuePulse 2s infinite;
}

@keyframes venuePulse {
  0%,100% { opacity:1; transform: scale(1); }
  50%      { opacity:0.4; transform: scale(0.75); }
}

/* ─── Insight badges ────────────────────────────────────────────────── */

.venue-chips {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  padding: 8px 24px 12px;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}

.venue-chip {
  padding: 4px 9px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 600;
  border: 1px solid;
}

.venue-chip--teal   { background:rgba(0,212,170,0.07); border-color:rgba(0,212,170,0.18); color:#00d4aa; }
.venue-chip--yellow { background:rgba(255,217,61,0.07); border-color:rgba(255,217,61,0.18); color:#ffd93d; }
.venue-chip--white  { background:rgba(255,255,255,0.03); border-color:rgba(255,255,255,0.09); color:rgba(255,255,255,0.4); }

/* ─── AI picks label ────────────────────────────────────────────────── */

.venue-picks-label {
  padding: 0 24px 8px;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.venue-picks-label__text {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.18);
}

.venue-picks-label__line {
  flex: 1;
  height: 1px;
  background: rgba(255,255,255,0.05);
}

.venue-picks-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 0 14px 14px 24px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  scrollbar-width: none;
  position: relative;
  z-index: 1;
}
.venue-picks-scroll::-webkit-scrollbar { display: none; }

/* ─── Unified item card (AI picks + venues — identical shell) ──────── */

.item-card {
  border-radius: 13px;
  border: 1px solid rgba(255,255,255,0.07);
  background: rgba(255,255,255,0.025);
  overflow: hidden;
  transition: border-color 0.2s, background 0.2s;
}

.item-card--picking {
  border-color: rgba(0,212,170,0.28);
}

.item-card--added {
  background: rgba(0,212,170,0.06);
  border-color: rgba(0,212,170,0.25);
}

.item-card__header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
}

.item-card__icon {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: rgba(255,255,255,0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
  transition: background 0.2s;
}

.item-card--picking .item-card__icon,
.item-card--added .item-card__icon {
  background: rgba(0,212,170,0.1);
}

.item-card__text { flex: 1; min-width: 0; }

.item-card__name {
  font-size: 12px;
  font-weight: 700;
  color: rgba(255,255,255,0.9);
  margin-bottom: 1px;
}

.item-card__sub {
  font-size: 10px;
  color: rgba(255,255,255,0.3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-card__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

/* Unified + / ✓ button — identical on both panels */
.add-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1.5px solid rgba(255,255,255,0.15);
  background: rgba(255,255,255,0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  color: rgba(255,255,255,0.4);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.18s;
  font-family: inherit;
  line-height: 1;
}
.add-btn:hover {
  border-color: rgba(0,212,170,0.5);
  color: #00d4aa;
  background: rgba(0,212,170,0.08);
}
.add-btn--done {
  background: #00d4aa;
  border-color: #00d4aa;
  color: #06090f;
  font-size: 10px;
  font-weight: 800;
}

/* Chevron */
.item-chevron {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1.5px solid rgba(255,255,255,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  color: rgba(255,255,255,0.25);
  transition: transform 0.25s, border-color 0.2s, background 0.2s;
  cursor: pointer;
  flex-shrink: 0;
}

.item-card--picking .item-chevron,
.item-card--added .item-chevron {
  transform: rotate(180deg);
  border-color: rgba(0,212,170,0.3);
  color: #00d4aa;
  background: rgba(0,212,170,0.07);
}

/* Day badge in header */
.item-day-badge {
  font-size: 9px;
  font-weight: 800;
  color: #00d4aa;
  background: rgba(0,212,170,0.1);
  border: 1px solid rgba(0,212,170,0.25);
  border-radius: 6px;
  padding: 2px 6px;
  letter-spacing: 0.02em;
}

/* Rating badge (venues) */
.item-rating {
  font-size: 9px;
  font-weight: 700;
  color: #00d4aa;
}

.item-ai-tag {
  font-size: 8px;
  font-weight: 700;
  color: #00d4aa;
  background: rgba(0,212,170,0.1);
  border: 1px solid rgba(0,212,170,0.18);
  border-radius: 4px;
  padding: 1px 5px;
}

/* ─── Expandable detail panel ───────────────────────────────────────── */

.item-card__detail {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.32s cubic-bezier(0.4,0,0.2,1);
}

.item-card--picking .item-card__detail,
.item-card--added .item-card__detail {
  max-height: 340px;
}

.item-card__detail-body {
  padding: 0 12px 12px 56px;
  border-top: 1px solid rgba(255,255,255,0.05);
}

.item-card__desc {
  font-size: 11px;
  color: rgba(255,255,255,0.5);
  line-height: 1.55;
  padding: 10px 0 8px;
}

.item-card__tags {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  margin-bottom: 10px;
}

.item-tag {
  padding: 3px 8px;
  border-radius: 20px;
  font-size: 9px;
  font-weight: 600;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.36);
}

/* ─── Embedded DayList ──────────────────────────────────────────────── */

.day-list-section { }

.day-list-section__label {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.2);
  margin-bottom: 7px;
}

.day-list {
  background: rgba(0,0,0,0.25);
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.06);
  overflow: hidden;
  max-height: 140px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.08) transparent;
  margin-bottom: 8px;
}
.day-list::-webkit-scrollbar { width: 3px; }
.day-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

.day-list__row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border: none;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  color: rgba(255,255,255,0.5);
  transition: background 0.15s;
  text-align: left;
}
.day-list__row:last-child { border-bottom: none; }
.day-list__row:hover { background: rgba(0,212,170,0.07); color: rgba(255,255,255,0.8); }
.day-list__row--chosen { background: rgba(0,212,170,0.1); color: #00d4aa; }

.day-list__num { font-weight: 800; }
.day-list__date { font-size: 9px; color: rgba(255,255,255,0.28); font-weight: 500; }
.day-list__row--chosen .day-list__date { color: rgba(0,212,170,0.6); }
.day-list__tick { font-size: 10px; font-weight: 800; color: #00d4aa; min-width: 12px; text-align: right; }

/* Added confirmation bar */
.day-added-confirm {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px;
  border-radius: 8px;
  background: rgba(0,212,170,0.07);
  border: 1px solid rgba(0,212,170,0.18);
  margin-bottom: 2px;
}
.day-added-confirm__text {
  font-size: 11px;
  font-weight: 700;
  color: #00d4aa;
  display: flex;
  align-items: center;
  gap: 6px;
}
.day-added-confirm__change {
  font-size: 10px;
  color: rgba(255,255,255,0.28);
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* ─── Activity grid — 4 col, colour-tinted ──────────────────────────── */

.activity-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 7px;
  margin-bottom: 20px;
}

.activity-card {
  border-radius: 13px;
  padding: 13px 8px 11px;
  text-align: center;
  border: 1.5px solid;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}

.activity-card:hover { transform: translateY(-1px); filter: brightness(1.15); }

.activity-card--hiking   { background:rgba(34,197,94,0.06);  border-color:rgba(34,197,94,0.15); }
.activity-card--food     { background:rgba(251,146,60,0.06); border-color:rgba(251,146,60,0.14); }
.activity-card--views    { background:rgba(96,165,250,0.06); border-color:rgba(96,165,250,0.14); }
.activity-card--culture  { background:rgba(167,139,250,0.06);border-color:rgba(167,139,250,0.14); }
.activity-card--nature   { background:rgba(52,211,153,0.06); border-color:rgba(52,211,153,0.14); }
.activity-card--nightlife{ background:rgba(129,90,213,0.07); border-color:rgba(129,90,213,0.16); }
.activity-card--wellness { background:rgba(251,113,133,0.06);border-color:rgba(251,113,133,0.14); }
.activity-card--custom   { background:rgba(255,217,61,0.04); border-color:rgba(255,217,61,0.12); }
.activity-card--default  { background:rgba(255,255,255,0.03);border-color:rgba(255,255,255,0.08); }

.activity-card--selected {
  background: rgba(0,212,170,0.08) !important;
  border-color: rgba(0,212,170,0.45) !important;
  box-shadow: 0 0 14px rgba(0,212,170,0.1);
}

.activity-card--selected::before {
  content: '✓';
  position: absolute;
  top: 5px; right: 7px;
  font-size: 8px;
  font-weight: 800;
  color: #00d4aa;
}

.activity-card__emoji { font-size: 23px; margin-bottom: 7px; display: block; }

.activity-card__label {
  font-size: 10px;
  font-weight: 700;
  color: rgba(255,255,255,0.42);
}
.activity-card--selected .activity-card__label { color: #00d4aa; }
.activity-card--custom .activity-card__label    { color: rgba(255,217,61,0.55); }

/* ─── Section divider ────────────────────────────────────────────────── */

.venue-sec-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.venue-sec-label {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.18);
  white-space: nowrap;
}

.venue-sec-line {
  flex: 1;
  height: 1px;
  background: rgba(255,255,255,0.05);
}

/* ─── YouTube row ─────────────────────────────────────────────────────── */

.yt-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: none;
  margin-bottom: 20px;
}
.yt-row::-webkit-scrollbar { display: none; }

/* ─── Venue grid — 2-col ─────────────────────────────────────────────── */

.venue-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
  margin-bottom: 24px;
}

/* ─── Footer ─────────────────────────────────────────────────────────── */

.venue-footer {
  padding: 11px 24px 15px;
  border-top: 1px solid rgba(255,255,255,0.05);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  background: rgba(6,9,15,0.75);
  backdrop-filter: blur(12px);
}

.venue-footer__skip {
  font-size: 12px;
  color: rgba(255,255,255,0.25);
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-weight: 500;
}

.venue-footer__count {
  font-size: 11px;
  color: rgba(255,255,255,0.28);
}
.venue-footer__count b { color: #00d4aa; font-weight: 800; }

.venue-footer__continue {
  padding: 11px 28px;
  background: linear-gradient(135deg, #00d4aa, #00a87e);
  border: none;
  border-radius: 11px;
  font-size: 13px;
  font-weight: 800;
  color: #06090f;
  cursor: pointer;
  font-family: inherit;
  letter-spacing: -0.01em;
  box-shadow: 0 4px 22px rgba(0,212,170,0.28), 0 1px 0 rgba(255,255,255,0.15) inset;
  transition: all 0.2s;
}
.venue-footer__continue:hover { transform: translateY(-1px); }
.venue-footer__continue:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

/* ─── Loading ─────────────────────────────────────────────────────────── */

.venue-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: rgba(255,255,255,0.4);
  font-size: 13px;
}

/* ─── Destination switcher tabs ───────────────────────────────────────── */

.venue-dest-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding: 0 24px 12px;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}

.venue-dest-tab {
  padding: 5px 12px;
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.15);
  background: transparent;
  color: rgba(255,255,255,0.5);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  font-weight: 600;
}

.venue-dest-tab--active {
  border-color: #00d4aa;
  background: rgba(0,212,170,0.12);
  color: #00d4aa;
}

/* ─── PlanTrip progress bar override ─────────────────────────────────── */

.plantrip-progress {
  display: flex;
  gap: 3px;
  height: 3px;
}

.plantrip-progress__seg {
  flex: 1;
  height: 3px;
  background: rgba(255,255,255,0.07);
  border-radius: 2px;
}
.plantrip-progress__seg--done   { background: #00d4aa; }
.plantrip-progress__seg--active { background: linear-gradient(90deg,#00d4aa,#00b896); box-shadow: 0 0 8px rgba(0,212,170,0.5); }
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/plantrip/styles/venueselection-redesign.css
git commit -m "style: full design system rewrite — two-panel, day-list, activity grid, unified card"
```

---

## Task 3: ActivityGrid — 4-col colour-coded rewrite

**Files:**
- Rewrite: `frontend/src/components/plantrip/subcomponents/ActivityGrid.jsx`
- Modify: `frontend/src/components/plantrip/subcomponents/ActivityGrid.test.jsx`

- [ ] **Step 1: Update ActivityGrid.test.jsx to reflect 4-col + colour classes**

Replace the full contents of `frontend/src/components/plantrip/subcomponents/ActivityGrid.test.jsx`:

```jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ActivityGrid } from './ActivityGrid';

const ACTIVITIES = ['Hiking', 'Food', 'Views', 'Culture', 'Nature', 'Nightlife', 'Wellness'];

test('renders all available activities', () => {
  render(<ActivityGrid availableActivities={ACTIVITIES} selectedActivities={[]} onActivityToggle={() => {}} onOpenCustomModal={() => {}} />);
  expect(screen.getByText('Hiking')).toBeInTheDocument();
  expect(screen.getByText('Wellness')).toBeInTheDocument();
  expect(screen.getByText('Add own')).toBeInTheDocument();
});

test('selected activity has --selected class', () => {
  const { container } = render(
    <ActivityGrid availableActivities={ACTIVITIES} selectedActivities={['Hiking']} onActivityToggle={() => {}} onOpenCustomModal={() => {}} />
  );
  const cards = container.querySelectorAll('.activity-card');
  expect(cards[0].className).toContain('activity-card--selected');
  expect(cards[1].className).not.toContain('activity-card--selected');
});

test('clicking activity calls onActivityToggle with name', () => {
  const toggle = jest.fn();
  render(<ActivityGrid availableActivities={ACTIVITIES} selectedActivities={[]} onActivityToggle={toggle} onOpenCustomModal={() => {}} />);
  fireEvent.click(screen.getByText('Food').closest('button'));
  expect(toggle).toHaveBeenCalledWith('Food');
});

test('clicking Add own calls onOpenCustomModal', () => {
  const open = jest.fn();
  render(<ActivityGrid availableActivities={ACTIVITIES} selectedActivities={[]} onActivityToggle={() => {}} onOpenCustomModal={open} />);
  fireEvent.click(screen.getByText('Add own').closest('button'));
  expect(open).toHaveBeenCalled();
});

test('each category gets its own colour class', () => {
  const { container } = render(
    <ActivityGrid availableActivities={['Hiking','Food','Views']} selectedActivities={[]} onActivityToggle={() => {}} onOpenCustomModal={() => {}} />
  );
  const cards = container.querySelectorAll('.activity-card');
  expect(cards[0].className).toContain('activity-card--hiking');
  expect(cards[1].className).toContain('activity-card--food');
  expect(cards[2].className).toContain('activity-card--views');
});
```

- [ ] **Step 2: Run — expect some FAIL (class names changed)**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx jest --testPathPatterns=ActivityGrid.test --no-coverage 2>&1 | tail -10
```

- [ ] **Step 3: Rewrite ActivityGrid.jsx**

Replace full contents of `frontend/src/components/plantrip/subcomponents/ActivityGrid.jsx`:

```jsx
const EMOJI_MAP = {
  'Hiking':'🥾','Food':'🍜','Views':'⛰️','Culture':'🏛️','Nature':'🌳',
  'Nightlife':'🎵','Wellness':'🧘','Parks':'🌲','Spa':'🧘','Adventure':'🚀',
  'Beaches':'🏖️','Shopping':'🛍️','Markets':'🏪','Museums':'🖼️',
  'Restaurants':'🍽️','Cafes':'☕','Sports':'⚽','Landmarks':'🗽',
};

const COLOUR_CLASS = {
  'Hiking':'hiking','Food':'food','Views':'views','Culture':'culture',
  'Nature':'nature','Nightlife':'nightlife','Wellness':'wellness',
};

export function ActivityGrid({ availableActivities, selectedActivities, onActivityToggle, onOpenCustomModal }) {
  const activities = (availableActivities || []).map(name => ({
    name,
    emoji: EMOJI_MAP[name] || '📍',
    colourKey: COLOUR_CLASS[name] || 'default',
  }));

  return (
    <div className="activity-grid">
      {activities.map(({ name, emoji, colourKey }) => {
        const selected = selectedActivities.includes(name);
        return (
          <button
            key={name}
            className={`activity-card activity-card--${colourKey}${selected ? ' activity-card--selected' : ''}`}
            onClick={() => onActivityToggle(name)}
          >
            <span className="activity-card__emoji">{emoji}</span>
            <div className="activity-card__label">{name}</div>
          </button>
        );
      })}
      <button
        className="activity-card activity-card--custom"
        onClick={onOpenCustomModal}
      >
        <span className="activity-card__emoji">✨</span>
        <div className="activity-card__label">Add own</div>
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect all PASS**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx jest --testPathPatterns=ActivityGrid.test --no-coverage 2>&1 | tail -10
```

Expected: `Tests: 5 passed, 5 total`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/plantrip/subcomponents/ActivityGrid.jsx \
        frontend/src/components/plantrip/subcomponents/ActivityGrid.test.jsx
git commit -m "feat: ActivityGrid 4-col colour-coded redesign"
```

---

## Task 4: VenuesList — 2-col expandable grid with DayList

**Files:**
- Rewrite: `frontend/src/components/plantrip/subcomponents/VenuesList.jsx`
- Modify: `frontend/src/components/plantrip/subcomponents/VenuesList.test.jsx`

- [ ] **Step 1: Update VenuesList.test.jsx**

Replace full contents of `frontend/src/components/plantrip/subcomponents/VenuesList.test.jsx`:

```jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { VenuesList } from './VenuesList';

const VENUES = [
  { fsq_id: 'v1', name: 'Zugspitze Trail', categories: [{ name: 'Hiking' }], location: {}, stats: { total_ratings: 100 }, rating: 9.8 },
  { fsq_id: 'v2', name: 'English Garden', categories: [{ name: 'Park' }], location: {}, stats: { total_ratings: 80 }, rating: 9.2 },
];

const DEFAULT_PROPS = {
  activity: 'Hiking',
  venues: VENUES,
  selectedVenues: new Set(),
  onVenueToggle: jest.fn(),
  onDayAssign: jest.fn(),
  loading: false,
  destination: { name: 'Munich' },
  days: 5,
  startDate: '2026-05-31',
};

beforeEach(() => jest.clearAllMocks());

test('renders venues in a 2-col grid', () => {
  render(<VenuesList {...DEFAULT_PROPS} />);
  expect(screen.getByText('Zugspitze Trail')).toBeInTheDocument();
  expect(screen.getByText('English Garden')).toBeInTheDocument();
});

test('clicking + opens the day list', () => {
  render(<VenuesList {...DEFAULT_PROPS} />);
  const addBtns = screen.getAllByText('+');
  fireEvent.click(addBtns[0]);
  expect(screen.getByText('Day 1')).toBeInTheDocument();
});

test('selecting a day calls onVenueToggle and onDayAssign', () => {
  const onVenueToggle = jest.fn();
  const onDayAssign = jest.fn();
  render(<VenuesList {...DEFAULT_PROPS} onVenueToggle={onVenueToggle} onDayAssign={onDayAssign} />);
  fireEvent.click(screen.getAllByText('+')[0]);
  fireEvent.click(screen.getByText('Day 2').closest('button'));
  expect(onVenueToggle).toHaveBeenCalledWith('v1');
  expect(onDayAssign).toHaveBeenCalledWith('v1', 'Day 2');
});

test('shows loading state', () => {
  render(<VenuesList {...DEFAULT_PROPS} loading={true} venues={[]} />);
  expect(screen.getByText(/Loading/i)).toBeInTheDocument();
});

test('shows empty state when no venues', () => {
  render(<VenuesList {...DEFAULT_PROPS} venues={[]} />);
  expect(screen.getByText(/No venues found/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx jest --testPathPatterns=VenuesList.test --no-coverage 2>&1 | tail -10
```

- [ ] **Step 3: Rewrite VenuesList.jsx**

Replace full contents of `frontend/src/components/plantrip/subcomponents/VenuesList.jsx`:

```jsx
import { useState } from 'react';
import { DayList } from './DayList';

export function VenuesList({ activity, venues, selectedVenues, onVenueToggle, onDayAssign, loading, destination, days = 5, startDate }) {
  const [openCard, setOpenCard] = useState(null);
  const [dayMap, setDayMap] = useState({});

  if (loading) {
    return (
      <div className="venue-loading">
        <span>Loading venues…</span>
      </div>
    );
  }

  if (!venues || venues.length === 0) {
    return (
      <div style={{ padding: '12px 0', fontSize: '12px', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
        No venues found for {activity}
      </div>
    );
  }

  const handleAddClick = (e, venueId) => {
    e.stopPropagation();
    setOpenCard(openCard === venueId ? null : venueId);
  };

  const handleDaySelect = (venueId, day) => {
    setDayMap(prev => ({ ...prev, [venueId]: day }));
    if (!selectedVenues.has(venueId)) onVenueToggle(venueId);
    onDayAssign(venueId, day);
    setOpenCard(null);
  };

  const handleChangDay = (e, venueId) => {
    e.stopPropagation();
    setOpenCard(venueId);
  };

  return (
    <div>
      <div className="venue-sec-row">
        <div className="venue-sec-label">📍 Venues near {destination?.name || 'destination'}</div>
        <div className="venue-sec-line"></div>
      </div>
      <div className="venue-grid">
        {venues.map(venue => {
          const isAdded = selectedVenues.has(venue.fsq_id);
          const isOpen = openCard === venue.fsq_id;
          const assignedDay = dayMap[venue.fsq_id];
          const rating = venue.rating ? (venue.rating / 2).toFixed(1) : null;

          let cardClass = 'item-card';
          if (isAdded) cardClass += ' item-card--added';
          else if (isOpen) cardClass += ' item-card--picking';

          return (
            <div key={venue.fsq_id} className={cardClass}>
              <div className="item-card__header" onClick={(e) => handleAddClick(e, venue.fsq_id)}>
                <div className="item-card__icon" style={{ fontSize: '16px' }}>
                  {venue.categories?.[0]?.icon
                    ? <img src={`${venue.categories[0].icon.prefix}32${venue.categories[0].icon.suffix}`} alt="" style={{ width: 20 }} />
                    : '📍'}
                </div>
                <div className="item-card__text">
                  <div className="item-card__name">{venue.name}</div>
                  <div className="item-card__sub">{venue.categories?.[0]?.name || ''}</div>
                </div>
                <div className="item-card__actions">
                  {assignedDay && <span className="item-day-badge">{assignedDay}</span>}
                  {rating && <span className="item-rating">⭐{rating}</span>}
                  <button
                    className={`add-btn${isAdded ? ' add-btn--done' : ''}`}
                    onClick={(e) => handleAddClick(e, venue.fsq_id)}
                  >
                    {isAdded ? '✓' : '+'}
                  </button>
                </div>
              </div>

              <div className="item-card__detail">
                <div className="item-card__detail-body">
                  {!isAdded ? (
                    <div className="day-list-section">
                      <div className="day-list-section__label">Which day will you visit?</div>
                      <DayList
                        days={days}
                        startDate={startDate}
                        selectedDay={assignedDay || null}
                        onSelect={(day) => handleDaySelect(venue.fsq_id, day)}
                      />
                    </div>
                  ) : (
                    <div className="day-added-confirm">
                      <div className="day-added-confirm__text">
                        ✓ Added to <span className="item-day-badge" style={{ marginLeft: 4 }}>{assignedDay}</span>
                      </div>
                      <button className="day-added-confirm__change" onClick={(e) => handleChangDay(e, venue.fsq_id)}>
                        Change day
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect all PASS**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx jest --testPathPatterns=VenuesList.test --no-coverage 2>&1 | tail -10
```

Expected: `Tests: 5 passed, 5 total`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/plantrip/subcomponents/VenuesList.jsx \
        frontend/src/components/plantrip/subcomponents/VenuesList.test.jsx
git commit -m "feat: VenuesList 2-col expandable grid with embedded DayList"
```

---

## Task 5: DestinationInsightsPanel — expandable cards with DayList

**Files:**
- Modify: `frontend/src/components/plantrip/subcomponents/DestinationInsightsPanel.jsx`
- Modify: `frontend/src/components/plantrip/subcomponents/DestinationInsightsPanel.test.jsx`

- [ ] **Step 1: Add tests for expand/collapse and day assignment**

Add to `frontend/src/components/plantrip/subcomponents/DestinationInsightsPanel.test.jsx` (append after existing tests):

```jsx
test('clicking chevron expands a pick card', async () => {
  render(<DestinationInsightsPanel {...PROPS} />);
  await waitFor(() => expect(screen.getByText('Alps Hiking')).toBeInTheDocument());
  const card = screen.getByText('Alps Hiking').closest('.item-card');
  expect(card.className).not.toContain('item-card--picking');
  fireEvent.click(card.querySelector('.item-chevron'));
  expect(card.className).toContain('item-card--picking');
});

test('selecting a day calls onDayAssign and onActivityToggle', async () => {
  const onActivityToggle = jest.fn();
  const onDayAssign = jest.fn();
  render(
    <DestinationInsightsPanel
      {...PROPS}
      onActivityToggle={onActivityToggle}
      onDayAssign={onDayAssign}
      days={3}
    />
  );
  await waitFor(() => expect(screen.getByText('Alps Hiking')).toBeInTheDocument());
  const card = screen.getByText('Alps Hiking').closest('.item-card');
  fireEvent.click(card.querySelector('.item-chevron'));
  fireEvent.click(screen.getByText('Day 2').closest('button'));
  expect(onActivityToggle).toHaveBeenCalledWith('Alps Hiking');
  expect(onDayAssign).toHaveBeenCalledWith('Alps Hiking', 'Day 2');
});
```

- [ ] **Step 2: Run — expect new tests FAIL**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx jest --testPathPatterns=DestinationInsightsPanel --no-coverage 2>&1 | tail -15
```

- [ ] **Step 3: Rewrite DestinationInsightsPanel.jsx**

Replace full contents of `frontend/src/components/plantrip/subcomponents/DestinationInsightsPanel.jsx`:

```jsx
import React, { useEffect, useState } from 'react';
import { fetchDestinationInsights } from '../../../api/destinationInsights';
import { DayList } from './DayList';

export function DestinationInsightsPanel({
  destination,
  travelStyles,
  startDate,
  endDate,
  selectedActivities = [],
  onActivityToggle,
  onInsightsLoaded,
  onDayAssign,
  days = 5,
}) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [openCard, setOpenCard] = useState(null);
  const [dayMap, setDayMap] = useState({});

  const destName = typeof destination === 'object' ? destination?.name : destination;

  useEffect(() => {
    if (!destination || !startDate || !endDate) return;
    let cancelled = false;
    const loadInsights = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchDestinationInsights(destName, travelStyles || [], startDate, endDate);
        if (cancelled) return;
        setInsights(result);
        if (result.thingsToDo) onInsightsLoaded?.(result.thingsToDo);
      } catch (err) {
        if (!cancelled) setError('Could not load destination insights');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadInsights();
    return () => { cancelled = true; };
  }, [destination, travelStyles, startDate, endDate]);

  if (!destination) return null;

  if (loading) {
    return (
      <div className="insights-strip">
        <div className="insights-strip__header">✨ {destName} · {startDate} – {endDate}</div>
        <div className="insights-strip__badges">
          <span className="insights-badge">Loading insights…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="insights-strip insights-strip--error">
        <span className="insights-strip__error-text">{error}</span>
      </div>
    );
  }

  if (!insights) return null;

  const bestMonthsText = insights.bestMonths?.slice(0, 2).join(' & ') || 'Year-round';
  const weatherShort = insights.weather ? insights.weather.split(/[,(]/)[0].trim() : null;

  const handleChevronClick = (e, name) => {
    e.stopPropagation();
    setOpenCard(openCard === name ? null : name);
  };

  const handleDaySelect = (name, day) => {
    setDayMap(prev => ({ ...prev, [name]: day }));
    if (!selectedActivities.includes(name)) onActivityToggle?.(name);
    onDayAssign?.(name, day);
    setOpenCard(null);
  };

  const handleChangDay = (e, name) => {
    e.stopPropagation();
    setOpenCard(name);
  };

  return (
    <div>
      {/* Compact insight badges */}
      <div className="insights-strip" style={{ marginBottom: 12 }}>
        <div className="insights-strip__header">✨ {destName} · {startDate} – {endDate}</div>
        <div className="insights-strip__badges">
          {weatherShort && <span className="insights-badge insights-badge--weather">☀️ {weatherShort}</span>}
          {insights.crowdLevel && <span className="insights-badge insights-badge--crowd">👥 {insights.crowdLevel}</span>}
          <span className="insights-badge insights-badge--months">🗓️ {bestMonthsText}</span>
        </div>
      </div>

      {insights.thingsToDo?.length > 0 && (
        <div>
          <div className="venue-picks-label">
            <span className="venue-picks-label__text">✦ Curated for you</span>
            <div className="venue-picks-label__line"></div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {insights.thingsToDo.map((thing) => {
              const isAdded = selectedActivities.includes(thing.name);
              const isOpen = openCard === thing.name;
              const assignedDay = dayMap[thing.name];
              const segment = thing.reason ? thing.reason.split('—')[0].trim() : '';
              const reasonShort = segment.length > 55 ? segment.slice(0, 55) + '…' : segment;

              let cardClass = 'item-card';
              if (isAdded) cardClass += ' item-card--added';
              else if (isOpen) cardClass += ' item-card--picking';

              return (
                <div key={thing.name} className={cardClass}>
                  <div className="item-card__header">
                    <div className="item-card__icon">{thing.emoji}</div>
                    <div className="item-card__text">
                      <div className="item-card__name">{thing.name}</div>
                      <div className="item-card__sub">{reasonShort}</div>
                    </div>
                    <div className="item-card__actions">
                      {assignedDay && <span className="item-day-badge">{assignedDay}</span>}
                      <button
                        className={`add-btn${isAdded ? ' add-btn--done' : ''}`}
                        onClick={(e) => { e.stopPropagation(); if (!isAdded) setOpenCard(isOpen ? null : thing.name); }}
                      >
                        {isAdded ? '✓' : '+'}
                      </button>
                      <div
                        className="item-chevron"
                        onClick={(e) => handleChevronClick(e, thing.name)}
                      >
                        ▾
                      </div>
                    </div>
                  </div>

                  <div className="item-card__detail">
                    <div className="item-card__detail-body">
                      {thing.reason && (
                        <div className="item-card__desc">{thing.reason}</div>
                      )}
                      <div className="item-card__tags">
                        {thing.category && <span className="item-tag">{thing.category}</span>}
                      </div>
                      {!isAdded ? (
                        <div className="day-list-section">
                          <div className="day-list-section__label">Which day will you visit?</div>
                          <DayList
                            days={days}
                            startDate={startDate}
                            selectedDay={assignedDay || null}
                            onSelect={(day) => handleDaySelect(thing.name, day)}
                          />
                        </div>
                      ) : (
                        <div className="day-added-confirm">
                          <div className="day-added-confirm__text">
                            ✓ Added to <span className="item-day-badge" style={{ marginLeft: 4 }}>{assignedDay}</span>
                          </div>
                          <button className="day-added-confirm__change" onClick={(e) => handleChangDay(e, thing.name)}>
                            Change day
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

Also add these CSS rules to `venueselection-redesign.css` (append at end):

```css
/* ─── Legacy insights strip (used in DestinationInsightsPanel) ──────── */
.insights-strip {
  background: rgba(0,212,170,0.06);
  border: 1px solid rgba(0,212,170,0.2);
  border-radius: 12px;
  padding: 12px 14px;
}
.insights-strip--error { background: rgba(255,107,107,0.06); border-color: rgba(255,107,107,0.2); }
.insights-strip__error-text { font-size: 12px; color: rgba(255,255,255,0.4); }
.insights-strip__header { font-size: 11px; font-weight: 700; color: #00d4aa; margin-bottom: 7px; }
.insights-strip__badges { display: flex; gap: 5px; flex-wrap: wrap; }
.insights-badge { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 5px; padding: 3px 8px; font-size: 10px; color: rgba(255,255,255,0.6); }
.insights-badge--weather { background:rgba(0,212,170,0.08); border-color:rgba(0,212,170,0.2); color:#00d4aa; }
.insights-badge--crowd   { background:rgba(255,217,61,0.08); border-color:rgba(255,217,61,0.2); color:#ffd93d; }
.insights-badge--months  { color: rgba(255,255,255,0.55); }
```

- [ ] **Step 4: Run tests — all PASS**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx jest --testPathPatterns=DestinationInsightsPanel --no-coverage 2>&1 | tail -15
```

Expected: `Tests: 9 passed, 9 total`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/plantrip/subcomponents/DestinationInsightsPanel.jsx \
        frontend/src/components/plantrip/subcomponents/DestinationInsightsPanel.test.jsx \
        frontend/src/components/plantrip/styles/venueselection-redesign.css
git commit -m "feat: DestinationInsightsPanel expandable cards with embedded DayList and day assignment"
```

---

## Task 6: VenueSelection — full two-panel rewrite

**Files:**
- Rewrite: `frontend/src/components/plantrip/VenueSelection.jsx`
- Modify: `frontend/src/components/plantrip/VenueSelection.test.jsx`

- [ ] **Step 1: Add day-assignment test to VenueSelection.test.jsx**

Append to `frontend/src/components/plantrip/VenueSelection.test.jsx`:

```jsx
test('onSubmit receives dayAssignments when Continue clicked', async () => {
  const onSubmit = jest.fn();
  render(
    <VenueSelection
      destinations={DESTINATIONS}
      travelStyles={[]}
      startDate="2026-05-31"
      endDate="2026-06-05"
      days={5}
      onSubmit={onSubmit}
      onSkip={jest.fn()}
    />
  );
  await waitFor(() => screen.getByText('Hiking'));
  fireEvent.click(screen.getByText('Continue →'));
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      activities: expect.any(Object),
      venues: expect.any(Object),
      dayAssignments: expect.any(Object),
    })
  );
});
```

- [ ] **Step 2: Run — expect new test FAIL**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx jest --testPathPatterns=VenueSelection.test --no-coverage 2>&1 | tail -10
```

- [ ] **Step 3: Rewrite VenueSelection.jsx**

Replace full contents of `frontend/src/components/plantrip/VenueSelection.jsx`:

```jsx
import { useState, useEffect } from 'react';
import { ActivityGrid } from './subcomponents/ActivityGrid';
import { ActivityTabs } from './subcomponents/ActivityTabs';
import { YouTubeCarousel } from './subcomponents/YouTubeCarousel';
import { VenuesList } from './subcomponents/VenuesList';
import { CustomInterestModal } from './subcomponents/CustomInterestModal';
import { DestinationInsightsPanel } from './subcomponents/DestinationInsightsPanel';
import { getUserLocationFromIP } from '../../utils/geolocation';
import { fetchTrendingVideos } from '../../utils/youtube';
import { fetchVenuesForActivity, getActivitiesForTravelStyle } from '../../utils/foursquare';
import './styles/venueselection-redesign.css';

const PRESET_ACTIVITIES = ['Hiking', 'Food', 'Views', 'Culture', 'Nature', 'Nightlife', 'Wellness'];

export function VenueSelection({ destinations, travelStyles, startDate, endDate, days = 5, onSubmit, onSkip }) {
  const [selectedDestination, setSelectedDestination] = useState(0);
  const [selectedActivities, setSelectedActivities] = useState({});
  const [activeTab, setActiveTab] = useState(null);
  const [youtubeVideos, setYoutubeVideos] = useState({});
  const [foursquareVenues, setFoursquareVenues] = useState({});
  const [selectedVenues, setSelectedVenues] = useState({});
  const [dayAssignments, setDayAssignments] = useState({});
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [videoLoading, setVideoLoading] = useState({});
  const [venueLoading, setVenueLoading] = useState({});
  const [countryCode, setCountryCode] = useState('US');
  const [aiSuggestions, setAiSuggestions] = useState([]);

  const destination = destinations?.[selectedDestination];
  const destKey = destination?.name || `destination_${selectedDestination}`;
  const currentActivities = selectedActivities[destKey] || [];
  const availableActivities = travelStyles?.length > 0
    ? getActivitiesForTravelStyle(travelStyles)
    : PRESET_ACTIVITIES;

  useEffect(() => {
    getUserLocationFromIP()
      .then(loc => { setCountryCode(loc.countryCode); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const fetchActivityContent = async (activity) => {
    if (!youtubeVideos[activity]) {
      setVideoLoading(prev => ({ ...prev, [activity]: true }));
      const videos = await fetchTrendingVideos(activity, destination, countryCode);
      setYoutubeVideos(prev => ({ ...prev, [activity]: videos }));
      setVideoLoading(prev => ({ ...prev, [activity]: false }));
    }
    if (!foursquareVenues[activity]) {
      setVenueLoading(prev => ({ ...prev, [activity]: true }));
      const venues = await fetchVenuesForActivity(activity, destination);
      setFoursquareVenues(prev => ({ ...prev, [activity]: venues }));
      setVenueLoading(prev => ({ ...prev, [activity]: false }));
    }
  };

  const handleActivityToggle = (activity) => {
    setSelectedActivities(prev => {
      const activities = prev[destKey] || [];
      let updated;
      if (activities.includes(activity)) {
        updated = activities.filter(a => a !== activity);
        if (activeTab === activity) setActiveTab(updated.length > 0 ? updated[0] : null);
      } else {
        updated = [...activities, activity];
        if (!activeTab) setActiveTab(activity);
        fetchActivityContent(activity);
      }
      return { ...prev, [destKey]: updated };
    });
  };

  const handleDayAssign = (nameOrId, day) => {
    setDayAssignments(prev => ({ ...prev, [nameOrId]: day }));
  };

  const handleCustomActivitySubmit = (activityName) => {
    setSelectedActivities(prev => {
      const activities = prev[destKey] || [];
      if (activities.includes(activityName)) return prev;
      setActiveTab(activityName);
      setShowCustomModal(false);
      fetchActivityContent(activityName);
      return { ...prev, [destKey]: [...activities, activityName] };
    });
  };

  const handleVenueToggle = (venueId) => {
    const venueKey = `${destKey}/${activeTab}`;
    setSelectedVenues(prev => {
      const existing = prev[venueKey] || new Set();
      const updated = new Set(existing);
      if (updated.has(venueId)) updated.delete(venueId);
      else updated.add(venueId);
      return { ...prev, [venueKey]: updated };
    });
  };

  const handleContinue = () => {
    const venueData = {};
    Object.entries(selectedVenues).forEach(([key, venues]) => {
      venueData[key] = Array.from(venues);
    });
    onSubmit({ activities: selectedActivities, venues: venueData, dayAssignments });
  };

  if (loading) {
    return (
      <div className="venue-loading">
        <div>Detecting your location…</div>
      </div>
    );
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const selectedCount = Object.values(selectedActivities).flat().length +
    Object.values(selectedVenues).reduce((s, set) => s + set.size, 0);
  const scheduledCount = Object.keys(dayAssignments).length;

  return (
    <>
      <div className="venue-split">
        {/* ═══ LEFT PANEL ═══ */}
        <div className="venue-panel-left">
          <div className="venue-left-head">
            <div className="venue-eyebrow">Your journey awaits</div>
            <div className="venue-headline">
              What makes<br />you <em>come alive?</em>
            </div>
            {destination && (
              <div className="venue-dest-pill">
                <div className="venue-dest-pill__dot"></div>
                {destination.name}{startDate ? ` · ${days} days · ${startDate}` : ''}
              </div>
            )}
          </div>

          {destination && startDate && endDate && (
            <DestinationInsightsPanel
              destination={destination}
              travelStyles={travelStyles}
              startDate={startDate}
              endDate={endDate}
              selectedActivities={currentActivities}
              onActivityToggle={handleActivityToggle}
              onInsightsLoaded={setAiSuggestions}
              onDayAssign={handleDayAssign}
              days={days}
            />
          )}

          {destinations?.length > 1 && (
            <div className="venue-dest-tabs">
              {destinations.map((dest, idx) => (
                <button
                  key={dest.name}
                  className={`venue-dest-tab${selectedDestination === idx ? ' venue-dest-tab--active' : ''}`}
                  onClick={() => { setSelectedDestination(idx); setActiveTab(null); setAiSuggestions([]); }}
                >
                  {dest.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ═══ RIGHT PANEL ═══ */}
        <div className="venue-panel-right">
          <div className="venue-panel-right__scroll">
            {/* Activity grid */}
            <div className="venue-sec-row">
              <div className="venue-sec-label">Explore by category</div>
              <div className="venue-sec-line"></div>
            </div>
            <ActivityGrid
              availableActivities={availableActivities}
              selectedActivities={currentActivities}
              onActivityToggle={handleActivityToggle}
              onOpenCustomModal={() => setShowCustomModal(true)}
            />

            {/* Activity tabs */}
            {currentActivities.length > 0 && (
              <ActivityTabs
                selectedActivities={currentActivities}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            )}

            {/* YouTube + Venues for active tab */}
            {activeTab && (
              <>
                <div className="venue-sec-row" style={{ marginTop: 16 }}>
                  <div className="venue-sec-label">📺 {activeTab} — watch before you go</div>
                  <div className="venue-sec-line"></div>
                </div>
                <div className="yt-row">
                  <YouTubeCarousel
                    activity={activeTab}
                    destination={destination}
                    countryCode={countryCode}
                    videos={youtubeVideos[activeTab] || []}
                    loading={videoLoading[activeTab] || false}
                    isMobile={isMobile}
                  />
                </div>

                <VenuesList
                  activity={activeTab}
                  venues={foursquareVenues[activeTab] || []}
                  selectedVenues={selectedVenues[`${destKey}/${activeTab}`] || new Set()}
                  onVenueToggle={handleVenueToggle}
                  onDayAssign={handleDayAssign}
                  loading={venueLoading[activeTab] || false}
                  destination={destination}
                  days={days}
                  startDate={startDate}
                />
              </>
            )}
          </div>

          <div className="venue-footer">
            <button className="venue-footer__skip" onClick={onSkip}>Skip this step</button>
            <div className="venue-footer__count">
              <b>{selectedCount}</b> selected{scheduledCount > 0 && <> · <b>{scheduledCount}</b> scheduled</>}
            </div>
            <button
              className="venue-footer__continue"
              onClick={handleContinue}
              disabled={selectedCount === 0}
            >
              Continue →
            </button>
          </div>
        </div>
      </div>

      <CustomInterestModal
        destination={destination}
        isOpen={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        onSubmit={handleCustomActivitySubmit}
        loading={false}
      />
    </>
  );
}
```

- [ ] **Step 4: Run all VenueSelection tests — expect PASS**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx jest --testPathPatterns=VenueSelection.test --no-coverage 2>&1 | tail -10
```

Expected: `Tests: 6 passed, 6 total`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/plantrip/VenueSelection.jsx \
        frontend/src/components/plantrip/VenueSelection.test.jsx
git commit -m "feat: VenueSelection full two-panel redesign with day assignments"
```

---

## Task 7: PlanTrip — full-bleed Step 2, slim progress bar, dayAssignments state

**Files:**
- Modify: `frontend/src/pages/PlanTrip.jsx`

- [ ] **Step 1: Read the current Step 2 rendering and progress bar in PlanTrip.jsx**

Open `frontend/src/pages/PlanTrip.jsx` and find:
1. The progress dots section (lines ~250–265)
2. The `{step === 1 ...}` block and its wrapping `<div style={s.card}>`

- [ ] **Step 2: Replace progress dots with slim segmented bar**

Find the progress dots section:

```jsx
{/* Progress dots */}
<div style={s.progress}>
  {STEPS.map((name, i) => (
    <div key={name} style={s.stepDot}>
      <div style={s.dotCircle(i === step, i < step)}>
        {i < step ? '✓' : i + 1}
      </div>
      <div style={s.dotLabel(i === step)}>{name}</div>
    </div>
  ))}
  <div style={s.progressLine}>
    <div style={s.progressFill(pct)} />
  </div>
</div>
```

Replace with:

```jsx
{/* Progress bar — slim segmented */}
<div className="plantrip-progress" style={{ marginBottom: '2rem' }}>
  {STEPS.map((_, i) => {
    let cls = 'plantrip-progress__seg';
    if (i < step) cls += ' plantrip-progress__seg--done';
    else if (i === step) cls += ' plantrip-progress__seg--active';
    return <div key={i} className={cls}></div>;
  })}
</div>
```

- [ ] **Step 3: Add dayAssignments to INITIAL_FORM and form state**

Find `INITIAL_FORM`:
```js
const INITIAL_FORM = {
  destinations: [], days: 5, budget: '', currency: 'USD',
  ...
  selected_venues: {},
};
```

Add `day_assignments: {}` to INITIAL_FORM:
```js
const INITIAL_FORM = {
  destinations: [], days: 5, budget: '', currency: 'USD',
  travelerType: '', travelStyle: [], interests: '',
  travelDate: '', travelPace: 'balanced', wantsHotelRecs: true,
  startTime: '09:00', userMustDos: '',
  language: 'English', userAge: '', userLocation: '', email: '',
  selected_venues: {},
  day_assignments: {},
};
```

- [ ] **Step 4: Update handleVenueSelect to capture dayAssignments**

Find:
```js
const handleVenueSelect = (venueData) => {
  setForm({
    ...form,
    selected_venues: venueData,
  });
  setStep(2);
};
```

Replace with:
```js
const handleVenueSelect = (venueData) => {
  setForm({
    ...form,
    selected_venues: venueData.venues || venueData,
    day_assignments: venueData.dayAssignments || {},
  });
  setStep(2);
};
```

- [ ] **Step 5: Break Step 2 out of the narrow card**

Find the Step 2 block:

```jsx
{step === 1 && form.destinations.length > 0 && (
  <div>
    <div style={s.stepLabel}>Step 2 of 6</div>
    <h2 style={s.stepTitle}>Favourite venues</h2>
    <p style={s.stepSub}>Pick specific venues you'd like to visit (optional — we can skip this).</p>
    <VenueSelection
      destinations={form.destinations}
      travelStyles={form.travelStyle}
      startDate={form.travelDate}
      endDate={form.travelDate ? new Date(new Date(form.travelDate).getTime() + form.days * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null}
      onSubmit={handleVenueSelect}
      onSkip={() => setStep(2)}
    />
  </div>
)}
```

Replace with (note: step 1 renders OUTSIDE the card div — the closing `</div>` of `s.card` must come after step 0):

```jsx
{step === 1 && form.destinations.length > 0 && (
  <VenueSelection
    destinations={form.destinations}
    travelStyles={form.travelStyle}
    startDate={form.travelDate}
    endDate={form.travelDate ? new Date(new Date(form.travelDate).getTime() + form.days * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null}
    days={form.days}
    onSubmit={handleVenueSelect}
    onSkip={() => setStep(2)}
  />
)}
```

Then move the `</div>` that closes `<div style={s.card}>` so it only wraps steps 0 and 2+. The structure should be:

```jsx
<div style={s.inner}>
  {/* Progress bar */}
  <div className="plantrip-progress" ...>...</div>

  {/* Step 1 (venues) — full width, NO card wrapper */}
  {step === 1 && form.destinations.length > 0 && (
    <VenueSelection ... />
  )}

  {/* All other steps — inside card */}
  {step !== 1 && (
    <div style={s.card}>
      {step === 0 && (...)}
      {step === 2 && (...)}
      {step === 3 && (...)}
      {step === 4 && (...)}
      {step === 5 && (...)}
    </div>
  )}
</div>
```

- [ ] **Step 6: Build to verify no errors**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npm run build 2>&1 | tail -10
```

Expected: `✓ built in ...ms`

- [ ] **Step 7: Commit and push**

```bash
git add frontend/src/pages/PlanTrip.jsx
git commit -m "feat: PlanTrip full-bleed Step 2, slim progress bar, dayAssignments state"
git push origin main
```

---

## Task 8: Final test pass + cleanup

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx jest --no-coverage 2>&1 | tail -20
```

Expected: our new tests (DayList, ActivityGrid, VenuesList, DestinationInsightsPanel, VenueSelection) all pass. Pre-existing failures in unrelated suites are acceptable.

- [ ] **Step 2: Verify production build**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npm run build 2>&1 | tail -8
```

Expected: `✓ built in ...ms` with no errors.

- [ ] **Step 3: Final commit and push**

```bash
git push origin main
```
