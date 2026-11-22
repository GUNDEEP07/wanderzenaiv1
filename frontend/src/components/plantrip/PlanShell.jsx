import { useEffect, useRef } from 'react';

/**
 * The frame every planner step shares (Nov 2026 redesign): header, trip summary bar
 * (tap → Trip basics), 5-segment progress, step heading, the step's content, and a footer
 * with Back / status / Continue pinned to the bottom of the screen.
 */
const s = {
  page: { minHeight: '100vh', background: '#0a0f1e', color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", display: 'flex', flexDirection: 'column' },
  header: { height: 56, padding: '0 clamp(16px, 4vw, 32px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', gap: 12 },
  logo: { display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: '#fff', fontWeight: 800, fontSize: 15 },
  logoMark: { width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg,#00d4aa,#00916a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#0a0f1e' },
  exit: { minHeight: 44, padding: '0 6px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.75)', fontFamily: 'inherit', fontSize: 14, cursor: 'pointer' },
  body: (wide) => ({ width: '100%', maxWidth: wide ? 1240 : 720, margin: '0 auto', padding: '12px clamp(16px, 4vw, 32px) 24px', boxSizing: 'border-box', flex: 1 }),
  summary: { width: '100%', minHeight: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: '#111827', color: 'rgba(255,255,255,0.85)', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '0 14px', cursor: 'pointer', textAlign: 'left' },
  progress: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, margin: '16px 0 10px', maxWidth: 360 },
  seg: (state) => ({ height: 4, borderRadius: 2, border: 'none', padding: 0, background: state === 'todo' ? 'rgba(255,255,255,0.12)' : '#00d4aa', opacity: state === 'done' ? 0.75 : 1, cursor: state === 'done' ? 'pointer' : 'default' }),
  kicker: { fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#00d4aa' },
  h1: { fontFamily: "'Fraunces', serif", fontSize: 'clamp(26px, 5vw, 32px)', lineHeight: 1.15, margin: '4px 0 4px', fontWeight: 700 },
  sub: { margin: '0 0 16px', fontSize: 15, color: 'rgba(255,255,255,0.72)', lineHeight: 1.5 },
  // Above the cookie banner while it shows (CookieBanner sets --wz-cookie-h).
  footer: { position: 'sticky', bottom: 'var(--wz-cookie-h, 0px)', zIndex: 10, background: 'rgba(10,15,30,0.97)', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '10px clamp(16px, 4vw, 32px) calc(12px + env(safe-area-inset-bottom, 0px))' },
  footerInner: (wide) => ({ maxWidth: wide ? 1240 : 720, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }),
  back: { minHeight: 48, padding: '0 12px', border: 'none', background: 'none', color: 'rgba(255,255,255,0.8)', fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer' },
  status: { flex: 1, textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.35 },
  next: (disabled) => ({ minHeight: 48, padding: '0 24px', borderRadius: 12, border: 'none', background: disabled ? 'rgba(0,212,170,0.45)' : '#00d4aa', color: '#06090f', fontFamily: 'inherit', fontSize: 15, fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }),
};

export const PLAN_STEP_NAMES = ['Trip basics', 'Your route', 'Must-sees', 'Stays & flights', 'Check your trip'];

export default function PlanShell({
  step, title, subtitle, optional = false, wide = false, summary, onEditSummary, onJump,
  onBack, backLabel = 'Back', status, onNext, nextLabel = 'Continue', nextDisabled = false, footer = true,
  onExit, children,
}) {
  const headingRef = useRef(null);
  // Move focus to the new step's heading (screen readers announce it; keyboard starts there).
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); window.scrollTo?.(0, 0); }, [step]);

  return (
    <div style={s.page}>
      <header style={s.header}>
        <a href="/" style={s.logo}><span style={s.logoMark} aria-hidden="true">W</span>WanderZenAI</a>
        <button type="button" style={s.exit} onClick={onExit}>Save &amp; exit</button>
      </header>

      <main style={s.body(wide)}>
        {summary && (
          <button type="button" style={{ ...s.summary, marginTop: 6 }} onClick={onEditSummary} aria-label={`Your trip: ${summary}. Edit trip basics`}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</span>
            <span style={{ color: '#00d4aa', flexShrink: 0 }}>Edit</span>
          </button>
        )}
        <nav aria-label="Planner steps" style={s.progress}>
          {PLAN_STEP_NAMES.map((name, i) => {
            const state = i < step ? 'done' : i === step ? 'now' : 'todo';
            return (
              <button
                key={name}
                type="button"
                style={s.seg(state)}
                aria-label={`Step ${i + 1}: ${name}${state === 'done' ? ' (done, go back)' : state === 'now' ? ' (current)' : ''}`}
                aria-current={state === 'now' ? 'step' : undefined}
                disabled={state !== 'done'}
                onClick={() => state === 'done' && onJump?.(i)}
              />
            );
          })}
        </nav>
        <div style={s.kicker}>Step {step + 1} of {PLAN_STEP_NAMES.length}{optional ? ' · optional' : ''}</div>
        <h1 ref={headingRef} tabIndex={-1} style={{ ...s.h1, outline: 'none' }}>{title}</h1>
        {subtitle && <p style={s.sub}>{subtitle}</p>}
        {children}
      </main>

      {footer && (
        <div style={s.footer}>
          <div style={s.footerInner(wide)}>
            {onBack ? <button type="button" style={s.back} onClick={onBack}>{backLabel}</button> : <span style={{ width: 60 }} />}
            <div style={s.status} aria-live="polite">{status}</div>
            {onNext && (
              <button type="button" style={s.next(nextDisabled)} onClick={onNext} disabled={nextDisabled} aria-disabled={nextDisabled}>
                {nextLabel}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
