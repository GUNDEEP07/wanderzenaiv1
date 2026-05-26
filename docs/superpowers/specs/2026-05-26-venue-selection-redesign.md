# VenueSelection Component Redesign

**Goal:** Redesign the VenueSelection component to be more intuitive, professional, and mobile-friendly, allowing users to quickly define activity interests with preset options, custom additions, and location-aware trending content.

**Architecture:** The component will be redesigned as a multi-step mobile-first interface featuring: (1) activity interest selection via a 3-column grid of preset icons with integrated "+ Add Custom" button, (2) multi-select support through tab-based switching between selected activities, (3) location-aware YouTube trending carousel showing relevant videos per activity, and (4) Foursquare venue listings below with checkbox selection.

**Tech Stack:** React 18, Vite, React Router, CSS Grid/Flexbox for responsive layout, Foursquare API v3, YouTube Data API v3.

---

## 1. User Experience Flow

**Primary flow:**
1. User lands on Step 2 ("Favourite activities") with header showing step progress (STEP 2 OF 6)
2. Activity grid displays 6 preset activity icons (Hiking, Food, Views, Culture, Nature, Nightlife) in 3-column grid
3. "+ Add Custom" button integrated as 7th item in grid with dashed border (tap opens modal)
4. User taps activity icons to select multiple interests (visual feedback: selected icon gets teal background + border)
5. **Tab switching:** Selected activities appear as tabs below the grid (e.g., "🥾 Hiking", "🍜 Food")
6. Clicking a tab shows that activity's content (YouTube carousel + Foursquare venues)
7. YouTube carousel displays trending videos for that activity + location (e.g., "Trending in 🇹🇭 Bangkok")
8. Videos shown as full-width horizontally-scrollable cards with snap behavior
9. Below carousel: Foursquare venues for that activity in the destination
10. User checkboxes venues they're interested in
11. Can switch between tabs to select venues for multiple activities
12. "Continue" button at bottom proceeds to Step 3

**Custom interest flow:**
1. User taps "+ Add Custom" button
2. Bottom-sheet modal slides up with text input ("What interests you in Bangkok?")
3. User types custom activity (e.g., "Street Art")
4. On submit, modal closes, new tab appears for "Street Art"
5. Component queries YouTube + Foursquare for "Street Art" content in destination
6. Videos and venues populated same as preset activities

---

## 2. Component Structure

### VenueSelection (Main Component)
**Props:**
- `destination` (string): destination name (e.g., "Bangkok")
- `countryCode` (string): ISO country code for flag emoji (e.g., "TH")
- `selectedActivities` (array): currently selected activity names
- `onActivitySelect` (function): callback when activity selected/deselected
- `onContinue` (function): callback when user proceeds

**State:**
- `selectedActivities` (array): which preset/custom activities are selected
- `activeTab` (string): currently viewed activity (for carousel + venues)
- `youtubeVideos` (object): keyed by activity name, array of video objects
- `foursquareVenues` (object): keyed by activity name, array of venue objects
- `selectedVenues` (object): keyed by activity name, set of checked venue IDs
- `showCustomModal` (boolean): custom interest modal visibility
- `customActivityName` (string): user input for custom activity
- `loadingVideos` (boolean): fetching YouTube data
- `loadingVenues` (boolean): fetching Foursquare data
- `error` (string): error message if API call fails

**Behavior:**
- On mount: fetch YouTube + Foursquare data for all preset activities in destination
- On activity selection: add to selectedActivities array, auto-select as activeTab if first selection
- On activity deselection: remove from selectedActivities, if it was activeTab switch to first remaining activity
- On custom activity submit: add to selectedActivities, fetch YouTube + Foursquare for it, auto-select as activeTab
- On tab click: switch activeTab, display that activity's videos + venues
- Venue checkbox changes stored in selectedVenues (keyed by activity)

---

## 3. Subcomponents

### ActivityGrid
**Props:**
- `selectedActivities` (array): currently selected activity names
- `onActivityToggle` (function): callback for selection/deselection
- `onOpenCustomModal` (function): callback to open custom interest modal
- `presetActivities` (array): list of preset activity objects [{name, emoji}, ...]

**Renders:**
- 3-column grid layout (CSS Grid `grid-template-columns: repeat(3, 1fr)`)
- Each button: flex column, emoji (36px), activity name (11px), tap to select
- Selected button: teal border + background, name in teal color
- Deselected button: subtle border + background, name in muted gray
- "+ Add Custom" button: dashed teal border, "+" in teal (36px), "Add Custom" label

---

### ActivityTabs
**Props:**
- `selectedActivities` (array): currently selected activity names
- `activeTab` (string): currently selected activity
- `onTabChange` (function): callback when tab clicked

**Renders:**
- Horizontal scrollable flex row (overflow-x: auto)
- Each tab: 🎵 Activity Name, pill-shaped button with teal background if active
- Allows user to switch which activity's content is displayed

---

### YouTubeCarousel
**Props:**
- `activity` (string): activity name to display
- `destination` (string): destination name
- `countryCode` (string): country code for flag
- `videos` (array): video objects for this activity [{title, creator, views, hashtags, thumbnailUrl}, ...]
- `loading` (boolean): currently fetching
- `isMobile` (boolean): responsive layout flag (true <600px, false ≥600px)

**Renders:**
- Header: "🔥 Trending in 🇹🇭 Bangkok" (country emoji + destination)
- **Mobile (isMobile=true):** Horizontal scrollable container with `scroll-snap-type: x mandatory`, each card `flex: 0 0 calc(100% - 4px)` (single column visible at once)
- **Desktop (isMobile=false):** Horizontal scrollable grid showing 2-3 cards visible at once, `flex: 0 0 calc(33% - 10px)` per card (3 columns)
- Each card: thumbnail image (120px height on mobile, 160px on desktop), title (12px), creator + view count (10px), hashtags (9px), "Watch video →" link (teal)
- Thumbnail: `<img src={video.thumbnailUrl} alt={title} style={{width: '100%', height: '120px', objectFit: 'cover'}}` (YouTube provides default thumbnail)
- Swipe hint text below carousel (mobile only): "← Swipe for more →"
- Empty state if no videos found: show placeholder message

**Data source:** YouTube Data API, search by hashtag pattern `#{activity.lowercase()}in{destination.lowercase()}` + location hashtags (e.g., `#hikinginbangkok`, `#bangkok2024`)

---

### VenuesList
**Props:**
- `activity` (string): activity name
- `venues` (array): venue objects [{id, name, category, rating}, ...]
- `selectedVenues` (set): IDs of checked venues
- `onVenueToggle` (function): callback for checkbox change
- `loading` (boolean): currently fetching

**Renders:**
- Header: "Activity Name (N available)" (e.g., "Hiking Trails (5 available)")
- List of venue cards (labels with checkboxes)
- Each card: checkbox, venue name, category/type, rating (⭐)
- On checkbox change: update selectedVenues

**Data source:** Foursquare Places API, search by `query={activity}`, `location={destination}`

---

### CustomInterestModal
**Props:**
- `destination` (string): destination name (for prompt)
- `isOpen` (boolean): modal visibility
- `onClose` (function): callback to close modal
- `onSubmit` (function): callback with custom activity name
- `loading` (boolean): processing submission

**Renders:**
- Bottom-sheet modal overlay
- Title: "Add custom interest"
- Text input: placeholder "What interests you in Bangkok?"
- Cancel + Add buttons
- On submit: validate non-empty, call onSubmit, close modal

---

## 4. API Integration

### YouTube Data API

**Endpoint:** `GET https://www.googleapis.com/youtube/v3/search`

**Request for activity "Hiking" in "Bangkok":**
```
q: "#hikinginbangkok #bangkok2024"
regionCode: "TH"  (mapped from countryCode)
relevanceLanguage: "en"
maxResults: 8
order: "viewCount"
type: "video"
```

**Response fields per video:**
- `snippet.title` → title (12px)
- `snippet.channelTitle` → creator (10px)
- `statistics.viewCount` → views formatted (10px)
- `snippet.tags` or custom tag extraction → hashtags (9px)
- `snippet.thumbnails.default.url` → thumbnail image URL (320×180px from YouTube)
- `id.videoId` → YouTube video ID for "Watch video →" link (`https://youtube.com/watch?v={videoId}`)

**Fallback:** If video title contains activity name or destination, show it. If no results, show "No trending videos found" placeholder.

---

### Foursquare API v3

**Endpoint:** `GET https://api.foursquare.com/v3/places/search`

**Request for activity "Hiking" in "Bangkok":**
```
query: "Hiking"
location: "Bangkok, Thailand"
limit: 5
radius: 50000  (approx 50km)
```

**Response fields per venue:**
- `name` → venue name (12px)
- `categories[0].name` → category (10px)
- `rating` → rating (11px, #ffd93d)

**Fallback:** If no venues found, show "No venues found" placeholder.

---

## 5. Mobile Responsiveness

**Viewport target:** 375px width (iPhone SE/13 mini baseline) for mobile, 600px+ for desktop

**Mobile (<600px):**
- Activity grid: 3-column fixed, 36px emoji icons (larger touch targets)
- Padding: 16px horizontal on page, 12px on content areas
- YouTube carousel: single card visible at a time, full-width minus 4px (swipeable)
- YouTube card height: 120px (compact for mobile)
- Swipe hint visible: "← Swipe for more →"
- Venue cards: full width minus padding, flex layout for checkbox + text
- Tab scroll: horizontal overflow with smooth scroll behavior
- Modal: full viewport height, can scroll if content exceeds

**Desktop (≥600px):**
- Activity grid: still 3-column, same sizing (no change)
- YouTube carousel: shows 3 cards visible at once, `flex: 0 0 calc(33% - 10px)` per card
- YouTube card height: 160px (larger thumbnails for desktop space)
- Swipe hint hidden (obvious on desktop that there are more cards)
- Padding and spacing adjusted slightly for larger viewport
- Venue cards: may display 2-column grid if viewport >800px

**Responsive implementation:**
- Use `window.innerWidth >= 600` or CSS media query `@media (min-width: 600px)` to set `isMobile` prop
- Carousel flex basis changes based on breakpoint
- Re-test on both mobile + desktop before production

---

## 6. State Management & Data Flow

**Initial load:**
1. Component mounts with `destination` + `countryCode` props
2. Fetch YouTube videos for all 6 preset activities in parallel
3. Fetch Foursquare venues for all 6 preset activities in parallel
4. Store results in state keyed by activity name
5. Preload before Step 2 render to avoid loading delay

**On activity selection:**
1. If videos/venues already fetched → instant display
2. If not yet fetched (custom activity) → fetch on demand, show loading spinner

**On venue checkbox:**
1. Update local `selectedVenues` state
2. Parent component gets updated activity list + selected venues on "Continue" click
3. Data passed to Step 3 or stored in form context

---

## 7. Error Handling

**API failures:**
- YouTube API down → show "No trending videos available" + "Try again" button
- Foursquare API down → show "No venues available" + "Try again" button
- Custom activity fetch fails → show error toast "Couldn't load content for {activity}. Try again."

**User errors:**
- Custom activity input empty → disable "Add" button
- No activities selected on Continue → show validation error "Please select at least one activity"

---

## 8. Visual Design

**Color scheme:**
- Background: `#0a0f1e` (very dark navy)
- Text primary: `#fff` (white)
- Text secondary: `rgba(255,255,255,0.5)` (muted)
- Accent (teal): `#00d4aa`
- Accent (gold/trending): `#ffd93d`
- Borders: `rgba(255,255,255,0.08)` (subtle)
- Hover states: `rgba(0,212,170,0.2)` background

**Typography:**
- Headings: Fraunces serif, 28px, bold (step header)
- Section labels: Plus Jakarta Sans, 10px, uppercase, letter-spacing 0.1em
- Activity names: Plus Jakarta Sans, 11px
- Video/venue titles: Plus Jakarta Sans, 12px, bold
- Metadata (creator, category): Plus Jakarta Sans, 10px, muted
- Rating: Plus Jakarta Sans, 11px, gold

**Spacing:**
- Page padding: 20px (header), 16px (content)
- Section gap: 20px vertical
- Grid gap: 10px
- Card padding: 12px internal
- Border radius: 10px (cards), 12px (buttons/pills), 6px (small elements)

---

## 9. Testing Strategy

**Unit tests:**
- ActivityGrid: selection/deselection, custom modal open/close
- ActivityTabs: tab switching, active state display
- YouTubeCarousel: empty state, loading state, video list rendering
- VenuesList: checkbox toggle, venue list rendering

**Integration tests:**
- Full flow: select Hiking → tab appears → YouTube videos load → Foursquare venues load → select venues → switch to Food → new tab loads different data
- Custom activity: "+ Add Custom" → modal → type → submit → new tab created with data

**API tests:**
- YouTube query construction: verify hashtag pattern, destination, country code
- Foursquare query construction: verify activity name, destination, radius
- Response parsing: verify null-safety for missing fields
- Pagination: if >8 videos or >5 venues, verify carousel scroll and list truncation work

**Manual testing (before production):**
- Test 3-5 destination + activity combinations on real phone (iOS Safari, Android Chrome)
- Verify carousel swipe/scroll behavior on touch device
- Verify modal animation (bottom-sheet slide)
- Verify YouTube links open correctly in new tab
- Check no API rate limits hit during full flow

---

## 10. Success Criteria

- ✓ Users can select multiple preset activities in <5 taps
- ✓ Users can add custom activities via integrated "+ Add Custom" button
- ✓ YouTube carousel shows 4+ trending videos per activity with destination context (flag)
- ✓ Users can see Foursquare venues per activity below carousel
- ✓ Tab switching works smoothly (instant if data preloaded, <1s if fetching)
- ✓ Mobile viewport (375px) displays without horizontal scroll
- ✓ Professional appearance: Fraunces headings, consistent spacing, dark theme
- ✓ All APIs tested before production deployment
