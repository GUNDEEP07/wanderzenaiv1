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
