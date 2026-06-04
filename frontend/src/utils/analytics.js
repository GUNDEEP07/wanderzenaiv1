// WanderZenAI Analytics — thin wrapper around gtag
// All events flow to GA4 property G-30SQXCEL52

function track(eventName, params = {}) {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', eventName, params);
}

// ── Auth events ──────────────────────────────────────────────────────────────

export const analytics = {
  /** User completed sign-up */
  signUp: (method) => track('sign_up', { method }),

  /** User signed in */
  login: (method) => track('login', { method }),

  /** User signed out */
  signOut: () => track('sign_out'),

  // ── Trip planning ──────────────────────────────────────────────────────────

  /** User submitted the itinerary form */
  tripSubmitted: ({ destination, days, travelStyle, plan }) =>
    track('trip_submitted', { destination, days, travel_style: (travelStyle || []).join(','), plan: plan || 'free' }),

  /** User previewed itinerary (Step 5 review) */
  previewLoaded: (destination) =>
    track('preview_loaded', { destination }),

  /** User viewed a generated itinerary online */
  itineraryViewed: (destination) =>
    track('itinerary_viewed', { destination }),

  /** User downloaded PDF */
  pdfDownloaded: (destination) =>
    track('pdf_downloaded', { destination }),

  /** User clicked Re-plan on dashboard */
  replanClicked: (destination) =>
    track('replan_clicked', { destination }),

  // ── Monetisation ──────────────────────────────────────────────────────────

  /** User clicked upgrade/buy button */
  upgradeClicked: (plan, location) =>
    track('upgrade_clicked', { plan, location }),

  /** User hit the free tier limit */
  freeLimitHit: () =>
    track('free_limit_hit'),

  // ── Chat ──────────────────────────────────────────────────────────────────

  /** User opened the AI travel advisor chat */
  chatOpened: () => track('chat_opened'),

  /** User sent a message in chat */
  chatMessageSent: () => track('chat_message_sent'),

  /** Chat collected all trip details and showed Plan CTA */
  chatReadyToPlan: (destination) =>
    track('chat_ready_to_plan', { destination }),

  /** User clicked "Plan this trip" from chat */
  chatTripStarted: (destination) =>
    track('chat_trip_started', { destination }),

  // ── Navigation ────────────────────────────────────────────────────────────

  /** GA4 funnel event — fired each time the user advances to a new step */
  stepReached: (stepName, stepIndex) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'step_reached', {
        event_category: 'PlanTrip',
        step_name: stepName,
        step_index: stepIndex,
      });
    }
  },

  /** User clicked CTA on landing page */
  ctaClicked: (location) => track('cta_clicked', { location }),

  /** User landed on pricing page */
  pricingViewed: () => track('pricing_viewed'),
};
