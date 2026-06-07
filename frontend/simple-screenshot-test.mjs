#!/usr/bin/env node
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173';

async function testForm() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Test 1: Check /plan without auth (should redirect to login)');
  await page.goto(`${BASE_URL}/plan`);
  await page.waitForTimeout(1000);
  console.log(`URL after /plan nav: ${page.url()}`);
  await page.screenshot({ path: '/tmp/1-plan-no-auth.png' });

  console.log('\nTest 2: Navigate to /login');
  await page.goto(`${BASE_URL}/login`);
  await page.waitForTimeout(800);
  console.log(`Login page loaded`);
  await page.screenshot({ path: '/tmp/2-login-page.png' });

  // Check form elements
  const emailInputs = await page.locator('input[type="email"]').count();
  const passwordInputs = await page.locator('input[type="password"]').count();
  const buttons = await page.locator('button').count();
  console.log(`Found: ${emailInputs} email inputs, ${passwordInputs} password inputs, ${buttons} buttons`);

  console.log('\nTest 3: Try demo/any login');
  if (emailInputs > 0) {
    await page.locator('input[type="email"]').first().fill('demo@example.com');
  }
  if (passwordInputs > 0) {
    await page.locator('input[type="password"]').first().fill('demo123');
  }

  const signInBtns = await page.locator('button').all();
  for (const btn of signInBtns) {
    const text = await btn.textContent();
    if (text.includes('Sign') || text.includes('Login')) {
      console.log(`Found sign-in button: "${text}"`);
      await btn.click();
      break;
    }
  }

  await page.waitForTimeout(3000);
  console.log(`URL after sign-in click: ${page.url()}`);
  await page.screenshot({ path: '/tmp/3-after-signin.png' });

  console.log('\nTest 4: Navigate directly to /plan');
  await page.goto(`${BASE_URL}/plan`);
  await page.waitForTimeout(2000);
  console.log(`URL: ${page.url()}`);

  const visibleText = await page.evaluate(() => document.body.innerText.substring(0, 300));
  console.log(`Visible text: ${visibleText.substring(0, 100)}...`);

  await page.screenshot({ path: '/tmp/4-plan-after-signin.png' });

  // Try to find form elements
  const allInputs = await page.locator('input').count();
  const allTextareas = await page.locator('textarea').count();
  const allSelects = await page.locator('select').count();
  const allButtons = await page.locator('button').count();

  console.log(`\nForm elements found:`);
  console.log(`  Inputs: ${allInputs}`);
  console.log(`  Textareas: ${allTextareas}`);
  console.log(`  Selects: ${allSelects}`);
  console.log(`  Buttons: ${allButtons}`);

  // Look for step indicator
  const stepLabels = await page.locator('text="Step"').count();
  console.log(`  Step labels: ${stepLabels}`);

  // If form is loaded, dump the HTML structure
  if (allInputs > 5) {
    console.log('\n✅ Form appears to be loaded');
    const formHTML = await page.locator('[role="main"], .card, main').first().evaluate(el => el?.outerHTML?.substring(0, 500) || 'no form root found');
    console.log(`Form structure: ${formHTML}`);
  } else {
    console.log('\n❌ Form not fully loaded');
  }

  await browser.close();
}

testForm().catch(console.error);
