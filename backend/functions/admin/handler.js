import pkg from 'pg';
const { Pool } = pkg;
import jwt from 'jsonwebtoken';
import https from 'https';

// ── Firebase JWT verification ──────────────────────────────────────────────────
// Firebase signs ID tokens with RS256. We verify the signature against their
// public keys before trusting any claim (incl. email). Never skip verification
// on an admin endpoint — an unsigned/forged token could otherwise bypass auth.
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
let _jwksCache = null;
let _jwksCacheExpiry = 0;

function fetchFirebasePublicKeys() {
  return new Promise((resolve, reject) => {
    https.get(
      'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
      (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(e); }
        });
      }
    ).on('error', reject);
  });
}

async function getFirebasePublicKeys() {
  if (_jwksCache && Date.now() < _jwksCacheExpiry) return _jwksCache;
  _jwksCache = await fetchFirebasePublicKeys();
  _jwksCacheExpiry = Date.now() + 3600 * 1000; // cache 1 hour
  return _jwksCache;
}

const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

async function getAdminEmail(event) {
  const auth = event.headers?.Authorization || event.headers?.authorization || '';
  const token = auth.replace('Bearer ', '');
  if (!token || token === 'demo-token') return null;
  try {
    // Decode header to find the key ID (kid)
    const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());
    // Fetch Firebase's public keys (RS256 certs, cached 1h)
    const keys = await getFirebasePublicKeys();
    const cert = keys[header.kid];
    if (!cert) return null; // unknown key ID — reject
    // Verify signature + expiry + issuer. Throws if invalid.
    const payload = jwt.verify(token, cert, {
      algorithms: ['RS256'],
      issuer: FIREBASE_PROJECT_ID ? `https://securetoken.google.com/${FIREBASE_PROJECT_ID}` : undefined,
      audience: FIREBASE_PROJECT_ID || undefined,
    });
    return payload.email || null;
  } catch { return null; }
}

async function getEmailRoles(email) {
  if (!email) return [];
  try {
    const result = await pool.query(
      `SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id JOIN users u ON u.id = ur.user_id WHERE u.email = $1`,
      [email]
    );
    return result.rows.map(x => x.name);
  } catch { return []; }
}

async function requireAdmin(email) {
  const roles = await getEmailRoles(email);
  return roles.some(r => ['admin','superadmin','support'].includes(r));
}

async function requireSuperAdmin(email) {
  const roles = await getEmailRoles(email);
  return roles.includes('superadmin');
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS' }, body: '' };
  }

  const email = await getAdminEmail(event);
  const rawPath = event.path || '';
  const path = rawPath.replace(/^\/admin/, '');
  const method = event.httpMethod;

  const isAdmin = await requireAdmin(email);
  if (!isAdmin) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Admin access required' }) };
  }

  // Support role: only certain paths
  const emailRoles = await getEmailRoles(email);
  const isSupport = emailRoles.includes('support') && !emailRoles.includes('admin') && !emailRoles.includes('superadmin');
  const supportPaths = ['/submissions', '/users', '/feedback'];
  if (isSupport && !supportPaths.some(p => path.startsWith(p))) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Forbidden for support role' }) };
  }

  try {
    if (path === '/stats' && method === 'GET') {
      const [total, monthly, active, completion, cost, avgRating] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM submissions`),
        pool.query(`SELECT COUNT(*) FROM submissions WHERE created_at >= date_trunc('month', NOW())`),
        pool.query(`SELECT COUNT(DISTINCT email) FROM submissions WHERE created_at > NOW() - INTERVAL '30 days'`),
        pool.query(`SELECT ROUND(100.0 * SUM(CASE WHEN status='email_sent' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1) as rate FROM submissions`),
        pool.query(`SELECT ROUND(COALESCE(SUM(claude_input_tokens)*3.0/1000000 + SUM(claude_output_tokens)*15.0/1000000, 0), 2) as cost FROM itineraries WHERE created_at >= date_trunc('month', NOW())`),
        pool.query(`SELECT ROUND(AVG(rating),1) as avg FROM feedback`),
      ]);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({
        totalItineraries: +total.rows[0].count,
        monthlyItineraries: +monthly.rows[0].count,
        activeUsers30d: +active.rows[0].count,
        completionRate: +completion.rows[0].rate || 0,
        monthlyClaudeCostUSD: +cost.rows[0].cost || 0,
        avgRating: +avgRating.rows[0].avg || 0,
      })};
    }

    if (path === '/charts/daily' && method === 'GET') {
      const result = await pool.query(
        `SELECT date::text, total_submissions, completed, failed FROM daily_stats WHERE date >= NOW() - INTERVAL '30 days' ORDER BY date`
      );
      return { statusCode: 200, headers: CORS, body: JSON.stringify(result.rows) };
    }

    if (path === '/charts/destinations' && method === 'GET') {
      const result = await pool.query(
        `SELECT destination, COUNT(*) as count FROM submissions GROUP BY destination ORDER BY count DESC LIMIT 20`
      );
      return { statusCode: 200, headers: CORS, body: JSON.stringify(result.rows) };
    }

    if (path === '/charts/locations' && method === 'GET') {
      const result = await pool.query(
        `SELECT user_location, COUNT(*) as count FROM submissions WHERE user_location IS NOT NULL AND user_location != '' GROUP BY user_location ORDER BY count DESC LIMIT 20`
      );
      return { statusCode: 200, headers: CORS, body: JSON.stringify(result.rows) };
    }

    if (path === '/charts/interests' && method === 'GET') {
      const result = await pool.query(
        `SELECT interest, COUNT(*) as count FROM submissions, jsonb_array_elements_text(travel_style) AS interest GROUP BY interest ORDER BY count DESC LIMIT 10`
      );
      return { statusCode: 200, headers: CORS, body: JSON.stringify(result.rows) };
    }

    if (path === '/charts/tokens' && method === 'GET') {
      const result = await pool.query(
        `SELECT DATE_TRUNC('month', created_at)::text as month, SUM(claude_input_tokens)::int as input_tokens, SUM(claude_output_tokens)::int as output_tokens, ROUND(SUM(claude_input_tokens)*3.0/1000000, 4) as input_cost_usd, ROUND(SUM(claude_output_tokens)*15.0/1000000, 4) as output_cost_usd, COUNT(*)::int as itineraries FROM itineraries WHERE created_at >= NOW() - INTERVAL '12 months' GROUP BY DATE_TRUNC('month', created_at) ORDER BY month`
      );
      return { statusCode: 200, headers: CORS, body: JSON.stringify(result.rows) };
    }

    if (path === '/charts/chat' && method === 'GET') {
      const [daily, totals] = await Promise.all([
        pool.query(`SELECT DATE(created_at)::text as date, COUNT(*)::int as sessions, AVG(messages_count)::int as avg_messages FROM chat_sessions WHERE created_at >= NOW() - INTERVAL '30 days' GROUP BY DATE(created_at) ORDER BY date`),
        pool.query(`SELECT COUNT(*)::int as total, SUM(CASE WHEN led_to_plan THEN 1 ELSE 0 END)::int as converted FROM chat_sessions`),
      ]);
      const { total, converted } = totals.rows[0];
      return { statusCode: 200, headers: CORS, body: JSON.stringify({
        daily: daily.rows, totalSessions: total, converted,
        conversionRate: total > 0 ? Math.round(100 * converted / total) : 0,
      })};
    }

    if (path === '/charts/funnel' && method === 'GET') {
      const [registered, submitted, delivered] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int as count FROM users`),
        pool.query(`SELECT COUNT(DISTINCT email)::int as count FROM submissions`),
        pool.query(`SELECT COUNT(*)::int as count FROM submissions WHERE status = 'email_sent'`),
      ]);
      return { statusCode: 200, headers: CORS, body: JSON.stringify([
        { stage: 'Registered', count: registered.rows[0].count },
        { stage: 'Submitted', count: submitted.rows[0].count },
        { stage: 'Delivered', count: delivered.rows[0].count },
      ])};
    }

    if (path === '/submissions' && method === 'GET') {
      const limit = Math.min(+(event.queryStringParameters?.limit || 50), 200);
      const status = event.queryStringParameters?.status;
      const query = status && status !== 'all'
        ? `SELECT id, email, destination, days, budget, currency, status, plan, created_at, language, user_location FROM submissions WHERE status = $2 ORDER BY created_at DESC LIMIT $1`
        : `SELECT id, email, destination, days, budget, currency, status, plan, created_at, language, user_location FROM submissions ORDER BY created_at DESC LIMIT $1`;
      const params = status && status !== 'all' ? [limit, status] : [limit];
      const result = await pool.query(query, params);
      return { statusCode: 200, headers: CORS, body: JSON.stringify(result.rows) };
    }

    if (path === '/users' && method === 'GET') {
      const result = await pool.query(
        `SELECT u.id, u.email, u.name, u.plan, u.home_city, u.created_at, COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), '{}') as roles, (SELECT COUNT(*)::int FROM submissions s WHERE s.email = u.email) as itinerary_count FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id LEFT JOIN roles r ON r.id = ur.role_id GROUP BY u.id ORDER BY u.created_at DESC LIMIT 200`
      );
      return { statusCode: 200, headers: CORS, body: JSON.stringify(result.rows) };
    }

    if (path === '/feedback' && method === 'GET') {
      const [distribution, recent] = await Promise.all([
        pool.query(`SELECT rating, COUNT(*)::int as count FROM feedback GROUP BY rating ORDER BY rating DESC`),
        pool.query(`SELECT rating, comment, destination, source, created_at, email FROM feedback ORDER BY created_at DESC LIMIT 50`),
      ]);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ distribution: distribution.rows, recent: recent.rows })};
    }

    if (path.match(/^\/users\/[^/]+\/roles$/) && method === 'POST') {
      if (!(await requireSuperAdmin(email))) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Superadmin only' }) };
      const userId = path.split('/')[2];
      const { roleName } = JSON.parse(event.body || '{}');
      await pool.query(
        `INSERT INTO user_roles (user_id, role_id, assigned_by) SELECT $1, r.id, (SELECT id FROM users WHERE email = $3) FROM roles r WHERE r.name = $2 ON CONFLICT DO NOTHING`,
        [userId, roleName, email]
      );
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
    }

    if (path.match(/^\/users\/[^/]+\/roles\/\d+$/) && method === 'DELETE') {
      if (!(await requireSuperAdmin(email))) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Superadmin only' }) };
      const parts = path.split('/');
      await pool.query(`DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2`, [parts[2], parts[4]]);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Not found' }) };
  } catch (err) {
    console.error('Admin handler error:', err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Internal error' }) };
  }
}
