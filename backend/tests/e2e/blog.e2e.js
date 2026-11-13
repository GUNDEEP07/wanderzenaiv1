'use strict';
// Blog privacy + comments, end to end on local Postgres with the real blog handler.
const crypto = require('crypto');
Object.assign(process.env, { DB_HOST: process.env.E2E_DB_HOST || '127.0.0.1', DB_NAME: process.env.E2E_DB_NAME || 'wz', DB_USER: process.env.E2E_DB_USER || 'postgres', DB_PASSWORD: process.env.E2E_DB_PASSWORD || '', FIREBASE_PROJECT_ID: 'wanderzenai-9c343', STAGE: 'test', FRONTEND_URL: 'https://www.wanderzenai.com' });
const REPO = require('path').resolve(__dirname, '../../..');
const { getDB } = require('/opt/nodejs/index');
const auth = require('/opt/nodejs/auth.js');
const blog = require(`${REPO}/backend/functions/blog-handler/index.js`);
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
auth.__setCertsForTesting({ k: publicKey.export({ type: 'spki', format: 'pem' }) });
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = (sub, email) => { const t = Math.floor(Date.now()/1000); const h=b64({alg:'RS256',kid:'k'}), p=b64({iss:'https://securetoken.google.com/wanderzenai-9c343',aud:'wanderzenai-9c343',sub,iat:t-5,exp:t+3600,email,email_verified:true}); return `${h}.${p}.${crypto.sign('RSA-SHA256',Buffer.from(`${h}.${p}`),privateKey).toString('base64url')}`; };
const out = []; const check = (n, c, d = '') => out.push(`${c ? 'PASS' : 'FAIL'}  ${n}${d && !c ? '  — ' + d : ''}`);
const call = async (method, path, tok, body, pathParameters = {}) => {
  const res = await blog.handler({ httpMethod: method, path, pathParameters, headers: tok ? { Authorization: `Bearer ${tok}` } : {}, body: body ? JSON.stringify(body) : null, queryStringParameters: null });
  let json = null; try { json = JSON.parse(res.body); } catch { /* empty */ }
  return { status: res.statusCode, json, raw: res.body || '' };
};
const quiet = () => { console._l = console.log; console.log = () => {}; }; const loud = () => { if (console._l) console.log = console._l; };

(async () => {
  const db = getDB();
  const n = Date.now();
  const authorEmail = `author${n}@example.com`, readerEmail = `reader${n}@example.com`, adminEmail = `admin${n}@example.com`;
  const author = (await db.query(`insert into users (email, firebase_uid, name) values ($1,$2,'Gundeep Singh') returning id`, [authorEmail, 'uA' + n])).rows[0].id;
  await db.query(`insert into users (email, firebase_uid) values ($1,$2)`, [readerEmail, 'uR' + n]); // no name
  const admin = (await db.query(`insert into users (email, firebase_uid, name) values ($1,$2,'Ops') returning id`, [adminEmail, 'uX' + n])).rows[0].id;
  await db.query(`insert into user_roles (user_id, role_id) select $1, id from roles where name='admin'`, [admin]);
  const post = (await db.query(`insert into blog_posts (user_id,title,description,content,location,country,category,status,admin_notes,published_at)
    values ($1,'Tea houses','Quiet mornings','Long text','Kyoto','Japan','culture','published','internal: checked photos',now()) returning id`, [author])).rows[0].id;
  const draft = (await db.query(`insert into blog_posts (user_id,title,description,content,location,country,category,status,admin_notes)
    values ($1,'Draft','d','c','Hue','Vietnam','culture','rejected','Please add photos') returning id`, [author])).rows[0].id;
  await db.query(`insert into blog_comments (post_id,user_id,user_email,content) values ($1,$2,$3,'hidden on draft')`, [draft, author, authorEmail]).catch(() => {});

  quiet();
  // 1. Public list + post: no emails, no admin notes, a display name
  let r = await call('GET', '/blog');
  const listed = r.json?.data?.find(p => p.id === post);
  check('GET /blog → no author emails or admin notes anywhere', r.status === 200 && listed && !r.raw.includes('@example.com') && !r.raw.includes('internal:') && listed.author_name === 'Gundeep', r.raw.slice(0, 200));
  r = await call('GET', `/blog/${post}`, null, null, { id: post });
  check('GET /blog/{id} (anonymous) → author_name only', r.status === 200 && r.json.data.author_name === 'Gundeep' && !('author_email' in r.json.data) && !('admin_notes' in r.json.data), r.raw.slice(0, 200));
  r = await call('GET', `/blog/${draft}`, token('uA' + n, authorEmail), null, { id: draft });
  check('the author sees why their post was rejected (admin_notes), still no email', r.status === 200 && r.json.data.admin_notes === 'Please add photos' && !('author_email' in r.json.data));
  r = await call('GET', `/blog/${post}`, token('uX' + n, adminEmail), null, { id: post });
  check('an admin sees the author email and notes (moderation)', r.status === 200 && r.json.data.author_email === authorEmail && r.json.data.admin_notes === 'internal: checked photos');

  // 2a. Comments closed by default (Nov 8: "3C")
  r = await call('POST', `/blog/${post}/comments`, token('uR' + n, readerEmail), { content: 'Lovely, which tea house first?' }, { id: post });
  check('comments closed: POST → 403 COMMENTS_CLOSED', r.status === 403 && r.json?.code === 'COMMENTS_CLOSED', `${r.status} ${r.raw.slice(0, 120)}`);
  process.env.BLOG_COMMENTS_OPEN = 'true'; // the rest of this section tests them reopened
  // 2. Comments: list route exists, names not emails
  r = await call('GET', `/blog/${post}/comments`, null, null, { id: post });
  check('GET /blog/{id}/comments → 200 [] before any comment (was 403: no route)', r.status === 200 && Array.isArray(r.json.data) && r.json.data.length === 0, `${r.status} ${r.raw.slice(0, 120)}`);
  r = await call('POST', `/blog/${post}/comments`, token('uR' + n, readerEmail), { content: 'Lovely, which tea house first?' }, { id: post });
  check('POST comment → 201 without the commenter email', r.status === 201 && !r.raw.includes('@example.com') && r.json.data.author_name === 'A WanderZen traveller', r.raw.slice(0, 200));
  await call('POST', `/blog/${post}/comments`, token('uA' + n, authorEmail), { content: 'Start with the one behind Nanzenji' }, { id: post });
  r = await call('GET', `/blog/${post}/comments`, null, null, { id: post });
  check('comments listed newest first with display names, no emails', r.status === 200 && r.json.data.length === 2 && r.json.data[0].author_name === 'Gundeep' && r.json.data[1].author_name === 'A WanderZen traveller' && !r.raw.includes('@example.com'), r.raw.slice(0, 300));
  r = await call('GET', `/blog/${draft}/comments`, null, null, { id: draft });
  check('comments on an unpublished post are not listed', r.status === 200 && r.json.data.length === 0);
  r = await call('GET', '/blog/not-a-uuid/comments', null, null, { id: 'not-a-uuid' });
  check('malformed post id → 404 (not a 500)', r.status === 404, `${r.status}`);
  delete process.env.BLOG_COMMENTS_OPEN;

  // 3. Team-only publishing (Nov 8: "2B")
  const story = { title: 'Slow mornings in Hoi An', description: 'Bikes, rice fields and a homestay breakfast.', content: 'x'.repeat(80), location: 'Hoi An', country: 'Vietnam', category: 'culture' };
  r = await call('POST', '/blog', token('uR' + n, readerEmail), story);
  check('a regular user cannot publish (403)', r.status === 403, `${r.status}`);
  r = await call('POST', '/blog', token('uX' + n, adminEmail), story);
  const newId = r.json?.data?.id;
  check('an admin publishes straight away (201, status published)', r.status === 201 && r.json.data.status === 'published' && r.json.data.published_at, `${r.status} ${r.raw.slice(0, 160)}`);
  r = await call('GET', '/blog');
  check('the new story is in the public list', r.json.data.some(p => p.id === newId));
  r = await call('PUT', `/blog/${newId}`, token('uX' + n, adminEmail), { ...story, title: 'Slow mornings in Hoi An (updated)' }, { id: newId });
  check('an admin can edit a published story', r.status === 200 && r.json.data.title.endsWith('(updated)'), `${r.status} ${r.raw.slice(0, 160)}`);
  r = await call('PUT', `/blog/${newId}`, token('uR' + n, readerEmail), story, { id: newId });
  check('a regular user cannot edit it (403)', r.status === 403, `${r.status}`);
  // 4. Photos (Nov 8): team uploads, first photo is the cover, objects removed with the post
  const s3mod = require(`${REPO}/backend/functions/blog-handler/utils/s3.js`);
  const objects = new Map();
  s3mod.__setForTesting({
    s3Client: { send: async (cmd) => { const i = cmd.input; if (cmd.constructor.name === 'PutObjectCommand') objects.set(i.Key, i.ContentType); if (cmd.constructor.name === 'DeleteObjectCommand') objects.delete(i.Key); return {}; } },
    sign: async (_c, cmd) => `https://signed.test/${cmd.input.Key}?X-Amz-Expires=21600`,
  });
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(3000, 9)]).toString('base64');
  r = await call('POST', `/blog/${newId}/photos`, token('uX' + n, adminEmail), { image: `data:image/jpeg;base64,${jpeg}`, caption: 'Rice fields' }, { id: newId });
  const p1 = r.json?.data;
  check('admin uploads a photo → 201 with a signed URL and caption', r.status === 201 && p1?.url?.startsWith('https://signed.test/blog/') && p1.caption === 'Rice fields' && objects.size === 1, `${r.status} ${r.raw.slice(0, 200)}`);
  r = await call('POST', `/blog/${newId}/photos`, token('uX' + n, adminEmail), { image: jpeg }, { id: newId });
  const p2 = r.json?.data;
  r = await call('POST', `/blog/${newId}/photos`, token('uR' + n, readerEmail), { image: jpeg }, { id: newId });
  check('a regular user cannot add photos (403)', r.status === 403, `${r.status}`);
  r = await call('GET', `/blog/${newId}`, null, null, { id: newId });
  check('the post carries its photos in order; the first is the cover', r.status === 200 && r.json.data.photos.length === 2 && r.json.data.photos[0].id === p1.id && r.json.data.thumbnail_url === p1.url && !r.raw.includes('s3_key'), r.raw.slice(0, 300));
  r = await call('GET', '/blog');
  check('the blog list shows the cover', r.json.data.find(p => p.id === newId)?.thumbnail_url === p1.url && r.json.data.find(p => p.id === post)?.thumbnail_url === null);
  r = await call('PUT', `/blog/${newId}/photos/${p2.id}`, token('uX' + n, adminEmail), { caption: 'Lantern street' }, { id: newId, photoId: p2.id });
  check('caption edit', r.status === 200 && r.json.data.caption === 'Lantern street', `${r.status} ${r.raw.slice(0, 120)}`);
  r = await call('DELETE', `/blog/${newId}/photos/${p1.id}`, token('uX' + n, adminEmail), null, { id: newId, photoId: p1.id });
  r = await call('GET', `/blog/${newId}`, null, null, { id: newId });
  check('deleting the cover makes the next photo the cover', r.json.data.photos.length === 1 && r.json.data.thumbnail_url === r.json.data.photos[0].url && objects.size === 1);

  r = await call('DELETE', `/blog/${newId}`, token('uX' + n, adminEmail), null, { id: newId });
  check('an admin can delete it', r.status === 204 || r.status === 200, `${r.status}`);
  check('deleting the post removes its photo objects', objects.size === 0, [...objects.keys()].join(','));
  loud();

  console.log(out.join('\n')); console.log(`\n${out.filter(x => x.startsWith('PASS')).length}/${out.length} passed`);
  await db.end(); process.exit(out.some(x => x.startsWith('FAIL')) ? 1 : 0);
})().catch(e => { loud(); console.error('ERR', e); process.exit(1); });
