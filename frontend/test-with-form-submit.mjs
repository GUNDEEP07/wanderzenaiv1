#!/usr/bin/env node
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Listen to console messages
  page.on('console', msg => {
    if (msg.type() !== 'log') console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
  });

  console.log('Step 1: Navigate to /login');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  // Check for demo mode banner
  const demoModeText = await page.locator('text="Demo mode"').count();
  console.log(`Demo mode banner visible: ${demoModeText > 0 ? 'YES ✅' : 'NO ❌'}`);

  // Get the form
  const form = page.locator('form').first();
  if (await form.count() === 0) {
    console.log('No form found!');
    await browser.close();
    return;
  }

  console.log('\nStep 2: Fill login form');
  const emailInput = form.locator('input[type="email"]');
  const passwordInput = form.locator('input[type="password"]');

  await emailInput.fill('demo@wanderzen.com');
  await passwordInput.fill('demo123');
  console.log('Filled: email and password');

  console.log('\nStep 3: Submit form');
  // Use form submission instead of button click
  await form.evaluate(f => f.submit());
  await page.waitForTimeout(2000);

  console.log(`URL after form submit: ${page.url()}`);

  if (page.url().includes('/plan') || page.url().includes('/dashboard')) {
    console.log('✅ Login successful, user authenticated');
  } else {
    console.log('❌ Still at login page');
    const errorText = await page.locator('[style*="color.*ff6b6b"]').textContent();
    if (errorText) console.log(`Error message: ${errorText}`);
  }

  console.log('\nStep 4: Navigate to /plan');
  await page.goto(`${BASE_URL}/plan`);
  await page.waitForTimeout(2000);

  const isFormPage = await page.locator('text="Step 1 of 5"').count() > 0;
  console.log(`At /plan with form visible: ${isFormPage ? 'YES ✅' : 'NO ❌'}`);

  if (isFormPage) {
    await page.screenshot({ path: '/tmp/form-loaded.png' });
    console.log('Screenshot saved: /tmp/form-loaded.png');

    // Count form elements
    const inputs = await page.locator('input').count();
    const textareas = await page.locator('textarea').count();
    const selects = await page.locator('select').count();
    const buttons = await page.locator('button').count();

    console.log(`\nForm elements:`);
    console.log(`  Inputs: ${inputs}`);
    console.log(`  Textareas: ${textareas}`);
    console.log(`  Selects: ${selects}`);
    console.log(`  Buttons: ${buttons}`);

    if (inputs >= 3 && textareas >= 1) {
      console.log('\n✅ Form appears complete, ready for testing');
    }
  }

  await browser.close();
}

test().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
