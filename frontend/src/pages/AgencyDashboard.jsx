import { useState } from "react";

const MOCK_AGENCY = {
  name: "Horizon Travel Co.",
  plan: "Professional",
  itinerariesUsed: 34,
  itinerariesTotal: 100,
  agents: 3,
  joinedDate: "Feb 2025",
  branding: {
    logo: null,
    primaryColor: "#1a6b5a",
    accentColor: "#d4a843",
    agencyName: "Horizon Travel Co.",
    tagline: "Crafting journeys, not just trips",
    website: "horizontravel.com.au",
    email: "hello@horizontravel.com.au",
    phone: "+61 2 9123 4567",
  },
};

const MOCK_CLIENTS = [
  { id: 1, name: "Sarah & James Mitchell", email: "s.mitchell@gmail.com", destination: "Kyoto, Japan", days: 7, status: "delivered", date: "Apr 8, 2025", agent: "Emma R.", budget: "AUD 4,000" },
  { id: 2, name: "Priya Sharma", email: "priya.sharma@outlook.com", destination: "Tuscany, Italy", days: 10, status: "delivered", date: "Apr 7, 2025", agent: "Tom K.", budget: "EUR 3,500" },
  { id: 3, name: "The Henderson Family", email: "davidh@gmail.com", destination: "Bali, Indonesia", days: 14, status: "generating", date: "Apr 8, 2025", agent: "Emma R.", budget: "AUD 6,000" },
  { id: 4, name: "Michael Torres", email: "mtorres@hotmail.com", destination: "Patagonia, Chile", days: 12, status: "delivered", date: "Apr 6, 2025", agent: "Tom K.", budget: "USD 5,200" },
  { id: 5, name: "Yuki Tanaka", email: "yuki.t@gmail.com", destination: "Morocco", days: 8, status: "draft", date: "Apr 5, 2025", agent: "Emma R.", budget: "GBP 2,800" },
  { id: 6, name: "Claire Dubois", email: "claire.d@wanadoo.fr", destination: "Sri Lanka", days: 10, status: "delivered", date: "Apr 4, 2025", agent: "Tom K.", budget: "EUR 2,600" },
];

const MOCK_AGENTS = [
  { id: 1, name: "Emma Riordan", email: "emma@horizontravel.com.au", role: "Senior Agent", itineraries: 22, clients: 18, joined: "Jan 2025" },
  { id: 2, name: "Tom Khatri", email: "tom@horizontravel.com.au", role: "Agent", itineraries: 12, clients: 10, joined: "Mar 2025" },
  { id: 3, name: "Alex Wu", email: "alex@horizontravel.com.au", role: "Junior Agent", itineraries: 0, clients: 0, joined: "Apr 2025" },
];

const STATUS_STYLES = {
  delivered: { bg: "rgba(29,158,117,0.12)", color: "#0F6E56", label: "Delivered" },
  generating: { bg: "rgba(239,159,39,0.12)", color: "#854F0B", label: "Generating..." },
  draft: { bg: "rgba(136,135,128,0.12)", color: "#5F5E5A", label: "Draft" },
};

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: "◈" },
  { id: "clients", label: "Clients", icon: "◎" },
  { id: "generate", label: "New itinerary", icon: "✦" },
  { id: "agents", label: "Agents", icon: "◉" },
  { id: "branding", label: "White-label", icon: "◐" },
  { id: "portal", label: "Client portal", icon: "⬡" },
  { id: "api", label: "API access", icon: "⬢" },
];

const css = `  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; background: #f4f1ec; color: #1a1610; }
  input, textarea, select, button { font-family: 'DM Sans', sans-serif; }
  ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: #d4cfc5; border-radius: 2px; }
  input[type=color] { -webkit-appearance: none; border: none; padding: 0; cursor: pointer; border-radius: 4px; overflow: hidden; }
`;

const s = {
  shell: { display: "flex", height: "100vh", background: "#f4f1ec", overflow: "hidden" },
  sidebar: { width: 220, background: "#14110d", display: "flex", flexDirection: "column", flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.06)" },
  sidebarTop: { padding: "24px 20px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" },
  agencyName: { fontFamily: "'DM Serif Display', serif", fontSize: 15, color: "#fff", lineHeight: 1.2, marginBottom: 3 },
  planBadge: { fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "rgba(212,168,67,0.15)", color: "#d4a843", fontWeight: 500 },
  nav: { flex: 1, padding: "12px 10px", display: "flex", flexDirection: "column", gap: 2 },
  navItem: (active) => ({ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, cursor: "pointer", background: active ? "rgba(255,255,255,0.08)" : "transparent", color: active ? "#fff" : "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: active ? 500 : 400, transition: "all .15s", border: "none", width: "100%", textAlign: "left" }),
  navIcon: { fontSize: 12, width: 16, textAlign: "center", flexShrink: 0 },
  sidebarBottom: { padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.06)" },
  usageBar: { height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 2, marginTop: 6, overflow: "hidden" },
  usageFill: (pct) => ({ height: "100%", width: pct + "%", background: pct > 80 ? "#e05a5a" : "#d4a843", borderRadius: 2, transition: "width .5s" }),
  usageLabel: { fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 4 },
  main: { flex: 1, overflow: "auto", display: "flex", flexDirection: "column" },
  topbar: { height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", background: "#f4f1ec", borderBottom: "1px solid #e5e0d5", flexShrink: 0 },
  topbarTitle: { fontFamily: "'DM Serif Display', serif", fontSize: 18, color: "#14110d" },
  topbarRight: { display: "flex", alignItems: "center", gap: 12 },
  avatarBtn: { width: 32, height: 32, borderRadius: "50%", background: "#14110d", color: "#d4a843", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none" },
  content: { flex: 1, padding: "28px", overflow: "auto" },
  grid4: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginBottom: 24 },
  grid2: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 16, marginBottom: 20 },
  statCard: { background: "#fff", border: "1px solid #e5e0d5", borderRadius: 12, padding: "16px 18px" },
  statVal: { fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#14110d", lineHeight: 1, marginBottom: 4 },
  statLabel: { fontSize: 11, color: "#8a8070", letterSpacing: "0.05em", textTransform: "uppercase" },
  statDelta: (pos) => ({ fontSize: 11, color: pos ? "#0F6E56" : "#993C1D", marginTop: 4 }),
  card: { background: "#fff", border: "1px solid #e5e0d5", borderRadius: 14, padding: "20px 22px", marginBottom: 16 },
  cardTitle: { fontFamily: "'DM Serif Display', serif", fontSize: 16, color: "#14110d", marginBottom: 14 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { fontSize: 10, fontWeight: 600, color: "#8a8070", textTransform: "uppercase", letterSpacing: "0.08em", padding: "0 12px 10px 0", textAlign: "left", borderBottom: "1px solid #e5e0d5" },
  td: { fontSize: 13, color: "#1a1610", padding: "12px 12px 12px 0", borderBottom: "1px solid #f0ebe0", verticalAlign: "middle" },
  tdMuted: { fontSize: 12, color: "#8a8070" },
  statusBadge: (status) => ({ fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: STATUS_STYLES[status]?.bg, color: STATUS_STYLES[status]?.color, whiteSpace: "nowrap" }),
  btn: { background: "#14110d", color: "#fff", border: "none", padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all .15s" },
  btnSm: { background: "#14110d", color: "#fff", border: "none", padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: "pointer" },
  btnGhost: { background: "transparent", color: "#1a1610", border: "1px solid #d5cfc4", padding: "7px 16px", borderRadius: 8, fontSize: 13, cursor: "pointer" },
  btnGold: { background: "#d4a843", color: "#14110d", border: "none", padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  label: { display: "block", fontSize: 11, fontWeight: 600, color: "#8a8070", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 },
  input: { width: "100%", padding: "9px 12px", background: "#faf8f4", border: "1px solid #e0dbd0", borderRadius: 8, fontSize: 13, color: "#14110d", outline: "none" },
  select: { width: "100%", padding: "9px 12px", background: "#faf8f4", border: "1px solid #e0dbd0", borderRadius: 8, fontSize: 13, color: "#14110d", outline: "none" },
  textarea: { width: "100%", padding: "9px 12px", background: "#faf8f4", border: "1px solid #e0dbd0", borderRadius: 8, fontSize: 13, color: "#14110d", outline: "none", resize: "vertical" },
  fieldWrap: { marginBottom: 16 },
  row: { display: "flex", gap: 12 },
  infoBox: { background: "#faf8f4", border: "1px solid #e5e0d5", borderRadius: 10, padding: "12px 14px", fontSize: 12, color: "#8a8070", lineHeight: 1.7, marginBottom: 16 },
  divider: { borderTop: "1px solid #e5e0d5", margin: "20px 0" },
  portalPreview: { background: "#0a0f1e", borderRadius: 12, padding: 24, color: "#fff", fontFamily: "'DM Sans', sans-serif" },
  tag: { display: "inline-block", fontSize: 10, padding: "3px 10px", borderRadius: 20, background: "#f0ebe0", color: "#8a8070", marginRight: 4, marginBottom: 4 },
  codeBox: { background: "#14110d", borderRadius: 10, padding: "16px 18px", fontFamily: "monospace", fontSize: 11, color: "#d4a843", lineHeight: 1.8, overflow: "auto", marginBottom: 12 },
  apiKey: { display: "flex", alignItems: "center", gap: 8, background: "#faf8f4", border: "1px solid #e0dbd0", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#1a1610", fontFamily: "monospace", marginBottom: 12 },
};

function Sidebar({ active, setActive, agency }) {
  const pct = Math.round((agency.itinerariesUsed / agency.itinerariesTotal) * 100);
  return (
    <div style={s.sidebar}>
      <div style={s.sidebarTop}>
        <div style={s.agencyName}>{agency.name}</div>
        <div style={{ marginTop: 6 }}>
          <span style={s.planBadge}>{agency.plan} plan</span>
        </div>
      </div>
      <nav style={s.nav}>
        {NAV_ITEMS.map(item => (
          <button key={item.id} style={s.navItem(active === item.id)} onClick={() => setActive(item.id)}>
            <span style={s.navIcon}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <div style={s.sidebarBottom}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
          <span>Itineraries</span>
          <span style={{ color: pct > 80 ? "#e05a5a" : "#d4a843" }}>{agency.itinerariesUsed}/{agency.itinerariesTotal}</span>
        </div>
        <div style={s.usageBar}><div style={s.usageFill(pct)} /></div>
        <div style={s.usageLabel}>{100 - agency.itinerariesUsed} remaining this month</div>
      </div>
    </div>
  );
}

function Overview({ agency, clients }) {
  const delivered = clients.filter(c => c.status === "delivered").length;
  return (
    <div>
      <div style={s.grid4}>
        {[
          { val: delivered, label: "Delivered this month", delta: "+12 vs last month", pos: true },
          { val: agency.itinerariesUsed, label: "Itineraries generated", delta: "34% of monthly quota", pos: true },
          { val: agency.agents, label: "Active agents", delta: "+1 this month", pos: true },
          { val: "4h 12m", label: "Avg time saved/client", delta: "vs manual planning", pos: true },
        ].map(s2 => (
          <div key={s2.label} style={s.statCard}>
            <div style={s.statVal}>{s2.val}</div>
            <div style={s.statLabel}>{s2.label}</div>
            <div style={s.statDelta(s2.pos)}>{s2.delta}</div>
          </div>
        ))}
      </div>

      <div style={s.grid2}>
        <div style={s.card}>
          <div style={s.cardTitle}>Recent clients</div>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Client</th>
                <th style={s.th}>Destination</th>
                <th style={s.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {clients.slice(0, 5).map(c => (
                <tr key={c.id}>
                  <td style={s.td}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{c.name}</div>
                    <div style={s.tdMuted}>{c.agent}</div>
                  </td>
                  <td style={s.td}><div style={{ fontSize: 13 }}>{c.destination}</div><div style={s.tdMuted}>{c.days} days</div></td>
                  <td style={s.td}><span style={s.statusBadge(c.status)}>{STATUS_STYLES[c.status]?.label}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={s.card}>
          <div style={s.cardTitle}>This month at a glance</div>
          {[
            { label: "Top destination", val: "Japan (8 plans)" },
            { label: "Avg trip length", val: "9.2 days" },
            { label: "Most active agent", val: "Emma Riordan" },
            { label: "Avg generation time", val: "2m 41s" },
            { label: "Client open rate", val: "94% — PDF opened" },
            { label: "Repeat clients", val: "6 (18%)" },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #f0ebe0", fontSize: 13 }}>
              <span style={{ color: "#8a8070" }}>{r.label}</span>
              <span style={{ fontWeight: 500 }}>{r.val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Clients({ clients }) {
  const [search, setSearch] = useState("");
  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.destination.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <input style={{ ...s.input, maxWidth: 280 }} placeholder="Search clients or destinations..." value={search} onChange={e => setSearch(e.target.value)} />
        <button style={s.btn}>+ New client itinerary</button>
      </div>
      <div style={s.card}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Client</th>
              <th style={s.th}>Destination</th>
              <th style={s.th}>Budget</th>
              <th style={s.th}>Agent</th>
              <th style={s.th}>Date</th>
              <th style={s.th}>Status</th>
              <th style={s.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id}>
                <td style={s.td}>
                  <div style={{ fontWeight: 500 }}>{c.name}</div>
                  <div style={s.tdMuted}>{c.email}</div>
                </td>
                <td style={s.td}><div>{c.destination}</div><div style={s.tdMuted}>{c.days} days</div></td>
                <td style={s.td}>{c.budget}</td>
                <td style={s.td}>{c.agent}</td>
                <td style={s.td}>{c.date}</td>
                <td style={s.td}><span style={s.statusBadge(c.status)}>{STATUS_STYLES[c.status]?.label}</span></td>
                <td style={s.td}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button style={s.btnSm}>View PDF</button>
                    <button style={{ ...s.btnSm, background: "transparent", color: "#8a8070", border: "1px solid #e0dbd0" }}>Resend</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Generate() {
  const [form, setForm] = useState({ client: "", email: "", destination: "", days: 7, budget: "", currency: "AUD", style: [], pace: "balanced", interests: "", language: "English", agent: "" });
  const [submitted, setSubmitted] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleStyle = (st) => setForm(f => ({ ...f, style: f.style.includes(st) ? f.style.filter(x => x !== st) : [...f.style, st] }));
  const styles = ["Nature", "Cultural", "Foodie", "Wellness", "Adventure", "Relaxation", "Luxury"];

  if (submitted) return (
    <div style={{ ...s.card, textAlign: "center", padding: "48px 24px" }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(29,158,117,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 20, color: "#0F6E56" }}>✓</div>
      <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, marginBottom: 8 }}>Generating {form.destination} itinerary</div>
      <div style={{ fontSize: 13, color: "#8a8070", marginBottom: 24 }}>Your branded PDF will be emailed to {form.email} within 3 minutes.</div>
      <button style={s.btn} onClick={() => setSubmitted(false)}>Generate another</button>
    </div>
  );

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={s.card}>
        <div style={s.cardTitle}>New client itinerary</div>
        <div style={s.infoBox}>The PDF will be sent with your agency branding — your logo, colours and contact details. No WanderZenAI branding visible to your client.</div>

        <div style={s.row}>
          <div style={{ ...s.fieldWrap, flex: 1 }}>
            <label style={s.label}>Client name</label>
            <input style={s.input} placeholder="Sarah & James Mitchell" value={form.client} onChange={e => set("client", e.target.value)} />
          </div>
          <div style={{ ...s.fieldWrap, flex: 1 }}>
            <label style={s.label}>Client email</label>
            <input style={s.input} type="email" placeholder="client@email.com" value={form.email} onChange={e => set("email", e.target.value)} />
          </div>
        </div>

        <div style={s.row}>
          <div style={{ ...s.fieldWrap, flex: 2 }}>
            <label style={s.label}>Destination</label>
            <input style={s.input} placeholder="e.g. Kyoto, Japan" value={form.destination} onChange={e => set("destination", e.target.value)} />
          </div>
          <div style={{ ...s.fieldWrap, flex: 1 }}>
            <label style={s.label}>Days</label>
            <input style={s.input} type="number" min="1" max="30" value={form.days} onChange={e => set("days", e.target.value)} />
          </div>
        </div>

        <div style={s.row}>
          <div style={{ ...s.fieldWrap, flex: 1 }}>
            <label style={s.label}>Currency</label>
            <select style={s.select} value={form.currency} onChange={e => set("currency", e.target.value)}>
              {["AUD","USD","GBP","EUR","INR","JPY","SGD"].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ ...s.fieldWrap, flex: 2 }}>
            <label style={s.label}>Total budget</label>
            <input style={s.input} type="number" placeholder="5000" value={form.budget} onChange={e => set("budget", e.target.value)} />
          </div>
          <div style={{ ...s.fieldWrap, flex: 1 }}>
            <label style={s.label}>Assign agent</label>
            <select style={s.select} value={form.agent} onChange={e => set("agent", e.target.value)}>
              <option value="">Select agent</option>
              {MOCK_AGENTS.map(a => <option key={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>

        <div style={s.fieldWrap}>
          <label style={s.label}>Travel style</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {styles.map(st => (
              <button key={st} onClick={() => toggleStyle(st)} style={{ padding: "5px 14px", borderRadius: 20, border: `1px solid ${form.style.includes(st) ? "#14110d" : "#e0dbd0"}`, background: form.style.includes(st) ? "#14110d" : "transparent", color: form.style.includes(st) ? "#fff" : "#8a8070", fontSize: 12, cursor: "pointer" }}>
                {st}
              </button>
            ))}
          </div>
        </div>

        <div style={s.row}>
          <div style={{ ...s.fieldWrap, flex: 1 }}>
            <label style={s.label}>Language</label>
            <select style={s.select} value={form.language} onChange={e => set("language", e.target.value)}>
              {["English","Hindi","Spanish","French","German","Japanese","Arabic","Portuguese","Italian"].map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div style={{ ...s.fieldWrap, flex: 1 }}>
            <label style={s.label}>Pace</label>
            <select style={s.select} value={form.pace} onChange={e => set("pace", e.target.value)}>
              <option value="relaxed">Relaxed</option>
              <option value="balanced">Balanced</option>
              <option value="packed">Full days</option>
            </select>
          </div>
        </div>

        <div style={s.fieldWrap}>
          <label style={s.label}>Client interests & notes</label>
          <textarea style={s.textarea} rows={3} placeholder="e.g. Client honeymoon — prefers boutique ryokans, sake tastings, no crowds. Dietary: vegetarian." value={form.interests} onChange={e => set("interests", e.target.value)} />
        </div>

        <button style={s.btnGold} onClick={() => setSubmitted(true)}>Generate branded itinerary →</button>
      </div>
    </div>
  );
}

function Agents({ agents }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "#8a8070" }}>{agents.length} agents · 1 seat available</div>
        <button style={s.btn}>+ Invite agent</button>
      </div>
      <div style={s.card}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Agent</th>
              <th style={s.th}>Role</th>
              <th style={s.th}>Itineraries</th>
              <th style={s.th}>Clients</th>
              <th style={s.th}>Joined</th>
              <th style={s.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {agents.map(a => (
              <tr key={a.id}>
                <td style={s.td}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#f0ebe0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "#8a8070", flexShrink: 0 }}>{a.name.split(" ").map(n => n[0]).join("")}</div>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{a.name}</div>
                      <div style={s.tdMuted}>{a.email}</div>
                    </div>
                  </div>
                </td>
                <td style={s.td}><span style={s.tag}>{a.role}</span></td>
                <td style={s.td}>{a.itineraries}</td>
                <td style={s.td}>{a.clients}</td>
                <td style={s.td}>{a.joined}</td>
                <td style={s.td}>
                  <button style={{ ...s.btnSm, background: "transparent", color: "#8a8070", border: "1px solid #e0dbd0" }}>Manage</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Branding({ agency }) {
  const [brand, setBrand] = useState(agency.branding);
  const set = (k, v) => setBrand(b => ({ ...b, [k]: v }));
  const [saved, setSaved] = useState(false);
  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div style={s.grid2}>
      <div>
        <div style={s.card}>
          <div style={s.cardTitle}>Agency branding</div>
          <div style={s.infoBox}>All client PDFs will use your branding. WanderZenAI does not appear anywhere on client-facing documents.</div>

          <div style={s.fieldWrap}>
            <label style={s.label}>Agency name (on PDF)</label>
            <input style={s.input} value={brand.agencyName} onChange={e => set("agencyName", e.target.value)} />
          </div>
          <div style={s.fieldWrap}>
            <label style={s.label}>Tagline</label>
            <input style={s.input} value={brand.tagline} onChange={e => set("tagline", e.target.value)} />
          </div>
          <div style={s.row}>
            <div style={{ ...s.fieldWrap, flex: 1 }}>
              <label style={s.label}>Website</label>
              <input style={s.input} value={brand.website} onChange={e => set("website", e.target.value)} />
            </div>
            <div style={{ ...s.fieldWrap, flex: 1 }}>
              <label style={s.label}>Contact email</label>
              <input style={s.input} value={brand.email} onChange={e => set("email", e.target.value)} />
            </div>
          </div>
          <div style={s.fieldWrap}>
            <label style={s.label}>Phone</label>
            <input style={s.input} value={brand.phone} onChange={e => set("phone", e.target.value)} />
          </div>

          <div style={s.divider} />
          <div style={{ ...s.fieldWrap }}>
            <label style={s.label}>Brand colours</label>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="color" value={brand.primaryColor} onChange={e => set("primaryColor", e.target.value)} style={{ width: 36, height: 36, borderRadius: 8, cursor: "pointer" }} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#8a8070" }}>Primary</div>
                  <div style={{ fontSize: 11, fontFamily: "monospace" }}>{brand.primaryColor}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="color" value={brand.accentColor} onChange={e => set("accentColor", e.target.value)} style={{ width: 36, height: 36, borderRadius: 8, cursor: "pointer" }} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#8a8070" }}>Accent</div>
                  <div style={{ fontSize: 11, fontFamily: "monospace" }}>{brand.accentColor}</div>
                </div>
              </div>
            </div>
          </div>

          <div style={s.fieldWrap}>
            <label style={s.label}>Logo upload</label>
            <div style={{ border: "2px dashed #e0dbd0", borderRadius: 10, padding: "24px", textAlign: "center", fontSize: 12, color: "#8a8070", cursor: "pointer" }}>
              Drop your logo here or click to upload<br />
              <span style={{ fontSize: 11 }}>PNG or SVG · Max 2MB · Will appear on all client PDFs</span>
            </div>
          </div>

          <button style={s.btnGold} onClick={save}>{saved ? "Saved ✓" : "Save branding"}</button>
        </div>
      </div>

      <div>
        <div style={s.card}>
          <div style={s.cardTitle}>PDF preview</div>
          <div style={{ background: "#14110d", borderRadius: 10, padding: "20px", fontFamily: "'DM Sans', sans-serif", fontSize: 11 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 16, color: brand.primaryColor, marginBottom: 2 }}>{brand.agencyName}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em" }}>{brand.tagline.toUpperCase()}</div>
              </div>
              <div style={{ textAlign: "right", fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
                <div>{brand.website}</div>
                <div>{brand.email}</div>
              </div>
            </div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: "#fff", marginBottom: 8 }}>Kyoto, Japan</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>7-day personalised itinerary · Sarah & James Mitchell</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {["7 days", "AUD 4,000", "Couple", "Relaxed pace"].map(m => (
                <div key={m} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "4px 8px", fontSize: 9, color: "rgba(255,255,255,0.6)" }}>{m}</div>
              ))}
            </div>
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: brand.accentColor, marginBottom: 4, letterSpacing: "0.1em" }}>DAY 1 — ARRIVAL & FIRST WANDER</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>Morning · Nanzenji temple at dawn · Free</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>Afternoon · Philosopher's Path stroll · Free</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>Evening · Pontocho alley dinner · ¥3,000</div>
            </div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: 12 }}>
              {brand.agencyName} · {brand.website} · {brand.phone}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Portal() {
  const [copied, setCopied] = useState(false);
  const portalUrl = "https://portal.wanderzenai.com/agency/horizon-travel";
  const copy = () => { setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={s.card}>
        <div style={s.cardTitle}>Client portal</div>
        <div style={s.infoBox}>Share this link with clients. They log in with their email to view, download and access all itineraries you've created for them. Your branding — not WanderZenAI's.</div>

        <div style={s.fieldWrap}>
          <label style={s.label}>Your portal URL</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input style={s.input} value={portalUrl} readOnly />
            <button style={s.btn} onClick={copy}>{copied ? "Copied!" : "Copy"}</button>
          </div>
        </div>

        <div style={s.fieldWrap}>
          <label style={s.label}>Custom domain (Professional & Enterprise)</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input style={s.input} placeholder="portal.horizontravel.com.au" />
            <button style={s.btnGhost}>Configure</button>
          </div>
          <div style={{ fontSize: 11, color: "#8a8070", marginTop: 6 }}>Point a CNAME record to portal.wanderzenai.com — SSL handled automatically.</div>
        </div>

        <div style={s.divider} />
        <div style={s.cardTitle}>Portal preview</div>

        <div style={s.portalPreview}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 16, color: "#d4a843" }}>Horizon Travel Co.</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Your personal travel portal</div>
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Sarah Mitchell</div>
          </div>
          <div style={{ fontSize: 10, fontWeight: 500, color: "rgba(255,255,255,0.6)", marginBottom: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>Your itineraries</div>
          {[
            { dest: "Kyoto, Japan", days: 7, date: "Apr 8, 2025" },
            { dest: "Bali, Indonesia", days: 10, date: "Jan 12, 2025" },
          ].map(it => (
            <div key={it.dest} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "14px 16px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#fff" }}>{it.dest}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{it.days} days · {it.date}</div>
              </div>
              <div style={{ background: "#1a6b5a", color: "#fff", fontSize: 11, padding: "5px 14px", borderRadius: 6, cursor: "pointer" }}>Download PDF</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function APIAccess() {
  const [visible, setVisible] = useState(false);
  const apiKey = "wzb2b_sk_live_hT8xK2mNpQr4vWzA9bLdEcYjF6uX";
  const masked = "wzb2b_sk_live_" + "•".repeat(20);

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={s.card}>
        <div style={s.cardTitle}>API access</div>
        <div style={s.infoBox}>Integrate WanderZenAI directly into your booking system or CRM. Available on Professional and Enterprise plans. Rate limit: 100 requests/hour.</div>

        <div style={s.fieldWrap}>
          <label style={s.label}>API key</label>
          <div style={s.apiKey}>
            <span style={{ flex: 1, letterSpacing: "0.05em" }}>{visible ? apiKey : masked}</span>
            <button style={{ ...s.btnSm, background: "transparent", color: "#8a8070", border: "none" }} onClick={() => setVisible(!visible)}>{visible ? "Hide" : "Show"}</button>
            <button style={s.btnSm}>Copy</button>
          </div>
          <div style={{ fontSize: 11, color: "#e05a5a", marginTop: 4 }}>Never share your API key. Rotate it immediately if compromised.</div>
        </div>

        <div style={s.divider} />
        <div style={{ ...s.cardTitle, marginBottom: 10 }}>Generate itinerary endpoint</div>

        <div style={s.codeBox}>
{`POST https://api.wanderzenai.com/v1/generate

Authorization: Bearer wzb2b_sk_live_...

{
  "client_name": "Sarah Mitchell",
  "client_email": "sarah@email.com",
  "destination": "Kyoto, Japan",
  "days": 7,
  "budget": 4000,
  "currency": "AUD",
  "traveler_type": "couple",
  "travel_style": ["nature", "cultural"],
  "pace": "relaxed",
  "language": "English",
  "send_email": true,
  "white_label": true
}`}
        </div>

        <div style={{ ...s.cardTitle, marginBottom: 10 }}>Response</div>
        <div style={s.codeBox}>
{`{
  "success": true,
  "itinerary_id": "wzit_8kP2mNqRt4vW",
  "status": "generating",
  "pdf_url": null,
  "estimated_ready": "2025-04-08T14:45:00Z",
  "webhook_url": "https://your-site.com/webhook"
}`}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button style={s.btn}>View full docs</button>
          <button style={s.btnGhost}>Webhook settings</button>
          <button style={{ ...s.btnGhost, color: "#e05a5a", borderColor: "#f0c0c0" }}>Rotate API key</button>
        </div>
      </div>
    </div>
  );
}

export default function AgencyDashboard() {
  const [active, setActive] = useState("overview");

  const PAGES = { overview: "Overview", clients: "Clients", generate: "New itinerary", agents: "Agents", branding: "White-label settings", portal: "Client portal", api: "API access" };

  return (
    <>
      <style>{css}</style>
      <div style={s.shell}>
        <Sidebar active={active} setActive={setActive} agency={MOCK_AGENCY} />
        <div style={s.main}>
          <div style={s.topbar}>
            <div style={s.topbarTitle}>{PAGES[active]}</div>
            <div style={s.topbarRight}>
              <button style={{ ...s.btnGold, fontSize: 12, padding: "6px 14px" }} onClick={() => setActive("generate")}>+ New itinerary</button>
              <div style={s.avatarBtn}>HR</div>
            </div>
          </div>
          <div style={s.content}>
            {active === "overview" && <Overview agency={MOCK_AGENCY} clients={MOCK_CLIENTS} />}
            {active === "clients" && <Clients clients={MOCK_CLIENTS} />}
            {active === "generate" && <Generate />}
            {active === "agents" && <Agents agents={MOCK_AGENTS} />}
            {active === "branding" && <Branding agency={MOCK_AGENCY} />}
            {active === "portal" && <Portal />}
            {active === "api" && <APIAccess />}
          </div>
        </div>
      </div>
    </>
  );
}
