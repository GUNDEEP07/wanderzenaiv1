import React, { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import RouteMap from "../components/map/RouteMap"
import { fetchProgress } from "../api/itinerary"
import { useAuth } from "../context/AuthContext"

const API_URL = import.meta.env.VITE_API_URL
const POLL_MS = 4000

function FeedbackWidget({ submissionId, destination }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [hovering, setHovering] = useState(0);

  const submit = async () => {
    if (!rating) return;
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: submissionId, rating, comment, destination, source: 'post_delivery' }),
      });
    } catch { /* silent */ }
    setSubmitted(true);
  };

  if (submitted) return (
    <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 12, marginTop: 24 }}>
      <div style={{ fontSize: 24, marginBottom: 6 }}>🙏</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#4a7c59' }}>Thank you for your feedback!</div>
    </div>
  );

  return (
    <div style={{ marginTop: 28, padding: '20px 24px', background: '#fff', border: '1px solid #e6dccb', borderRadius: 14, textAlign: 'center' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2e20', marginBottom: 4 }}>How was your planning experience?</div>
      <div style={{ fontSize: 12, color: '#9a8c78', marginBottom: 14 }}>Takes 10 seconds — helps us improve</div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 14 }}>
        {[1,2,3,4,5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHovering(n)}
            onMouseLeave={() => setHovering(0)}
            style={{ fontSize: 28, background: 'none', border: 'none', cursor: 'pointer', opacity: n <= (hovering || rating) ? 1 : 0.3, transition: 'all 0.1s', transform: n <= (hovering || rating) ? 'scale(1.1)' : 'scale(1)' }}
          >⭐</button>
        ))}
      </div>
      {rating > 0 && (
        <>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Any comments? (optional)"
            rows={2}
            style={{ width: '100%', background: '#faf7f2', border: '1px solid #e6dccb', borderRadius: 8, color: '#1a2e20', fontFamily: 'inherit', fontSize: 13, padding: '8px 12px', resize: 'none', outline: 'none', marginBottom: 10 }}
          />
          <button type="button" onClick={submit} style={{ padding: '9px 24px', background: '#00d4aa', border: 'none', borderRadius: 8, color: '#0a0f1e', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
            Submit →
          </button>
        </>
      )}
    </div>
  );
}

// ── Live progress (Nov 7 2026): what the generator has really finished ──────────
export const STAGES = [
  { key: "places", label: "Finding real local places along your route" },
  { key: "writing", label: "Writing your days" },
  { key: "checking", label: "Checking for repeats and that your picks are in" },
  { key: "finishing", label: "Final touches" },
  { key: "pdf", label: "Building your travel guide PDF" },
  { key: "email", label: "Sending it to your inbox" },
]

/** Index of the stage in progress (STAGES.length = all done). */
export function stageIndex(status, stage) {
  if (status === "email_sent") return STAGES.length
  if (status === "pdf_ready") return 5
  if (status === "itinerary_ready") return 4
  const i = STAGES.findIndex(s => s.key === stage)
  return i >= 0 ? i : 0
}

const DONE = ["email_sent", "failed"]

const fmtElapsed = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

const s = {
  page: { minHeight: "100vh", background: "#faf7f2", display: "flex", flexDirection: "column", alignItems: "center", padding: "3rem 1rem", fontFamily: "Source Serif 4, Georgia, serif" },
  wrap: { maxWidth: "620px", width: "100%" },
  center: { textAlign: "center" },
  badge: (bg) => ({ width: 64, height: 64, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem", fontSize: "1.75rem" }),
  spinner: { width: 24, height: 24, borderRadius: "50%", border: "2px solid #4a7c59", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" },
  kicker: (c = "#4a7c59") => ({ fontSize: "0.7rem", letterSpacing: "0.25em", textTransform: "uppercase", color: c, marginBottom: "0.75rem" }),
  h1: { fontFamily: "Playfair Display, serif", fontSize: "2rem", color: "#1a2e20", marginBottom: "1rem", lineHeight: 1.2 },
  lead: { color: "#6a5e48", fontSize: "1rem", lineHeight: 1.8, marginBottom: "1.75rem" },
  panel: { background: "#e8f0ea", borderRadius: 8, padding: "1.1rem 1.4rem", marginBottom: "1.5rem", textAlign: "left" },
  stepRow: { display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.35rem 0", fontSize: "0.9rem" },
  dot: (done, active) => ({
    width: 20, height: 20, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", color: "white",
    background: done ? "#4a7c59" : active ? "#e8f0ea" : "transparent",
    border: done ? "none" : active ? "2px solid #4a7c59" : "1px solid #c8b89a",
    animation: active ? "pulse 1.5s ease-in-out infinite" : "none",
  }),
  stepText: (done, active) => ({ color: done ? "#1a2e20" : active ? "#4a7c59" : "#9a8c78", fontWeight: active ? 600 : 400 }),
  meta: { fontSize: "0.8rem", color: "#9a8c78" },
  sectionTitle: { fontFamily: "Playfair Display, serif", fontSize: "1.25rem", color: "#1a2e20", margin: "0.5rem 0 0.75rem", textAlign: "left" },
  routeChips: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: "0.9rem" },
  routeChip: { fontSize: "0.8rem", padding: "3px 10px", borderRadius: 100, background: "#fff", border: "1px solid #d8cdb8", color: "#1a2e20" },
  day: { background: "#fff", border: "1px solid #e6dccb", borderRadius: 8, padding: "0.8rem 1rem", marginBottom: "0.6rem", textAlign: "left", animation: "fadeIn 0.6s ease-out" },
  dayHead: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" },
  dayNum: { fontSize: "0.7rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "#4a7c59", fontWeight: 700 },
  dayBase: { fontSize: "0.75rem", color: "#9a8c78" },
  dayTheme: { fontFamily: "Playfair Display, serif", fontSize: "1.05rem", color: "#1a2e20", margin: "0.2rem 0 0.35rem" },
  stops: { fontSize: "0.85rem", color: "#6a5e48", lineHeight: 1.6 },
  ghost: { border: "1px dashed #d8cdb8", borderRadius: 8, padding: "0.8rem 1rem", marginBottom: "0.6rem", textAlign: "left", color: "#b3a58c", fontSize: "0.85rem" },
  primary: { background: "#1a2e20", color: "white", border: "none", padding: "0.85rem 2rem", borderRadius: "4px", fontFamily: "Source Serif 4, serif", fontSize: "0.95rem", cursor: "pointer", margin: "0 0.5rem 0.5rem 0" },
  secondary: { background: "none", border: "1px solid #c8b89a", padding: "0.85rem 2rem", borderRadius: "4px", fontFamily: "Source Serif 4, serif", fontSize: "0.95rem", color: "#6a5e48", cursor: "pointer" },
}

function DayCard({ d }) {
  return (
    <div style={s.day} data-testid={`day-${d.day}`}>
      <div style={s.dayHead}>
        <span style={s.dayNum}>Day {d.day}{d.travelDay ? " · travel day" : ""}</span>
        {d.base && <span style={s.dayBase}>📍 {d.base}</span>}
      </div>
      {d.theme && <div style={s.dayTheme}>{d.theme}</div>}
      {(d.stops?.length > 0 || d.eat) && (
        <div style={s.stops}>
          {d.stops?.join(" · ")}
          {d.eat && <>{d.stops?.length ? " · " : ""}🍜 {d.eat}</>}
        </div>
      )}
    </div>
  )
}

/** Days written so far, in order, with placeholders for the ones still being written. */
function DaysSoFar({ progress, writing }) {
  const total = progress?.totalDays || 0
  if (!total) return null
  const byDay = new Map((progress.days || []).map(d => [d.day, d]))
  return (
    <div aria-live="polite">
      <div style={s.sectionTitle}>Your days{byDay.size < total ? ` — ${byDay.size} of ${total} written` : ""}</div>
      {Array.from({ length: total }, (_, i) => i + 1).map(n => (byDay.has(n)
        ? <DayCard key={n} d={byDay.get(n)} />
        : <div key={n} style={s.ghost}>Day {n} — {writing ? "being written…" : "coming up"}</div>))}
    </div>
  )
}

function RoutePanel({ route }) {
  if (!route?.length) return null
  return (
    <>
      <div style={s.sectionTitle}>Your route</div>
      <div style={s.routeChips}>
        {route.map((b, i) => <span key={`${b.name}-${i}`} style={s.routeChip}>{i + 1}. {b.name}{b.days ? ` · ${b.days}d` : ""}</span>)}
      </div>
      <RouteMap stops={route} height={230} />
    </>
  )
}

export default function Confirmation() {
  const { state } = useLocation()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const submissionId = params.get("id") || state?.submissionId
  const [status, setStatus] = useState("pending")
  const [progress, setProgress] = useState(null) // owner-only live progress
  const [now, setNow] = useState(Date.now())
  const mountedAt = useRef(Date.now())

  const destination = progress?.destination || state?.destination || "your destination"
  const { currentUser } = useAuth()
  const email = state?.email || currentUser?.email || null
  const inbox = email ? <>at <strong style={{ color: "#1a2e20" }}>{email}</strong></> : "in your inbox"

  useEffect(() => {
    if (!submissionId) { navigate("/plan"); return undefined }
    let stopped = false
    let timer = null

    const poll = async () => {
      let next = null
      const live = await fetchProgress(submissionId)
      if (live.ok) {
        setProgress(live.data)
        next = live.data.status
      } else {
        // Not signed in on this device (or a hiccup): the public status still moves the steps.
        try {
          const res = await fetch(`${API_URL}/itinerary/${encodeURIComponent(submissionId)}`, { cache: "no-store" })
          const data = await res.json()
          if (data.success && data.data?.status) next = data.data.status
        } catch { /* keep polling */ }
      }
      if (stopped) return
      if (next) setStatus(next)
      if (!DONE.includes(next)) timer = setTimeout(poll, POLL_MS)
    }
    poll()
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => { stopped = true; clearTimeout(timer); clearInterval(tick) }
  }, [submissionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const current = stageIndex(status, progress?.stage)
  const startedAt = progress?.startedAt ? Date.parse(progress.startedAt) : mountedAt.current
  const writing = status === "processing" && progress?.stage === "writing"
  const doneDays = progress?.days?.length || 0

  if (status === "failed") {
    return (
      <div style={s.page}><div style={{ ...s.wrap, ...s.center }}>
        <div style={s.badge("#faecea")}>✕</div>
        <h1 style={s.h1}>Something went wrong</h1>
        <p style={s.lead}>{progress?.message || "We could not generate your itinerary. Please try again — this is usually a temporary issue."}</p>
        <button onClick={() => navigate("/plan")} style={s.primary}>Try again</button>
      </div><Keyframes /></div>
    )
  }

  if (status === "email_sent") {
    return (
      <div style={s.page}><div style={s.wrap}>
        <div style={s.center}>
          <div style={s.badge("#e8f0ea")}>✓</div>
          <div style={s.kicker()}>Delivered</div>
          <h1 style={s.h1}>Your {destination} adventure begins now</h1>
          <p style={s.lead}>
            Your slow travel guide to {destination} is waiting {inbox}. Hidden cafes, secret trails and local gems — all yours. Check spam if it does not arrive within 5 minutes.
          </p>
          <button onClick={() => navigate("/plan")} style={s.primary}>Plan another trip</button>
          <button onClick={() => navigate("/pricing")} style={s.secondary}>See pricing</button>
        </div>
        {progress && (
          <div style={{ marginTop: "2rem" }}>
            <RoutePanel route={progress.route} />
            <DaysSoFar progress={progress} writing={false} />
          </div>
        )}
        <FeedbackWidget submissionId={submissionId} destination={destination} />
      </div><Keyframes /></div>
    )
  }

  return (
    <div style={s.page}><div style={s.wrap}>
      <div style={s.center}>
        <div style={s.badge("#e8f0ea")}><div style={s.spinner} /></div>
        <div style={s.kicker()}>In progress · {fmtElapsed(now - startedAt)}</div>
        <h1 style={s.h1}>Writing your {destination} trip</h1>
        <p style={s.lead}>
          Watch it come together — each day appears here as soon as it's written. It usually takes 1–3 minutes, and the full guide lands {inbox}. You can close this page; nothing is lost.
        </p>
      </div>

      <div style={s.panel} role="status">
        {STAGES.map((step, i) => {
          const done = i < current
          const active = i === current
          const extra = step.key === "writing" && progress?.totalDays && (active || done) ? ` (${doneDays} of ${progress.totalDays})` : ""
          return (
            <div key={step.key} style={s.stepRow}>
              <span style={s.dot(done, active)}>{done ? "✓" : ""}</span>
              <span style={s.stepText(done, active)}>{step.label}{extra}</span>
            </div>
          )
        })}
      </div>

      {progress && (
        <>
          <RoutePanel route={progress.route} />
          <DaysSoFar progress={progress} writing={writing} />
        </>
      )}
    </div><Keyframes /></div>
  )
}

function Keyframes() {
  return (
    <style>{`
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
      @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
    `}</style>
  )
}
