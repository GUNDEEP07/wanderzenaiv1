/**
 * Budget validation utilities
 * Validates budget values and detects suspicious inputs (likely typos or errors)
 */

const MIN_BUDGET = 500;
const MAX_BUDGET = 50000;

/**
 * Validates if a budget value is within acceptable range
 * @param {number} budget - The budget value to validate
 * @returns {Object} Validation result with shape { valid: boolean, error: string | null }
 */
export const validateBudget = (budget) => {
  // Check if budget is a number
  if (typeof budget !== 'number' || isNaN(budget)) {
    return {
      valid: false,
      error: 'Budget must be a valid number'
    };
  }

  // Check if budget is greater than zero
  if (budget <= 0) {
    return {
      valid: false,
      error: 'Budget must be greater than $0'
    };
  }

  // Check if budget is within valid range
  if (budget < MIN_BUDGET) {
    return {
      valid: false,
      error: `Budget must be at least $${MIN_BUDGET}`
    };
  }

  if (budget > MAX_BUDGET) {
    return {
      valid: false,
      error: `Budget cannot exceed $${MAX_BUDGET}`
    };
  }

  return {
    valid: true,
    error: null
  };
};

/**
 * Checks if a budget value is suspiciously low (likely a typo)
 * A suspiciously low budget is less than $100
 * @param {number} budget - The budget value to check
 * @returns {boolean} True if budget appears to be a typo
 */
export const isBudgetSuspiciouslyLow = (budget) => {
  return typeof budget === 'number' && !isNaN(budget) && budget > 0 && budget < 100;
};

/**
 * Checks if a budget value is suspiciously high (likely an error)
 * A suspiciously high budget is greater than $100,000
 * @param {number} budget - The budget value to check
 * @returns {boolean} True if budget appears to be an error
 */
export const isBudgetSuspiciouslyHigh = (budget) => {
  return typeof budget === 'number' && !isNaN(budget) && budget > 100000;
};
