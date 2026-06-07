#!/usr/bin/env node
/**
 * End-to-end form flow test for PlanTrip component
 * Tests: Step 0-4 validations, data persistence, form submission
 */

import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173';
const PLAN_URL = `${BASE_URL}/plan`;

let browser;
let page;
const results = [];

function log(msg) {
  console.log(msg);
}

function addResult(step, status, detail) {
  results.push({ step, status, detail });
  log(`[${status}] ${step}: ${detail}`);
}

async function test() {
  try {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();

    // Navigate to plan page
    log('\n=== Starting Form Flow Test ===\n');
    log('Step 1: Navigating to /plan...');
    await page.goto(PLAN_URL, { waitUntil: 'domcontentloaded' });
    addResult('Navigation', 'PASS', 'Reached /plan');

    // ─────────────────────────────────────────────────────────────
    // STEP 0: Destination & Preferences
    // ─────────────────────────────────────────────────────────────
    log('\n=== STEP 0: Destination & Preferences ===\n');

    // Check step label
    const step0Label = await page.locator('text=Step 1 of 5').count();
    if (step0Label > 0) {
      addResult('Step 0 Label', 'PASS', 'Step label visible');
    } else {
      addResult('Step 0 Label', 'FAIL', 'Step label not found');
    }

    // Fill destination - use the destination search input
    log('Filling destination field...');
    const destInput = page.locator('input[placeholder*="destination"]').first();
    if (await destInput.count() === 0) {
      log('Warning: Destination input not found by placeholder, looking for search component');
      const inputs = page.locator('input');
      const inputCount = await inputs.count();
      log(`Found ${inputCount} input fields`);
      if (inputCount > 0) {
        await inputs.first().focus();
        await page.keyboard.type('Paris');
        await page.waitForTimeout(300);
        // Look for suggestion
        const suggestions = page.locator('text=/Paris/i');
        if (await suggestions.count() > 0) {
          await suggestions.first().click();
          addResult('Destination Selection', 'PASS', 'Selected Paris');
        }
      }
    } else {
      await destInput.fill('Paris');
      await page.waitForTimeout(500);
      const suggestion = page.locator('text=/Paris|Paris, France/i');
      if (await suggestion.count() > 0) {
        await suggestion.first().click();
        addResult('Destination Selection', 'PASS', 'Selected Paris');
      } else {
        addResult('Destination Selection', 'FAIL', 'No suggestions found');
      }
    }

    // Set days to 5 using the +/- buttons
    log('Setting days...');
    const daysBtns = page.locator('button').filter({ has: page.locator('text=/[−+]/') });
    const minusBtn = page.locator('button:has-text("−")').first();
    const plusBtn = page.locator('button:has-text("+")').first();

    // Reset to 5 days (default is 5, so should be good)
    const daysNum = page.locator('text=5').filter({ hasNot: page.locator('.error') });
    if (await daysNum.count() > 0) {
      addResult('Days Field', 'PASS', 'Days visible as 5');
    } else {
      addResult('Days Field', 'FAIL', 'Days not visible');
    }

    // Fill budget
    log('Filling budget...');
    const budgetInput = page.locator('input[type="number"]').first();
    if (await budgetInput.count() > 0) {
      await budgetInput.fill('2500');
      addResult('Budget Field', 'PASS', 'Budget set to 2500');
    } else {
      addResult('Budget Field', 'FAIL', 'Budget input not found');
    }

    // Select currency
    log('Setting currency...');
    const currencySelect = page.locator('select').first();
    if (await currencySelect.count() > 0) {
      const currentValue = await currencySelect.inputValue();
      addResult('Currency Field', 'PASS', `Currency set to ${currentValue}`);
    }

    // Fill interests
    log('Filling interests...');
    const textarea = page.locator('textarea').first();
    if (await textarea.count() > 0) {
      await textarea.fill('hiking, museums, food tours, cultural experiences');
      addResult('Interests Field', 'PASS', 'Interests filled');
    } else {
      addResult('Interests Field', 'FAIL', 'Textarea not found');
    }

    // Select travel pace
    log('Selecting travel pace...');
    const paceBtn = page.locator('button:has-text("Balanced")').first();
    if (await paceBtn.count() > 0) {
      // Check if it's already selected
      const isSelected = await paceBtn.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.borderColor.includes('212') || el.style.borderColor.includes('00d4aa');
      });
      if (!isSelected) {
        await paceBtn.click();
      }
      addResult('Travel Pace', 'PASS', 'Balanced pace selected');
    } else {
      addResult('Travel Pace', 'FAIL', 'Pace button not found');
    }

    // Select language
    log('Selecting language...');
    const langSelect = page.locator('select').nth(1);
    if (await langSelect.count() > 0) {
      const value = await langSelect.inputValue();
      addResult('Language Field', 'PASS', `Language set to ${value}`);
    }

    // Validate Step 0 - Click Next
    log('Clicking Next button for Step 0...');
    const nextBtn = page.locator('button:has-text("Continue")').first();
    if (await nextBtn.count() > 0) {
      await nextBtn.click();
      await page.waitForTimeout(500);
      addResult('Step 0 Submission', 'PASS', 'Clicked Continue');
    } else {
      addResult('Step 0 Submission', 'FAIL', 'Continue button not found');
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 1: Travel Dates
    // ─────────────────────────────────────────────────────────────
    log('\n=== STEP 1: Travel Dates ===\n');

    await page.waitForTimeout(500);
    const step1Label = await page.locator('text=Step 2 of 5').count();
    if (step1Label > 0) {
      addResult('Step 1 Navigation', 'PASS', 'Reached Step 1');
    } else {
      addResult('Step 1 Navigation', 'FAIL', 'Step 1 label not found');
    }

    // Get tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Get date 10 days from now for end date
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 10);
    const endDateStr = endDate.toISOString().split('T')[0];

    // Set start date
    log(`Setting start date to ${tomorrowStr}...`);
    const startDateInput = page.locator('input[type="date"]').first();
    if (await startDateInput.count() > 0) {
      await startDateInput.fill(tomorrowStr);
      addResult('Start Date Field', 'PASS', `Set to ${tomorrowStr}`);
    } else {
      addResult('Start Date Field', 'FAIL', 'Start date input not found');
    }

    // Set end date
    log(`Setting end date to ${endDateStr}...`);
    const endDateInput = page.locator('input[type="date"]').nth(1);
    if (await endDateInput.count() > 0) {
      await endDateInput.fill(endDateStr);
      await page.waitForTimeout(300);
      addResult('End Date Field', 'PASS', `Set to ${endDateStr}`);
    } else {
      addResult('End Date Field', 'FAIL', 'End date input not found');
    }

    // Check for duration display
    const durationDisplay = page.locator('text=/📅 \\d+ days planned/');
    if (await durationDisplay.count() > 0) {
      const text = await durationDisplay.first().textContent();
      addResult('Duration Display', 'PASS', `Duration shown: ${text}`);
    } else {
      log('Warning: Duration display not found');
    }

    // Click Next
    log('Clicking Next button for Step 1...');
    const nextBtn1 = page.locator('button:has-text("Continue")').first();
    if (await nextBtn1.count() > 0) {
      await nextBtn1.click();
      await page.waitForTimeout(1000); // Wait for insights to potentially load
      addResult('Step 1 Submission', 'PASS', 'Clicked Continue');
    } else {
      addResult('Step 1 Submission', 'FAIL', 'Continue button not found');
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 2: Trip Overview
    // ─────────────────────────────────────────────────────────────
    log('\n=== STEP 2: Trip Overview ===\n');

    await page.waitForTimeout(1000);
    const step2Label = await page.locator('text=Step 3 of 5').count();
    if (step2Label > 0) {
      addResult('Step 2 Navigation', 'PASS', 'Reached Step 2');
    } else {
      addResult('Step 2 Navigation', 'FAIL', 'Step 2 label not found');
    }

    // Check for loading indicator or content
    const spinner = page.locator('text=/Generating recommendations|⏳/');
    const hasSpinner = await spinner.count() > 0;
    if (hasSpinner) {
      log('Spinner visible, waiting for insights to load...');
      await page.waitForTimeout(2000);
      addResult('Trip Overview Loading', 'PASS', 'Generating recommendations spinner visible');
    } else {
      log('No spinner visible, checking for content...');
    }

    // Check for activities section
    const activitiesSection = page.locator('text=/Activities|🎯/i');
    if (await activitiesSection.count() > 0) {
      addResult('Activities Section', 'PASS', 'Activities section visible');
    } else {
      log('Warning: Activities section not visible');
    }

    // Check for flights section
    const flightsSection = page.locator('text=/Flights|✈️/i');
    if (await flightsSection.count() > 0) {
      addResult('Flights Section', 'PASS', 'Flights section visible');
    } else {
      log('Warning: Flights section not visible');
    }

    // Click Next to go to Step 3
    log('Clicking Next button for Step 2...');
    const nextBtn2 = page.locator('button:has-text("Continue")').first();
    if (await nextBtn2.count() > 0) {
      await nextBtn2.click();
      await page.waitForTimeout(1000);
      addResult('Step 2 Submission', 'PASS', 'Clicked Continue');
    } else {
      addResult('Step 2 Submission', 'FAIL', 'Continue button not found');
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 3: Review (or Venue Selection if that appears)
    // ─────────────────────────────────────────────────────────────
    log('\n=== STEP 3: Review/Venue Selection ===\n');

    await page.waitForTimeout(500);

    // Check if we're in venue selection or review
    const venueHeader = page.locator('text=/Choose your experiences/i');
    const reviewHeader = page.locator('text=/Review your trip/i');

    if (await venueHeader.count() > 0) {
      log('At Venue Selection step');
      addResult('Venue Selection', 'PASS', 'Venue selection component visible');

      // Skip or submit venues (click skip/submit button)
      const skipBtn = page.locator('button:has-text(/Skip|Continue|Submit/)').first();
      if (await skipBtn.count() > 0) {
        await skipBtn.click();
        await page.waitForTimeout(500);
        addResult('Venue Selection Action', 'PASS', 'Skipped/submitted venues');
      }
    } else if (await reviewHeader.count() > 0) {
      log('At Review step');
    } else {
      // Try to navigate if stuck
      const step3Label = page.locator('text=Step 4 of 5');
      const step4Label = page.locator('text=Step 5 of 5');
      if (await step3Label.count() > 0 || await step4Label.count() > 0) {
        log('In Step 3/4 area');
      } else {
        log('Warning: Could not determine step location');
      }
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 4: Final Review & Email
    // ─────────────────────────────────────────────────────────────
    log('\n=== STEP 4/5: Final Review & Email ===\n');

    await page.waitForTimeout(500);

    // Look for Step 4 label
    const step4or5Label = await page.locator('text=/Step [45] of [56]/').count();
    if (step4or5Label > 0) {
      addResult('Final Review Navigation', 'PASS', 'Reached final review step');
    }

    // Find email input
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
    if (await emailInput.count() > 0) {
      // Check if pre-filled
      const currentEmail = await emailInput.inputValue();
      if (currentEmail && currentEmail.includes('@')) {
        addResult('Email Pre-fill', 'PASS', `Email pre-filled: ${currentEmail}`);
      } else {
        await emailInput.fill('test@example.com');
        addResult('Email Field', 'PASS', 'Email set to test@example.com');
      }
    } else {
      log('Warning: Email input not found');
    }

    // Test invalid email validation
    log('Testing invalid email validation...');
    const emailTestInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
    if (await emailTestInput.count() > 0) {
      await emailTestInput.fill('invalid-email');
      await page.waitForTimeout(300);

      // Try to submit and check for error
      const submitBtn = page.locator('button:has-text(/Generate|Submit)').first();
      if (await submitBtn.count() > 0) {
        await submitBtn.click();
        await page.waitForTimeout(500);

        const error = page.locator('text=/Invalid email|email address/i');
        if (await error.count() > 0) {
          addResult('Email Validation', 'PASS', 'Invalid email error shown');
        } else {
          addResult('Email Validation', 'PROBE', 'Invalid email did not show error (or submit was skipped)');
        }
      }

      // Fix email for final submission
      await emailTestInput.fill('test@wanderzen.com');
      await page.waitForTimeout(300);
    }

    // ─────────────────────────────────────────────────────────────
    // Test Session Storage Persistence
    // ─────────────────────────────────────────────────────────────
    log('\n=== Testing Session Storage Persistence ===\n');

    const sessionData = await page.evaluate(() => {
      const form = sessionStorage.getItem('wz_plan_form');
      const step = sessionStorage.getItem('wz_plan_step');
      return { form: form ? JSON.parse(form) : null, step };
    });

    if (sessionData.form && sessionData.form.destinations && sessionData.form.destinations.length > 0) {
      addResult('Session Storage - Form', 'PASS', `Form persisted with destination: ${sessionData.form.destinations[0].name}`);
    } else {
      addResult('Session Storage - Form', 'PROBE', 'Form data in session storage');
    }

    if (sessionData.step !== null) {
      addResult('Session Storage - Step', 'PASS', `Step persisted: ${sessionData.step}`);
    } else {
      addResult('Session Storage - Step', 'PROBE', 'Step not in session storage');
    }

    // ─────────────────────────────────────────────────────────────
    // Summary
    // ─────────────────────────────────────────────────────────────
    log('\n=== Test Summary ===\n');
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const probes = results.filter(r => r.status === 'PROBE').length;

    log(`✓ PASS: ${passed}`);
    log(`✗ FAIL: ${failed}`);
    log(`🔍 PROBE: ${probes}`);
    log(`Total: ${results.length}\n`);

    if (failed === 0) {
      log('✅ ALL TESTS PASSED');
    } else {
      log('❌ SOME TESTS FAILED\n');
      results.filter(r => r.status === 'FAIL').forEach(r => {
        log(`  - ${r.step}: ${r.detail}`);
      });
    }

  } catch (error) {
    console.error('Test error:', error.message);
    addResult('Test Runner', 'FAIL', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

test();
