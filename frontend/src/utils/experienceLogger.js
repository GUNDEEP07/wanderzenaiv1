/**
 * Experience logger for Step 3 (VenueSelection)
 * Tracks user interactions and API call status for debugging and analytics
 */

export function logExperienceEvent(eventName, details = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    event: eventName,
    ...details,
  };

  // Log to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[Experience]', eventName, details);
  }

  // Send to analytics provider if available
  try {
    if (window.analytics) {
      window.analytics.track(`experience_${eventName}`, logEntry);
    }
  } catch (err) {
    console.warn('Analytics tracking failed:', err);
  }
}

// Experience event types
export const EXPERIENCE_EVENTS = {
  // Activity selection
  ACTIVITY_SELECTED: 'activity_selected',
  ACTIVITY_DESELECTED: 'activity_deselected',
  CUSTOM_ACTIVITY_ADDED: 'custom_activity_added',

  // Data loading
  VENUES_LOADING: 'venues_loading',
  VENUES_LOADED: 'venues_loaded',
  VENUES_ERROR: 'venues_error',
  VENUES_RETRY: 'venues_retry',

  VIDEOS_LOADING: 'videos_loading',
  VIDEOS_LOADED: 'videos_loaded',
  VIDEOS_ERROR: 'videos_error',
  VIDEOS_RETRY: 'videos_retry',

  // Search
  SEARCH_INITIATED: 'search_initiated',
  SEARCH_RESULTS_LOADED: 'search_results_loaded',
  SEARCH_ERROR: 'search_error',
  SEARCH_EMPTY: 'search_empty',

  // Venue interaction
  VENUE_ADDED: 'venue_added',
  VENUE_REMOVED: 'venue_removed',
  VENUE_DAY_ASSIGNED: 'venue_day_assigned',

  // Page lifecycle
  STEP_ENTERED: 'step_entered',
  STEP_SUBMITTED: 'step_submitted',
  STEP_SKIPPED: 'step_skipped',
};

// Helper to log venue loading
export function logVenueLoading(activity, destination) {
  logExperienceEvent(EXPERIENCE_EVENTS.VENUES_LOADING, {
    activity,
    destination,
  });
}

export function logVenueLoaded(activity, destination, count) {
  logExperienceEvent(EXPERIENCE_EVENTS.VENUES_LOADED, {
    activity,
    destination,
    count,
  });
}

export function logVenueError(activity, destination, error) {
  logExperienceEvent(EXPERIENCE_EVENTS.VENUES_ERROR, {
    activity,
    destination,
    error: error?.message || String(error),
  });
}

export function logVenueRetry(activity, destination, attempt) {
  logExperienceEvent(EXPERIENCE_EVENTS.VENUES_RETRY, {
    activity,
    destination,
    attempt,
  });
}

// Helper to log video loading
export function logVideoLoading(activity, destination) {
  logExperienceEvent(EXPERIENCE_EVENTS.VIDEOS_LOADING, {
    activity,
    destination,
  });
}

export function logVideoLoaded(activity, destination, count) {
  logExperienceEvent(EXPERIENCE_EVENTS.VIDEOS_LOADED, {
    activity,
    destination,
    count,
  });
}

export function logVideoError(activity, destination, error) {
  logExperienceEvent(EXPERIENCE_EVENTS.VIDEOS_ERROR, {
    activity,
    destination,
    error: error?.message || String(error),
  });
}

// Helper to log search
export function logSearchInitiated(query, destination) {
  logExperienceEvent(EXPERIENCE_EVENTS.SEARCH_INITIATED, {
    query,
    destination,
  });
}

export function logSearchLoaded(query, destination, count) {
  logExperienceEvent(EXPERIENCE_EVENTS.SEARCH_RESULTS_LOADED, {
    query,
    destination,
    count,
  });
}

export function logSearchEmpty(query, destination) {
  logExperienceEvent(EXPERIENCE_EVENTS.SEARCH_EMPTY, {
    query,
    destination,
  });
}

export function logSearchError(query, destination, error) {
  logExperienceEvent(EXPERIENCE_EVENTS.SEARCH_ERROR, {
    query,
    destination,
    error: error?.message || String(error),
  });
}

// Helper to log activity selection
export function logActivitySelected(activity, destination) {
  logExperienceEvent(EXPERIENCE_EVENTS.ACTIVITY_SELECTED, {
    activity,
    destination,
  });
}

export function logActivityDeselected(activity, destination) {
  logExperienceEvent(EXPERIENCE_EVENTS.ACTIVITY_DESELECTED, {
    activity,
    destination,
  });
}

// Helper to log venue interaction
export function logVenueAdded(venueId, venueName, activity, destination) {
  logExperienceEvent(EXPERIENCE_EVENTS.VENUE_ADDED, {
    venueId,
    venueName,
    activity,
    destination,
  });
}

export function logVenueRemoved(venueId, venueName, activity, destination) {
  logExperienceEvent(EXPERIENCE_EVENTS.VENUE_REMOVED, {
    venueId,
    venueName,
    activity,
    destination,
  });
}

export function logVenueDayAssigned(venueId, venueName, day, destination) {
  logExperienceEvent(EXPERIENCE_EVENTS.VENUE_DAY_ASSIGNED, {
    venueId,
    venueName,
    day,
    destination,
  });
}
