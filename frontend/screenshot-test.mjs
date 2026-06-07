#!/usr/bin/env node
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto('http://localhost:5173/plan', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

// Take screenshot
await page.screenshot({ path: '/tmp/plan-page-screenshot.png' });

// Dump HTML
const html = await page.content();
console.log('===== PAGE HTML (first 3000 chars) =====');
console.log(html.substring(0, 3000));
console.log('\n===== CHECKING FOR ELEMENTS =====');

// Check what's on the page
const title = await page.locator('h2').first().textContent();
console.log('First h2:', title);

const buttons = await page.locator('button').count();
console.log('Button count:', buttons);

const inputs = await page.locator('input').count();
console.log('Input count:', inputs);

const textareas = await page.locator('textarea').count();
console.log('Textarea count:', textareas);

const selects = await page.locator('select').count();
console.log('Select count:', selects);

// Check if step label is visible
const step0 = await page.locator('text=Step 1 of 5').count();
console.log('Step 1 of 5 visible:', step0 > 0);

// Get all text nodes
const allText = await page.evaluate(() => {
  return document.body.innerText.substring(0, 1000);
});
console.log('\n===== PAGE TEXT (first 1000 chars) =====');
console.log(allText);

await browser.close();
