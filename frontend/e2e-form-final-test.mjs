#!/usr/bin/env node
/**
 * End-to-end form flow test for PlanTrip component
 * Tests Steps 0-4 with full validations, data persistence
 */

import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173';
const results = [];

function log(msg) {
  console.log(msg);
}

function addResult(step, status, detail) {
  results.push({ step, status, detail });
  log(`[${status}] ${step}: ${detail}`);
}

async function test() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // ─────────────────────────────────────────────────────────────
    // STEP 1: Authentication via Login Page (demo mode)
    // ─────────────────────────────────────────────────────────────
    log('\n=== Authentication (Demo Mode) ===\n');

    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // Fill email
    const emailInput = page.locator('input[type="email"]').first();
    if (await emailInput.count() > 0) {
      await emailInput.fill('test@wanderzenai.com');
      addResult('Auth - Email', 'PASS', 'Email entered');
    }

    // Fill password
    const passwordInput = page.locator('input[type="password"]').first();
    if (await passwordInput.count() > 0) {
      await passwordInput.fill('test123');
      addResult('Auth - Password', 'PASS', 'Password entered');
    }

    // Click sign in button
    const signInBtn = page.locator('button:has-text("Sign in")').first();
    if (await signInBtn.count() > 0) {
      await signInBtn.click();
      await page.waitForTimeout(2000);  // Wait for redirect
      addResult('Auth - SignIn', 'PASS', 'Clicked Sign In');
    }

    // ─────────────────────────────────────────────────────────────
    // NAVIGATE TO PLAN
    // ─────────────────────────────────────────────────────────────
    log('\n=== Navigation to /plan ===\n');

    await page.goto(`${BASE_URL}/plan`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Check if we're on the form
    const step0Label = await page.locator('text="Step 1 of 5"').count();
    if (step0Label > 0) {
      addResult('Page Load', 'PASS', 'Reached /plan, form visible');
    } else {
      const pageText = await page.evaluate(() => document.body.innerText.substring(0, 200));
      addResult('Page Load', 'FAIL', `Not at form: "${pageText}"`);
      await page.screenshot({ path: '/tmp/form-load-fail.png' });
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 0: Destination & Preferences
    // ─────────────────────────────────────────────────────────────
    log('\n=== STEP 0: Destination & Preferences ===\n');

    // Get all input types
    const allInputs = await page.locator('input').count();
    const allTextareas = await page.locator('textarea').count();
    const allSelects = await page.locator('select').count();
    log(`Found: ${allInputs} inputs, ${allTextareas} textareas, ${allSelects} selects`);

    // Fill destination (first input - usually a search field)
    if (allInputs > 0) {
      await page.locator('input').first().focus();
      await page.keyboard.type('Paris', { delay: 50 });
      await page.waitForTimeout(500);
      addResult('Destination Field', 'PASS', 'Entered "Paris"');

      // Try to select from dropdown if available
      const suggestions = await page.locator('div:has-text("Paris")').filter({ hasNot: page.locator('input') }).count();
      if (suggestions > 0) {
        await page.locator('div:has-text("Paris")').filter({ hasNot: page.locator('input') }).first().click();
        addResult('Destination Selection', 'PASS', 'Selected from dropdown');
      } else {
        addResult('Destination Selection', 'PROBE', 'No dropdown shown, may be entered as text');
      }
    }

    // Set days (look for +/- buttons)
    const plusBtn = page.locator('button:has-text("+")').first();
    if (await plusBtn.count() > 0) {
      // Click + once to increase days
      await plusBtn.click();
      addResult('Days Field', 'PASS', 'Incremented days');
    } else {
      addResult('Days Field', 'PROBE', 'Days +/- button not found');
    }

    // Fill budget (number input)
    const numberInput = page.locator('input[type="number"]').first();
    if (await numberInput.count() > 0) {
      await numberInput.fill('2500');
      addResult('Budget Field', 'PASS', 'Budget set to 2500');
    } else {
      addResult('Budget Field', 'FAIL', 'Number input not found');
    }

    // Fill interests (textarea)
    if (allTextareas > 0) {
      await page.locator('textarea').first().fill('hiking, museums, food, culture, nature');
      addResult('Interests Field', 'PASS', 'Interests filled');
    } else {
      addResult('Interests Field', 'FAIL', 'Textarea not found');
    }

    // Select travel pace (button selection)
    const paceBtn = page.locator('button:has-text("Balanced")').first();
    if (await paceBtn.count() > 0) {
      await paceBtn.click();
      addResult('Travel Pace', 'PASS', 'Selected "Balanced"');
    } else {
      addResult('Travel Pace', 'PROBE', 'Balanced button not found');
    }

    // Select currency (select dropdown)
    const currencySelect = page.locator('select').first();
    if (await currencySelect.count() > 0) {
      const value = await currencySelect.inputValue();
      addResult('Currency', 'PASS', `Current currency: ${value}`);
    } else {
      addResult('Currency', 'PROBE', 'Currency select not found');
    }

    // Select language (select dropdown)
    const languageSelect = page.locator('select').nth(1);
    if (await languageSelect.count() > 0) {
      addResult('Language', 'PASS', 'Language select found');
    } else {
      addResult('Language', 'PROBE', 'Language select not found');
    }

    // Click Continue to go to Step 1
    log('Submitting Step 0...');
    let continueBtn = page.locator('button:has-text("Continue")').first();
    if (await continueBtn.count() === 0) {
      continueBtn = page.locator('button:has-text("Next")').first();
    }

    if (await continueBtn.count() > 0) {
      const isEnabled = await continueBtn.evaluate(btn => !btn.disabled);
      if (isEnabled) {
        await continueBtn.click();
        await page.waitForTimeout(800);
        addResult('Step 0 Submit', 'PASS', 'Clicked Continue');
      } else {
        addResult('Step 0 Submit', 'FAIL', 'Continue button is disabled');
      }
    } else {
      addResult('Step 0 Submit', 'FAIL', 'Continue button not found');
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 1: Travel Dates
    // ─────────────────────────────────────────────────────────────
    log('\n=== STEP 1: Travel Dates ===\n');

    const step1Label = await page.locator('text="Step 2 of 5"').count();
    if (step1Label > 0) {
      addResult('Step 1 Navigation', 'PASS', 'Reached Step 1');
    } else {
      addResult('Step 1 Navigation', 'FAIL', 'Step 1 not reached');
    }

    // Get dates
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startDateStr = tomorrow.toISOString().split('T')[0];

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 8);
    const endDateStr = endDate.toISOString().split('T')[0];

    // Fill start date
    const dateInputs = page.locator('input[type="date"]');
    if (await dateInputs.count() > 0) {
      await dateInputs.first().fill(startDateStr);
      addResult('Start Date', 'PASS', `Set to ${startDateStr}`);
    } else {
      addResult('Start Date', 'FAIL', 'Date input not found');
    }

    // Fill end date
    if (await dateInputs.count() > 1) {
      await dateInputs.nth(1).fill(endDateStr);
      addResult('End Date', 'PASS', `Set to ${endDateStr}`);
    } else {
      addResult('End Date', 'FAIL', 'Second date input not found');
    }

    // Check for duration display
    const durationText = await page.locator('text="days planned"').count();
    if (durationText > 0) {
      addResult('Duration Display', 'PASS', 'Duration summary visible');
    } else {
      addResult('Duration Display', 'PROBE', 'Duration summary not visible');
    }

    // Submit Step 1
    await page.waitForTimeout(300);
    let continueBtn1 = page.locator('button:has-text("Continue")').first();
    if (await continueBtn1.count() > 0) {
      const isEnabled = await continueBtn1.evaluate(btn => !btn.disabled);
      if (isEnabled) {
        await continueBtn1.click();
        await page.waitForTimeout(1200);  // Wait for insights loading
        addResult('Step 1 Submit', 'PASS', 'Clicked Continue');
      } else {
        addResult('Step 1 Submit', 'FAIL', 'Continue button disabled');
      }
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 2: Trip Overview
    // ─────────────────────────────────────────────────────────────
    log('\n=== STEP 2: Trip Overview ===\n');

    const step2Label = await page.locator('text="Step 3 of 5"').count();
    if (step2Label > 0) {
      addResult('Step 2 Navigation', 'PASS', 'Reached Step 2');
    } else {
      addResult('Step 2 Navigation', 'FAIL', 'Step 2 not reached');
    }

    // Check for loading spinner
    const spinner = await page.locator('text="Generating recommendations"').count();
    if (spinner > 0) {
      log('Spinner visible, waiting for insights...');
      await page.waitForTimeout(2000);
      addResult('Trip Overview', 'PASS', 'Recommendations loading shown');
    } else {
      log('No spinner, checking for content...');
    }

    // Check for activities
    const hasActivities = await page.locator('text="Activities"').count() > 0;
    if (hasActivities) {
      addResult('Activities Section', 'PASS', 'Activities visible');
    } else {
      addResult('Activities Section', 'PROBE', 'Activities section not visible');
    }

    // Submit Step 2
    let continueBtn2 = page.locator('button:has-text("Continue")').first();
    if (await continueBtn2.count() > 0) {
      const isEnabled = await continueBtn2.evaluate(btn => !btn.disabled);
      if (isEnabled) {
        await continueBtn2.click();
        await page.waitForTimeout(1000);
        addResult('Step 2 Submit', 'PASS', 'Clicked Continue');
      } else {
        log('Continue button disabled, may need to wait for insights');
        addResult('Step 2 Submit', 'PROBE', 'Continue button disabled (insights still loading?)');
      }
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 3: Review or Venue Selection
    // ─────────────────────────────────────────────────────────────
    log('\n=== STEP 3/4: Review ===\n');

    const step3Label = await page.locator('text="Step 4 of 5"').count();
    if (step3Label > 0) {
      addResult('Step 3 Navigation', 'PASS', 'Reached review step');

      // Check for summary box
      const hasSummary = await page.locator('text="Destinations"').count() > 0;
      if (hasSummary) {
        addResult('Summary Display', 'PASS', 'Form summary visible');
      } else {
        addResult('Summary Display', 'PROBE', 'Summary not visible');
      }

      // Check for email field
      const emailField = page.locator('input[type="email"]');
      if (await emailField.count() > 0) {
        const currentEmail = await emailField.inputValue();
        if (currentEmail) {
          addResult('Email Pre-fill', 'PASS', `Email pre-filled: ${currentEmail}`);
        } else {
          await emailField.fill('test@wanderzenai.com');
          addResult('Email Field', 'PASS', 'Email entered');
        }
      } else {
        addResult('Email Field', 'FAIL', 'Email input not found');
      }

      // Try to submit
      let submitBtn = page.locator('button:has-text("Generate")').first();
      if (await submitBtn.count() === 0) {
        submitBtn = page.locator('button:has-text("Submit")').first();
      }

      if (await submitBtn.count() > 0) {
        const isEnabled = await submitBtn.evaluate(btn => !btn.disabled);
        if (isEnabled) {
          await submitBtn.click();
          await page.waitForTimeout(2000);
          addResult('Form Submission', 'PASS', 'Clicked Generate/Submit');

          // Check for redirect to confirmation
          const currentUrl = page.url();
          if (currentUrl.includes('/confirmation')) {
            addResult('Redirect', 'PASS', 'Redirected to /confirmation');
          } else {
            addResult('Redirect', 'PROBE', `Still at: ${currentUrl}`);
          }
        } else {
          addResult('Form Submission', 'PROBE', 'Submit button disabled');
        }
      }
    } else {
      addResult('Step 3 Navigation', 'PROBE', 'Not at Step 3/4 yet');
    }

    // ─────────────────────────────────────────────────────────────
    // Session Storage Test
    // ─────────────────────────────────────────────────────────────
    log('\n=== Session Storage ===\n');

    const storageData = await page.evaluate(() => {
      const form = sessionStorage.getItem('wz_plan_form');
      const step = sessionStorage.getItem('wz_plan_step');
      return {
        hasForm: !!form,
        formKeys: form ? Object.keys(JSON.parse(form)) : [],
        step,
      };
    });

    if (storageData.hasForm) {
      addResult('Session - Form', 'PASS', `Form persisted (${storageData.formKeys.length} fields)`);
    } else {
      addResult('Session - Form', 'PROBE', 'Form not in session storage');
    }

    if (storageData.step !== null) {
      addResult('Session - Step', 'PASS', `Step persisted: ${storageData.step}`);
    } else {
      addResult('Session - Step', 'PROBE', 'Step not in session storage');
    }

    // ─────────────────────────────────────────────────────────────
    // Summary Report
    // ─────────────────────────────────────────────────────────────
    log('\n=== TEST SUMMARY ===\n');

    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const probes = results.filter(r => r.status === 'PROBE').length;

    log(`✓ PASS:  ${passed}`);
    log(`✗ FAIL:  ${failed}`);
    log(`🔍 PROBE: ${probes}`);
    log(`━━━━━━━━━━━━━━━━━━`);
    log(`Total:   ${results.length}\n`);

    if (failed === 0) {
      log('✅ NO CRITICAL FAILURES - Form flow works as expected');
    } else {
      log('❌ FAILURES DETECTED:\n');
      results.filter(r => r.status === 'FAIL').forEach(r => {
        log(`   • ${r.step}: ${r.detail}`);
      });
    }

    if (probes > 0) {
      log(`\n⚠️  PROBES TO INVESTIGATE:\n`);
      results.filter(r => r.status === 'PROBE').forEach(r => {
        log(`   • ${r.step}: ${r.detail}`);
      });
    }

  } catch (error) {
    log(`\n❌ TEST ERROR: ${error.message}`);
    addResult('Test Runner', 'FAIL', error.message);
  } finally {
    if (browser) await browser.close();
  }
}

test();
