import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API = import.meta.env.VITE_API_URL;

const TABS = [
  { id: 'overview',  label: '◈ Overview' },
  { id: 'activity',  label: '◎ Activity' },
  { id: 'interests', label: '△ Interests' },
  { id: 'tokens',    label: '◆ Tokens' },
  { id: 'chat',      label: '◑ Chat' },
  { id: 'funnel',    label: '▦ Funnel' },
  { id: 'feedback',  label: '✦ Feedback' },
  { id: 'users',     label: '⊘ Users' },
  { id: 'roles',     label: '⊛ Roles', superadminOnly: true },
];

async function adminFetch(path, token) {
  const res = await fetch(`${API}/admin${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export default function AdminDashboard() {
  const { currentUser, getIdToken, hasRole, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [tabData, setTabData] = useState({});
  const [loading, setLoading] = useState(true);
  const isSuperAdmin = hasRole('superadmin');

  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      try {
        const token = await getIdToken();
        const s = await adminFetch('/stats', token);
        setStats(s);
      } catch { /* graceful */ }
      setLoading(false);
    })();
  }, [currentUser]);

  const loadTab = async (tabId) => {
    if (tabData[tabId]) return;
    const token = await getIdToken();
    const pathMap = {
      activity:  ['/charts/daily', '/charts/destinations', '/submissions'],
      interests: ['/charts/interests'],
      tokens:    ['/charts/tokens'],
      chat:      ['/charts/chat'],
      funnel:    ['/charts/funnel'],
      feedback:  ['/feedback'],
      users:     ['/users'],
      roles:     ['/users'],
    };
    if (!pathMap[tabId]) return;
    try {
      const results = await Promise.all(pathMap[tabId].map(p => adminFetch(p, token)));
      setTabData(prev => ({ ...prev, [tabId]: results }));
    } catch { /* graceful */ }
  };

  const handleTab = (t) => { setTab(t); loadTab(t); };

  const s = {
    page: { minHeight: '100vh', background: '#06090f', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#fff' },
    nav: { padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(6,9,15,0.95)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10 },
    logoMark: { width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg,#00d4aa,#00916a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#06090f' },
    badge: { padding: '3px 10px', borderRadius: 20, background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.25)', fontSize: 10, fontWeight: 800, color: '#ff6b6b', textTransform: 'uppercase', letterSpacing: '0.08em' },
    sidebar: { width: 196, flexShrink: 0, padding: '16px 0', borderRight: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)' },
    tabBtn: (a) => ({ display: 'block', width: '100%', padding: '10px 20px', background: a ? 'rgba(0,212,170,0.08)' : 'none', border: 'none', borderLeft: `2px solid ${a ? '#00d4aa' : 'transparent'}`, color: a ? '#00d4aa' : 'rgba(255,255,255,0.45)', fontFamily: 'inherit', fontSize: 12, fontWeight: a ? 700 : 500, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }),
    content: { flex: 1, padding: '28px 32px', overflowY: 'auto' },
    kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 12, marginBottom: 28 },
    kpi: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '15px 16px' },
    kpiNum: { fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 700, color: '#00d4aa', lineHeight: 1, marginBottom: 4 },
    kpiLabel: { fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' },
    secTitle: { fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 16 },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
    th: { textAlign: 'left', padding: '7px 12px', fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', borderBottom: '1px solid rgba(255,255,255,0.07)' },
    td: { padding: '9px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.75)', verticalAlign: 'middle' },
    statusBadge: (st) => ({ padding: '2px 8px', borderRadius: 20, fontSize: 9, fontWeight: 800, textTransform: 'uppercase', background: st === 'email_sent' ? 'rgba(0,212,170,0.12)' : st === 'pending' ? 'rgba(255,217,61,0.1)' : 'rgba(255,255,255,0.06)', color: st === 'email_sent' ? '#00d4aa' : st === 'pending' ? '#ffd93d' : 'rgba(255,255,255,0.4)' }),
    barRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
    barLabel: { width: 150, fontSize: 12, color: '#fff', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    barBg: { flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' },
    barFill: (pct, color) => ({ width: `${pct}%`, height: '100%', background: color || '#00d4aa', borderRadius: 3 }),
    barCount: { width: 32, fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'right', flexShrink: 0 },
    empty: { color: 'rgba(255,255,255,0.25)', fontSize: 12, fontStyle: 'italic', padding: '16px 0' },
  };

  const Loader = () => <div style={s.empty}>Loading…</div>;

  return (
    <div style={s.page}>
      <nav style={s.nav}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={s.logoMark}>W</div>
          <span style={{ fontSize: 14, fontWeight: 700 }}>WanderZenAI</span>
          <span style={s.badge}>Admin</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{currentUser?.email}</span>
          <button type="button" onClick={() => { signOut(); navigate('/login'); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>Sign out</button>
        </div>
      </nav>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 57px)' }}>
        <div style={s.sidebar}>
          {TABS.filter(t => !t.superadminOnly || isSuperAdmin).map(t => (
            <button key={t.id} type="button" style={s.tabBtn(tab === t.id)} onClick={() => handleTab(t.id)}>{t.label}</button>
          ))}
        </div>

        <div style={s.content}>
          {loading && <Loader />}

          {/* ── Overview ── */}
          {!loading && tab === 'overview' && (
            <div>
              <div style={s.secTitle}>Overview</div>
              <div style={s.kpiGrid}>
                {stats && [
                  { label: 'Total itineraries', value: stats.totalItineraries?.toLocaleString() },
                  { label: 'This month', value: stats.monthlyItineraries?.toLocaleString() },
                  { label: 'Active users (30d)', value: stats.activeUsers30d?.toLocaleString() },
                  { label: 'Completion rate', value: `${stats.completionRate}%` },
                  { label: 'Monthly AI cost', value: `$${stats.monthlyClaudeCostUSD}` },
                  { label: 'Avg rating', value: stats.avgRating ? `${stats.avgRating} ★` : '—' },
                ].map(({ label, value }) => (
                  <div key={label} style={s.kpi}>
                    <div style={s.kpiNum}>{value ?? '—'}</div>
                    <div style={s.kpiLabel}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Activity ── */}
          {tab === 'activity' && (
            <div>
              <div style={s.secTitle}>Activity</div>
              {!tabData.activity ? <Loader /> : <>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Top destinations</div>
                  {tabData.activity[1]?.slice(0, 12).map((d, i) => (
                    <div key={i} style={s.barRow}>
                      <div style={s.barLabel}>{d.destination}</div>
                      <div style={s.barBg}><div style={s.barFill(Math.round(100 * d.count / (tabData.activity[1][0]?.count || 1)))} /></div>
                      <div style={s.barCount}>{d.count}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Recent submissions</div>
                <table style={s.table}>
                  <thead><tr>{['Destination','Email','Plan','Status','Date'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {tabData.activity[2]?.slice(0, 30).map((r, i) => (
                      <tr key={i}>
                        <td style={s.td}>{r.destination}</td>
                        <td style={s.td}>{r.email?.replace(/(.{3}).*(@.*)/, '$1***$2')}</td>
                        <td style={s.td}><span style={{ color: r.plan === 'paid' ? '#ffd93d' : 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 700 }}>{r.plan}</span></td>
                        <td style={s.td}><span style={s.statusBadge(r.status)}>{r.status}</span></td>
                        <td style={s.td}>{new Date(r.created_at).toLocaleDateString('en-GB')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>}
            </div>
          )}

          {/* ── Interests ── */}
          {tab === 'interests' && (
            <div>
              <div style={s.secTitle}>Top travel interests</div>
              {!tabData.interests ? <Loader /> :
                tabData.interests[0]?.map((d, i) => (
                  <div key={i} style={s.barRow}>
                    <div style={{ ...s.barLabel, width: 110 }}>{d.interest}</div>
                    <div style={s.barBg}><div style={s.barFill(Math.round(100 * d.count / (tabData.interests[0][0]?.count || 1)), 'linear-gradient(90deg,#00d4aa,#00916a)')} /></div>
                    <div style={s.barCount}>{d.count}</div>
                  </div>
                ))}
            </div>
          )}

          {/* ── Tokens ── */}
          {tab === 'tokens' && (
            <div>
              <div style={s.secTitle}>Token utilisation</div>
              {!tabData.tokens ? <Loader /> : (
                <table style={s.table}>
                  <thead><tr>{['Month','Itineraries','Input tokens','Output tokens','Cost (USD)'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {tabData.tokens[0]?.map((r, i) => (
                      <tr key={i}>
                        <td style={s.td}>{new Date(r.month).toLocaleDateString('en-GB',{month:'short',year:'numeric'})}</td>
                        <td style={s.td}>{r.itineraries}</td>
                        <td style={s.td}>{(+r.input_tokens).toLocaleString()}</td>
                        <td style={s.td}>{(+r.output_tokens).toLocaleString()}</td>
                        <td style={s.td}><span style={{ color: '#ffd93d', fontWeight: 700 }}>${(+r.input_cost_usd + +r.output_cost_usd).toFixed(2)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── Chat ── */}
          {tab === 'chat' && (
            <div>
              <div style={s.secTitle}>AI Chat usage</div>
              {!tabData.chat ? <Loader /> : (
                <div style={s.kpiGrid}>
                  {[
                    { label: 'Total sessions', value: tabData.chat[0]?.totalSessions?.toLocaleString() },
                    { label: 'Led to planning', value: tabData.chat[0]?.converted?.toLocaleString() },
                    { label: 'Conversion rate', value: `${tabData.chat[0]?.conversionRate}%` },
                  ].map(({ label, value }) => (
                    <div key={label} style={s.kpi}><div style={s.kpiNum}>{value ?? '—'}</div><div style={s.kpiLabel}>{label}</div></div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Funnel ── */}
          {tab === 'funnel' && (
            <div>
              <div style={s.secTitle}>User funnel</div>
              {!tabData.funnel ? <Loader /> :
                tabData.funnel[0]?.map((stage, i, arr) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                    <div style={{ width: 90, fontSize: 13, color: '#fff' }}>{stage.stage}</div>
                    <div style={s.barBg}><div style={{ ...s.barFill(Math.round(100 * stage.count / (arr[0]?.count || 1))), background: `linear-gradient(90deg, #00d4aa, #00916a)`, opacity: 1 - i * 0.2 }} /></div>
                    <div style={{ width: 60, fontSize: 13, fontWeight: 700, color: '#00d4aa' }}>{stage.count?.toLocaleString()}</div>
                    {i > 0 && arr[i-1]?.count > 0 && (
                      <div style={{ width: 50, fontSize: 10, color: '#ff6b6b' }}>-{Math.round(100 - 100 * stage.count / arr[i-1].count)}%</div>
                    )}
                  </div>
                ))}
            </div>
          )}

          {/* ── Feedback ── */}
          {tab === 'feedback' && (
            <div>
              <div style={s.secTitle}>User feedback</div>
              {!tabData.feedback ? <Loader /> : <>
                <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                  {tabData.feedback[0]?.distribution?.map(d => (
                    <div key={d.rating} style={{ ...s.kpi, textAlign: 'center', minWidth: 80 }}>
                      <div style={{ fontSize: 16, marginBottom: 4 }}>{'★'.repeat(d.rating)}</div>
                      <div style={{ ...s.kpiNum, fontSize: 20 }}>{d.count}</div>
                    </div>
                  ))}
                </div>
                <table style={s.table}>
                  <thead><tr>{['Rating','Comment','Destination','Source','Date'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {tabData.feedback[0]?.recent?.map((r, i) => (
                      <tr key={i}>
                        <td style={s.td}>{'★'.repeat(r.rating)}</td>
                        <td style={{ ...s.td, maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.comment || '—'}</td>
                        <td style={s.td}>{r.destination || '—'}</td>
                        <td style={s.td}>{r.source}</td>
                        <td style={s.td}>{new Date(r.created_at).toLocaleDateString('en-GB')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>}
            </div>
          )}

          {/* ── Users ── */}
          {tab === 'users' && (
            <div>
              <div style={s.secTitle}>Users</div>
              {!tabData.users ? <Loader /> : (
                <table style={s.table}>
                  <thead><tr>{['Email','Name','Plan','Roles','Itineraries','Joined'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {tabData.users[0]?.map((u, i) => (
                      <tr key={i}>
                        <td style={s.td}>{u.email}</td>
                        <td style={s.td}>{u.name || '—'}</td>
                        <td style={s.td}><span style={{ color: u.plan !== 'free' ? '#ffd93d' : 'rgba(255,255,255,0.35)', fontWeight: 700, fontSize: 11 }}>{u.plan}</span></td>
                        <td style={s.td}>{u.roles?.filter(Boolean).map(r => (
                          <span key={r} style={{ marginRight: 4, padding: '2px 7px', borderRadius: 10, background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.18)', color: '#00d4aa', fontSize: 9, fontWeight: 700 }}>{r}</span>
                        ))}</td>
                        <td style={s.td}>{u.itinerary_count}</td>
                        <td style={s.td}>{u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── Roles (superadmin only) ── */}
          {tab === 'roles' && isSuperAdmin && (
            <div>
              <div style={s.secTitle}>Role management</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 16 }}>Assign or revoke roles. Changes take effect on next login.</div>
              {!tabData.roles ? <Loader /> : (
                <table style={s.table}>
                  <thead><tr>{['Email','Current roles','Assign role'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {tabData.roles[0]?.map((u, i) => (
                      <RoleRow key={i} user={u} getIdToken={getIdToken} API={API} />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RoleRow({ user, getIdToken, API }) {
  const [roles, setRoles] = useState(user.roles?.filter(Boolean) || []);
  const [busy, setBusy] = useState(false);

  const assign = async (roleName) => {
    if (roles.includes(roleName) || busy) return;
    setBusy(true);
    try {
      const token = await getIdToken();
      await fetch(`${API}/admin/users/${user.id}/roles`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleName }),
      });
      setRoles(r => [...r, roleName]);
    } finally { setBusy(false); }
  };

  return (
    <tr>
      <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{user.email}</td>
      <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        {roles.map(r => <span key={r} style={{ marginRight: 4, padding: '2px 7px', borderRadius: 10, background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.18)', color: '#00d4aa', fontSize: 9, fontWeight: 700 }}>{r}</span>)}
      </td>
      <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        {['user','admin','agency','support','superadmin'].map(r => (
          <button key={r} type="button" disabled={busy || roles.includes(r)} onClick={() => assign(r)}
            style={{ marginRight: 5, padding: '4px 10px', borderRadius: 10, background: roles.includes(r) ? 'rgba(255,255,255,0.03)' : 'rgba(0,212,170,0.08)', border: `1px solid ${roles.includes(r) ? 'rgba(255,255,255,0.07)' : 'rgba(0,212,170,0.22)'}`, color: roles.includes(r) ? 'rgba(255,255,255,0.25)' : '#00d4aa', fontSize: 10, fontWeight: 700, cursor: roles.includes(r) ? 'default' : 'pointer', fontFamily: 'inherit' }}>
            {roles.includes(r) ? `✓ ${r}` : `+ ${r}`}
          </button>
        ))}
      </td>
    </tr>
  );
}
