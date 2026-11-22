/**
 * Planner steps (Nov 2026 redesign: 5 steps). Saved plans from the old 6-step planner
 * (sessionStorage / dashboard drafts) carry their old step number; legacyStep() maps it.
 */
export const PLAN_VERSION = 3;
export const STEP_BASICS = 0;
export const STEP_ROUTE = 1;
export const STEP_DAYS = 2;
export const STEP_STAYS = 3;
export const STEP_REVIEW = 4;
export const STEP_NAMES = ['Trip basics', 'Your route', 'Must-sees', 'Stays & flights', 'Check your trip'];
export const STEP_STORAGE_KEY = 'wz_plan_step_v3';
export const FORM_STORAGE_KEY = 'wz_plan_form_v2'; // form shape unchanged

// old: 0 destination · 1 dates · 2 route · 3 overview · 4 experiences · 5 review
const LEGACY = [STEP_BASICS, STEP_BASICS, STEP_ROUTE, STEP_STAYS, STEP_DAYS, STEP_REVIEW];

/** Step to open for a saved { form, step }. */
export function resumeStep(form, step) {
  const n = Number(step) || 0;
  const mapped = form?.planVersion === PLAN_VERSION ? n : (LEGACY[n] ?? STEP_BASICS);
  return Math.min(Math.max(mapped, 0), STEP_NAMES.length - 1);
}
