/**
 * Date validation utilities for trip planning
 * Handles validation of start/end dates, trip duration, and date ranges
 */

/**
 * Check if an ISO date string is in the past (before today)
 * @param {string} dateStr - ISO date string (YYYY-MM-DD)
 * @returns {boolean} true if date is before today, false otherwise
 */
export function isDateInPast(dateStr) {
  if (!dateStr) return false;
  const inputDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return inputDate < today;
}

/**
 * Check if end date is after start date
 * @param {string} startStr - ISO date string (YYYY-MM-DD)
 * @param {string} endStr - ISO date string (YYYY-MM-DD)
 * @returns {boolean} true if end date is after start date, false otherwise
 */
export function isEndDateAfterStartDate(startStr, endStr) {
  if (!startStr || !endStr) return false;
  const startDate = new Date(startStr);
  const endDate = new Date(endStr);
  return endDate > startDate;
}

/**
 * Validate a date range (both start and end dates)
 * Checks for: past dates, end after start, valid date strings
 * @param {string} startStr - ISO date string (YYYY-MM-DD)
 * @param {string} endStr - ISO date string (YYYY-MM-DD)
 * @returns {{valid: boolean, errors: string[]}} validation result with error messages
 */
export function validateDateRange(startStr, endStr) {
  const errors = [];

  // Check for empty values
  if (!startStr) {
    errors.push('Start date is required');
  }
  if (!endStr) {
    errors.push('End date is required');
  }

  if (!startStr || !endStr) {
    return { valid: false, errors };
  }

  // Check if dates are valid
  const startDate = new Date(startStr);
  const endDate = new Date(endStr);

  if (isNaN(startDate.getTime())) {
    errors.push('Start date is invalid');
  }
  if (isNaN(endDate.getTime())) {
    errors.push('End date is invalid');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Check if start date is in the past
  if (isDateInPast(startStr)) {
    errors.push('Start date cannot be in the past');
  }

  // Check if end date is after start date
  if (!isEndDateAfterStartDate(startStr, endStr)) {
    errors.push('End date must be after start date');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Calculate the number of days in a trip (inclusive of both start and end dates)
 * @param {string} startStr - ISO date string (YYYY-MM-DD)
 * @param {string} endStr - ISO date string (YYYY-MM-DD)
 * @returns {number} number of days (inclusive), or 0 if dates are invalid
 */
export function calculateTripDays(startStr, endStr) {
  if (!startStr || !endStr) return 0;

  const startDate = new Date(startStr);
  const endDate = new Date(endStr);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return 0;
  }

  const diffTime = endDate - startDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // Add 1 to make it inclusive of both start and end dates
  return Math.max(0, diffDays + 1);
}
