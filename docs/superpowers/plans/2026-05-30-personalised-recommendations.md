# Personalised Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI-powered personalised destination recommendations to the Dashboard, destination chips in PlanTrip Step 1, and pre-selected activity categories in Step 2 — all driven by the user's past trips and profile.

**Architecture:** A new `GET /recommendations/personalised` Lambda endpoint calls Claude Haiku with the user's past destinations + profile, caches for 7 days. Dashboard shows a "Recommended for you" row. PlanTrip reuses the cached result to show destination chips and pre-select activity categories in VenueSelection.

**Tech Stack:** Node 20 Lambda, Claude Haiku, React 18, existing `recommendations` Lambda

**PREREQUISITE:** Plans A and B (`auth-foundation` + `profile-dashboard`) must be deployed first.

---

## File Map

| File | Action |
|---|---|
| `backend/functions/recommendations/index.js` | Add `handlePersonalised` — calls Claude with past trips + profile |
| `infra/template.yaml` | Add `/recommendations/personalised` GET route |
| `frontend/src/pages/Dashboard.jsx` | Add "Recommended for you" row |
| `frontend/src/pages/PlanTrip.jsx` | Fetch recs on mount, show destination chips, pass preferred activities |
| `frontend/src/components/plantrip/subcomponents/ActivityGrid.jsx` | Accept `initialSelected` prop |

---

## Task 1: Personalised recommendations Lambda endpoint

**Files:**
- Modify: `backend/functions/recommendations/index.js`
- Modify: `infra/template.yaml`

- [ ] **Step 1: Add handlePersonalised function to index.js**

In `backend/functions/recommendations/index.js`, add this function before the `handleCategories` function:

```js
async function handlePersonalised(event) {
  const authHeader = event.headers?.Authorization || event.headers?.authorization || '';
  const token = authHeader.replace('Bearer ', '');

  // Decode email from JWT (no signature verification — MVP)
  let email = null;
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    email = payload.email;
  } catch {
    return ok({ recommendations: [], preferred_activities: [] }, event);
  }

  if (!email) return ok({ recommendations: [], preferred_activities: [] }, event);

  // Check cache (7 days)
  try {
    const cached = await getDB().query(
      `SELECT recommendations FROM recommendation_cache
       WHERE email = $1 AND created_at > NOW() - INTERVAL '7 days'`,
      [email]
    );
    if (cached.rows.length > 0) {
      log.info('Personalised recs cache hit', { email });
      return ok(cached.rows[0].recommendations, event);
    }
  } catch (err) {
    log.warn('Cache lookup failed', { error: err.message });
  }

  if (!anthropic) return ok({ recommendations: [], preferred_activities: [] }, event);

  try {
    // Fetch past trips
    const tripsResult = await getDB().query(
      `SELECT DISTINCT destination FROM submissions
       WHERE email = $1 ORDER BY destination LIMIT 10`,
      [email]
    );
    const pastDestinations = tripsResult.rows.map(r => r.destination).filter(Boolean);

    // Fetch profile
    const profileResult = await getDB().query(
      `SELECT age, gender, home_city, language FROM users WHERE email = $1`,
      [email]
    );
    const profile = profileResult.rows[0] || {};

    // Compute preferred activities from past submissions
    const activitiesResult = await getDB().query(
      `SELECT form_data FROM submissions WHERE email = $1 AND form_data IS NOT NULL LIMIT 10`,
      [email]
    );
    const activityCounts = {};
    for (const row of activitiesResult.rows) {
      try {
        const formData = typeof row.form_data === 'string' ? JSON.parse(row.form_data) : row.form_data;
        const styles = formData?.travelStyle || [];
        styles.forEach(s => { activityCounts[s] = (activityCounts[s] || 0) + 1; });
      } catch {}
    }
    const preferred_activities = Object.entries(activityCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([style]) => style);

    // Build Claude prompt
    const profileDesc = [
      profile.age ? `age ${profile.age}` : null,
      profile.gender || null,
      profile.home_city ? `based in ${profile.home_city}` : null,
    ].filter(Boolean).join(', ');

    const pastDesc = pastDestinations.length > 0
      ? `has visited: ${pastDestinations.join(', ')}`
      : 'has no past trips yet';

    const prompt = `You are a slow-travel expert. A traveller (${profileDesc || 'profile unknown'}) ${pastDesc}.

Recommend 3 new slow-travel destinations they haven't visited yet that match their style.
Return JSON only:
[
  { "destination": "City, Country", "country": "Country", "emoji": "🇯🇵", "reason": "One sentence why this suits them" }
]

Rules: real places only, no repeated destinations, focus on slow / off-the-beaten-path travel.`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    let message;
    try {
      message = await anthropic.messages.create(
        { model: 'claude-haiku-4-5-20251001', max_tokens: 512, messages: [{ role: 'user', content: prompt }] },
        { signal: controller.signal }
      );
    } finally {
      clearTimeout(timer);
    }

    const text = message.content[0]?.text || '';
    const match = text.match(/\[[\s\S]*\]/);
    const recommendations = match ? JSON.parse(match[0]) : [];

    const result = { recommendations: recommendations.slice(0, 3), preferred_activities };

    // Cache result
    try {
      await getDB().query(
        `INSERT INTO recommendation_cache (email, recommendations) VALUES ($1, $2)
         ON CONFLICT (email) DO UPDATE SET recommendations = $2, created_at = NOW()`,
        [email, JSON.stringify(result)]
      );
    } catch (cacheErr) {
      log.warn('Cache write failed', { error: cacheErr.message });
    }

    return ok(result, event);
  } catch (err) {
    log.error('Personalised recs failed', { error: err.message });
    return ok({ recommendations: [], preferred_activities: [] }, event);
  }
}
```

- [ ] **Step 2: Wire handlePersonalised into the router**

In `exports.handler`, in the `try` block where paths are matched, add before the `else`:

```js
    } else if (path.includes('/personalised')) {
      return await handlePersonalised(event);
    } else {
```

- [ ] **Step 3: Add route to template.yaml**

In the `RecommendationsFunction` Events section, add after the existing events:

```yaml
        GetPersonalised:
          Type: Api
          Properties:
            RestApiId: !Ref WanderZenApi
            Path: /recommendations/personalised
            Method: GET
```

- [ ] **Step 4: Verify Lambda syntax**

```bash
node --check backend/functions/recommendations/index.js && echo "OK"
```

Expected: `OK`

- [ ] **Step 5: Validate SAM template**

```bash
cd infra && sam validate --template template.yaml 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add backend/functions/recommendations/index.js infra/template.yaml
git commit -m "feat: personalised recommendations Lambda — Claude-powered destination + activity recs"
```

---

## Task 2: Dashboard — "Recommended for you" row

**Files:**
- Modify: `frontend/src/pages/Dashboard.jsx`

- [ ] **Step 1: Add recs state and fetch to Dashboard.jsx**

In `Dashboard.jsx`, add state after the existing state declarations:

```js
const [recs, setRecs] = useState([]);
```

In the `useEffect` that fetches profile, also fetch personalised recs:

```js
      // also fetch personalised recs
      const recsRes = await fetch(`${API_URL}/recommendations/personalised`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const recsData = await recsRes.json();
      if (recsData.recommendations) setRecs(recsData.recommendations);
```

- [ ] **Step 2: Add "Recommended for you" section above past trips**

In the Dashboard JSX, after the `cta` div and before the `sectionLabel` for past trips, add:

```jsx
        {/* Personalised recommendations */}
        {recs.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <div style={s.sectionLabel}>Recommended for you</div>
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
              {recs.map((rec, i) => (
                <div key={i} style={{
                  flexShrink: 0, minWidth: 200,
                  background: 'rgba(0,212,170,0.05)', border: '1px solid rgba(0,212,170,0.15)',
                  borderRadius: 14, padding: '16px 18px', cursor: 'pointer',
                }} onClick={() => navigate('/plan', { state: { prefill: { destinations: [{ name: rec.destination.split(',')[0].trim(), lat: 0, lng: 0 }] } } })}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{rec.emoji}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{rec.destination}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4, marginBottom: 12 }}>{rec.reason}</div>
                  <div style={{ fontSize: 11, color: '#00d4aa', fontWeight: 700 }}>Plan this trip →</div>
                </div>
              ))}
            </div>
          </div>
        )}
```

- [ ] **Step 3: Build check**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Dashboard.jsx
git commit -m "feat: Dashboard 'Recommended for you' row with personalised destination cards"
```

---

## Task 3: PlanTrip Step 1 — destination chips

**Files:**
- Modify: `frontend/src/pages/PlanTrip.jsx`

- [ ] **Step 1: Add recs state and fetch to PlanTrip**

In `PlanTrip.jsx`, add after the existing state declarations:

```js
const [personalRecs, setPersonalRecs] = useState([]);
const [preferredActivities, setPreferredActivities] = useState([]);
```

In the profile `useEffect`, after the profile pre-fill block, also fetch recs:

```js
      // fetch personalised recs (cached — fast)
      try {
        const recsRes = await fetch(`${import.meta.env.VITE_API_URL}/recommendations/personalised`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const recsData = await recsRes.json();
        if (recsData.recommendations) setPersonalRecs(recsData.recommendations);
        if (recsData.preferred_activities) setPreferredActivities(recsData.preferred_activities);
      } catch {}
```

- [ ] **Step 2: Render destination chips below DestinationSearch in Step 0**

In the Step 0 JSX, find the `DestinationSearch` field and after the error line add:

```jsx
                {personalRecs.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 8 }}>
                      Based on your travels
                    </div>
                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                      {personalRecs.map((rec, i) => (
                        <button
                          key={i}
                          style={{
                            padding: '6px 12px', borderRadius: 20,
                            border: '1px solid rgba(0,212,170,0.25)',
                            background: 'rgba(0,212,170,0.07)',
                            color: '#00d4aa', fontSize: 12, fontWeight: 600,
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}
                          onClick={() => handleDestinationSelect({ name: rec.destination.split(',')[0].trim(), lat: 0, lng: 0 })}
                        >
                          {rec.emoji} {rec.destination.split(',')[0].trim()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
```

- [ ] **Step 3: Pass preferredActivities to VenueSelection**

Find the VenueSelection usage in PlanTrip and add `preferredActivities`:

```jsx
            <VenueSelection
              destinations={form.destinations}
              travelStyles={form.travelStyle}
              startDate={form.travelDate}
              endDate={...}
              days={form.days}
              onSubmit={handleVenueSelect}
              onSkip={() => setStep(2)}
              onBack={() => setStep(0)}
              savedState={venueSelState}
              onSave={setVenueSelState}
              preferredActivities={preferredActivities}
            />
```

- [ ] **Step 4: Build check**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/PlanTrip.jsx
git commit -m "feat: PlanTrip destination chips from personalised recs, pass preferredActivities"
```

---

## Task 4: ActivityGrid — pre-select preferred categories

**Files:**
- Modify: `frontend/src/components/plantrip/subcomponents/ActivityGrid.jsx`
- Modify: `frontend/src/components/plantrip/VenueSelection.jsx`

- [ ] **Step 1: Add initialSelected prop to ActivityGrid**

In `frontend/src/components/plantrip/subcomponents/ActivityGrid.jsx`, update the function signature and use `initialSelected` to pre-check:

```jsx
export function ActivityGrid({ availableActivities, selectedActivities, onActivityToggle, onOpenCustomModal, initialSelected = [] }) {
  const activities = (availableActivities || []).map(name => ({
    name,
    emoji: EMOJI_MAP[name] || '📍',
    colourKey: COLOUR_CLASS[name] || 'default',
  }));

  // On first render, toggle any initialSelected activities not yet in selectedActivities
  // This is done by the parent (VenueSelection) via useEffect — ActivityGrid stays stateless

  return (
    <div className="activity-grid">
      {activities.map(({ name, emoji, colourKey }) => {
        const selected = selectedActivities.includes(name);
        const suggested = !selected && initialSelected.includes(name);
        return (
          <button
            key={name}
            className={`activity-card activity-card--${colourKey}${selected ? ' activity-card--selected' : ''}`}
            style={suggested ? { boxShadow: '0 0 0 1.5px rgba(0,212,170,0.4)' } : undefined}
            onClick={() => onActivityToggle(name)}
            title={suggested ? 'Based on your past trips' : undefined}
          >
            <span className="activity-card__emoji">{emoji}</span>
            <div className="activity-card__label">{name}</div>
            {suggested && <span style={{ position: 'absolute', top: 4, right: 5, fontSize: 7, color: '#00d4aa', fontWeight: 800 }}>★</span>}
          </button>
        );
      })}
      <button className="activity-card activity-card--custom" onClick={onOpenCustomModal}>
        <span className="activity-card__emoji">✨</span>
        <div className="activity-card__label">Add own</div>
      </button>
    </div>
  );
}
```

Note: `suggested` activities show a subtle teal ring and a ★ star indicator but are NOT pre-selected. The user must click to select them. This avoids forcing selections on the user.

- [ ] **Step 2: Pass preferredActivities through VenueSelection to ActivityGrid**

In `frontend/src/components/plantrip/VenueSelection.jsx`, update the function signature:

```jsx
export function VenueSelection({ destinations, travelStyles, startDate, endDate, days = 5, onSubmit, onSkip, onBack, savedState, onSave, preferredActivities = [] }) {
```

And pass it to ActivityGrid:

```jsx
            <ActivityGrid
              availableActivities={availableActivities}
              selectedActivities={currentActivities}
              onActivityToggle={handleActivityToggle}
              onOpenCustomModal={() => setShowCustomModal(true)}
              initialSelected={preferredActivities}
            />
```

- [ ] **Step 3: Build check + run tests**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

```bash
cd frontend && npx jest --testPathPatterns=ActivityGrid.test --no-coverage 2>&1 | tail -8
```

Expected: all ActivityGrid tests pass.

- [ ] **Step 4: Commit and push**

```bash
git add frontend/src/components/plantrip/subcomponents/ActivityGrid.jsx \
        frontend/src/components/plantrip/VenueSelection.jsx
git commit -m "feat: ActivityGrid highlights past-preference categories with star indicator"
git push origin main
```

Expected: GitHub Actions deploys all three plans' work. Personalised recommendations live.
