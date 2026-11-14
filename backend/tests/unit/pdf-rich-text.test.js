'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { richText, plainText } = require(path.resolve(__dirname, '../../functions/pdf-builder/rich-text.js'));

const MARBLE = '[View on map](https://maps.google.com/?q=Marble%20Mountain%20(Ng%C5%A9%20H%C3%A0nh%20S%C6%A1n)%2C%20VN)';

test('map links with parentheses in the URL are read whole (Vietnam PDF, Nov 2026)', () => {
  const html = richText(`Climb Marble Mountain ${MARBLE} before 8am.`);
  assert.match(html, /href="https:\/\/maps\.google\.com\/\?q=Marble%20Mountain%20\(Ng%C5%A9%20H%C3%A0nh%20S%C6%A1n\)%2C%20VN" class="map-pin">map<\/a> before 8am\.$/);
  assert.doesNotMatch(html.replace(/href="[^"]*"/g, ''), /%[0-9A-F]{2}/);
});

test('summary text drops links and generic labels, tidies spacing', () => {
  assert.strictEqual(plainText(`My Khe Beach ${MARBLE}, where locals swim.`), 'My Khe Beach, where locals swim.');
  assert.strictEqual(plainText('[Faifo Coffee](https://maps.google.com/?q=Faifo) opens at 7'), 'Faifo Coffee opens at 7');
  assert.strictEqual(plainText('See https://example.com/x for times.'), 'See for times.');
});

test('HTML is escaped and non-http links are never anchors', () => {
  const html = richText('<img src=x onerror=alert(1)> [x](javascript:alert(1)) [y](https://e.com/"><b>)');
  assert.doesNotMatch(html, /<img|<b>|href="javascript/i);
});

test('truncated link at the end of the text does not leak the URL', () => {
  assert.strictEqual(plainText('Walk the old town [View on map](https://maps.google.com/?q=Hoi%20An%20(Old'), 'Walk the old town');
});

test('budget table: amounts from strings, free activities skipped, gap to the trip estimate noted', () => {
  process.env.PDF_BUCKET = process.env.PDF_BUCKET || 'test';
  let internal;
  try { internal = require(path.resolve(__dirname, '../../functions/pdf-builder/index.js'))._internal; } catch (e) { if (/Cannot find module/.test(e.message)) return; throw e; }
  const { budgetTable, toAmount } = internal;
  assert.strictEqual(toAmount('A$15–20'), 15);
  assert.strictEqual(toAmount('1,200'), 1200);
  assert.strictEqual(toAmount(null), 0);
  const day = (n, cost) => ({ dayNumber: n, base: 'Hoi An', dailyCost: cost, morningActivity: { cost: '20' }, afternoonActivity: { cost: 50, isFree: true }, localEats: { cost: 10 } });
  const html = budgetTable({ totalEstimatedCost: 500, days: [day(1, 100), day(2, '25')] }, 'A$');
  assert.match(html, /Day 1.*A\$20<\/td><td>A\$10<\/td><td>A\$70<\/td><td>A\$100/s);
  assert.match(html, /Day 2.*A\$20<\/td><td>A\$10<\/td><td>—<\/td><td>A\$30/s, 'a day total below its parts is raised to the parts');
  assert.match(html, /about A\$370 not in the daily totals/);
  assert.strictEqual(budgetTable({ days: [] }, 'A$'), '');
});
