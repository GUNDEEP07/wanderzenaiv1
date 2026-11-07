'use strict';

// Run: node --test backend/tests/unit/*.test.js
// Blog privacy (Nov 7 2026): readers never get author/commenter emails or admin notes.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const pv = require(path.join(__dirname, '../../functions/blog-handler/utils/publicView.js'));

const post = { id: 'p1', user_id: 'u-author', title: 'Tea houses', author_email: 'gundeep07@gmail.com', author_name: 'Gundeep Singh', admin_notes: 'internal' };

test('readers: display name only, no email, no admin notes', () => {
  const v = pv.viewPost(post);
  assert.equal(v.author_name, 'Gundeep');
  assert.equal(v.is_mine, false);
  assert.ok(!('author_email' in v));
  assert.ok(!('admin_notes' in v));
  assert.doesNotMatch(JSON.stringify(v), /@/);
});

test('the author sees admin notes and is_mine; admins also see the email', () => {
  const own = pv.viewPost(post, { userId: 'u-author', userRole: 'user' });
  assert.equal(own.admin_notes, 'internal');
  assert.equal(own.is_mine, true);
  assert.ok(!('author_email' in own));
  const admin = pv.viewPost(post, { userId: 'u-admin', userRole: 'admin' });
  assert.equal(admin.author_email, 'gundeep07@gmail.com');
  assert.equal(admin.admin_notes, 'internal');
});

test('comments: name or fallback, never the email (even the author of the comment gets no email back)', () => {
  const c = { id: 'c1', user_id: 'u-r', user_email: 'reader@example.com', author_name: null, content: 'hi' };
  assert.equal(pv.viewComment(c).author_name, pv.FALLBACK_NAME);
  assert.doesNotMatch(JSON.stringify(pv.viewComment(c, { userId: 'u-r' })), /@/);
  assert.equal(pv.viewComment(c, { userId: 'u-r' }).is_mine, true);
  assert.equal(pv.viewComment(c, { userRole: 'superadmin' }).user_email, 'reader@example.com');
});

test('displayName never derives anything from an email', () => {
  assert.equal(pv.displayName('  '), pv.FALLBACK_NAME);
  assert.equal(pv.displayName(undefined), pv.FALLBACK_NAME);
  assert.equal(pv.displayName('Ana María López'), 'Ana');
});
