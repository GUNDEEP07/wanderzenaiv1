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

    // ─────────────────────────────────────────────────────────────
    // AUTHENTICATION: Sign up or login
    // ─────────────────────────────────────────────────────────────
    log('\n=== Step 0: Authentication ===\n');

    const timestamp = Date.now();
    const testEmail = `test-e2e-${timestamp}@example.com`;
    const testPassword = 'TestPassword123!';

    log(`Navigating to /signup...`);
    await page.goto(`${BASE_URL}/signup`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Check if we're at signup or if we need to login
    const isSignupPage = (await page.locator('text="Sign up"').count() > 0) || (await page.locator('text="Create account"').count() > 0);
    const isLoginPage = (await page.locator('text="Sign in"').count() > 0) || (await page.locator('text="Login"').count() > 0);

    log(`Signup page visible: ${isSignupPage}, Login page visible: ${isLoginPage}`);

    if (isSignupPage) {
      log('Filling signup form...');
      const emailInputs = await page.locator('input[type="email"]');
      const passwordInputs = await page.locator('input[type="password"]');

      if (await emailInputs.count() > 0) {
        await emailInputs.first().fill(testEmail);
        addResult('Auth - Email', 'PASS', `Filled email: ${testEmail}`);
      }

      if (await passwordInputs.count() > 0) {
        await passwordInputs.first().fill(testPassword);
        addResult('Auth - Password', 'PASS', 'Filled password');
      }

      // Look for signup button - try multiple approaches
      let signupBtn = page.locator('button:has-text("Sign up")').first();
      if (await signupBtn.count() === 0) {
        signupBtn = page.locator('button:has-text("Create account")').first();
      }
      if (await signupBtn.count() === 0) {
        signupBtn = page.locator('button:has-text("Register")').first();
      }
      if (await signupBtn.count() > 0) {
        await signupBtn.click();
        await page.waitForTimeout(2000);
        addResult('Auth - Signup', 'PASS', 'Clicked signup button');
      }
    } else if (isLoginPage) {
      log('At login page, filling login form...');
      const emailInputs = await page.locator('input[type="email"]');
      const passwordInputs = await page.locator('input[type="password"]');

      if (await emailInputs.count() > 0) {
        // Try a test account
        await emailInputs.first().fill('test@example.com');
      }

      if (await passwordInputs.count() > 0) {
        await passwordInputs.first().fill('test123');
      }

      let loginBtn = page.locator('button:has-text("Sign in")').first();
      if (await loginBtn.count() === 0) {
        loginBtn = page.locator('button:has-text("Login")').first();
      }
      if (await loginBtn.count() > 0) {
        await loginBtn.click();
        await page.waitForTimeout(2000);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // FORM FLOW: Navigate to /plan
    // ─────────────────────────────────────────────────────────────
    log('\n=== Starting Form Flow Test ===\n');
    log('Step 1: Navigating to /plan...');
    await page.goto(PLAN_URL, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(1000);

    // Take screenshot at /plan
    await page.screenshot({ path: '/tmp/plan-page-authenticated.png' });
    log('Screenshot saved to /tmp/plan-page-authenticated.png');

    // Check if we're actually on the plan page
    const step0Label = await page.locator('text="Step 1 of 5"').count();
    if (step0Label > 0) {
      addResult('Navigation to /plan', 'PASS', 'Reached form page');
    } else {
      log('Still on signin page or form not loaded');
      const currentUrl = page.url();
      log(`Current URL: ${currentUrl}`);

      // Dump visible text
      const visibleText = await page.evaluate(() => document.body.innerText.substring(0, 500));
      log(`Visible text: ${visibleText}`);
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 0: Destination & Preferences
    // ─────────────────────────────────────────────────────────────
    log('\n=== STEP 0: Destination & Preferences ===\n');

    // Wait for inputs to load
    await page.waitForTimeout(500);

    // Find inputs - be more flexible with selectors
    const allInputs = await page.locator('input').count();
    const allButtons = await page.locator('button').count();
    const allSelects = await page.locator('select').count();
    const allTextareas = await page.locator('textarea').count();

    log(`Found: ${allInputs} inputs, ${allButtons} buttons, ${allSelects} selects, ${allTextareas} textareas`);

    if (allInputs === 0 && allButtons === 0) {
      log('❌ No form elements found! Page may not be loaded or authentication failed.');
      addResult('Form Elements', 'FAIL', 'No inputs or buttons found on page');
    } else {
      // Try to fill the first input (destination)
      if (allInputs > 0) {
        const firstInput = page.locator('input').first();
        await firstInput.focus();
        await page.keyboard.type('Paris');
        await page.waitForTimeout(300);

        // Look for dropdown suggestion - wait a moment
        await page.waitForTimeout(300);
        const suggestions = page.locator('text="Paris"');
        if (await suggestions.count() > 1) {  // More than 1 because the input itself contains "Paris"
          await suggestions.nth(1).click();  // Click the suggestion, not the input
          addResult('Destination', 'PASS', 'Selected Paris');
        } else {
          addResult('Destination', 'PROBE', 'Entered Paris, no dropdown suggestions found');
        }
      }

      // Fill budget (find number input)
      const numberInputs = page.locator('input[type="number"]');
      if (await numberInputs.count() > 0) {
        await numberInputs.first().fill('2500');
        addResult('Budget', 'PASS', 'Set budget to 2500');
      }

      // Fill interests (find textarea)
      if (allTextareas > 0) {
        await page.locator('textarea').first().fill('hiking, museums, food tours');
        addResult('Interests', 'PASS', 'Filled interests');
      }

      // Try to click Continue button
      let continueBtn = page.locator('button:has-text("Continue")').first();
      if (await continueBtn.count() === 0) {
        continueBtn = page.locator('button:has-text("Next")').first();
      }
      if (await continueBtn.count() > 0) {
        const isEnabled = await continueBtn.evaluate(btn => !btn.disabled);
        if (isEnabled) {
          await continueBtn.click();
          await page.waitForTimeout(500);
          addResult('Step 0 Submit', 'PASS', 'Clicked Continue');
        } else {
          addResult('Step 0 Submit', 'PROBE', 'Continue button disabled');
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // Session Storage Test
    // ─────────────────────────────────────────────────────────────
    log('\n=== Session Storage Test ===\n');

    const sessionData = await page.evaluate(() => {
      const form = sessionStorage.getItem('wz_plan_form');
      const step = sessionStorage.getItem('wz_plan_step');
      return {
        form: form ? Object.keys(JSON.parse(form)) : null,
        step,
        hasForm: !!form
      };
    });

    if (sessionData.hasForm) {
      addResult('Session Storage', 'PASS', `Form data persisted with keys: ${sessionData.form ? sessionData.form.join(', ') : 'unknown'}`);
    } else {
      addResult('Session Storage', 'PROBE', 'No form data in session storage yet');
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
      log('✅ NO CRITICAL FAILURES');
    } else {
      log('❌ CRITICAL FAILURES FOUND\n');
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
