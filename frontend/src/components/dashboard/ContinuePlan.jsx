import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPlanDraft, deletePlanDraft } from '../../api/itinerary';
import { timeAgo } from '../../utils/tripStats';

/** Same names as PlanTrip's STEPS (index = saved step). */
const STEP_NAMES = ['Destination', 'Dates', 'Your route', 'Trip overview', 'Experiences', 'Review'];

/** "Peru · 10 days" from a saved plan form. */
export function draftTitle(form) {
  const dest = (form?.destinations || []).map(d => d?.name).filter(Boolean).join(', ');
  const days = Number(form?.days) || 0;
  return [dest || 'Your trip', days ? `${days} day${days === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ');
}

const s = {
  card: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,212,170,0.25)', borderRadius: 16, padding: '18px 22px', marginBottom: 24 },
  eyebrow: { fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#00d4aa', marginBottom: 4 },
  title: { fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 700, color: '#fff' },
  meta: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  primary: { padding: '12px 22px', background: 'linear-gradient(135deg,#00d4aa,#00a87e)', border: 'none', borderRadius: 12, color: '#06090f', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, cursor: 'pointer' },
  ghost: { padding: '12px 16px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' },
};

/**
 * Dashboard card for a trip planned but not yet submitted (saved by the planner to
 * /profile/draft). Continue → back into /plan at the saved step, on any device.
 */
export default function ContinuePlan() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    let live = true;
    fetchPlanDraft().then(d => { if (live && d?.form?.destinations?.length) setDraft(d); });
    return () => { live = false; };
  }, []);

  if (!draft) return null;
  const step = Math.min(Math.max(Number(draft.step) || 0, 0), STEP_NAMES.length - 1);

  const resume = () => {
    try {
      sessionStorage.setItem('wz_plan_form_v2', JSON.stringify(draft.form));
      sessionStorage.setItem('wz_plan_step_v2', String(step));
    } catch { /* storage blocked: the planner still opens */ }
    navigate('/plan');
  };
  const discard = () => { setDraft(null); deletePlanDraft(); };

  return (
    <div style={s.card} data-testid="continue-plan">
      <div>
        <div style={s.eyebrow}>Continue planning</div>
        <div style={s.title}>{draftTitle(draft.form)}</div>
        <div style={s.meta}>
          Step {step + 1} of {STEP_NAMES.length}: {STEP_NAMES[step]}{draft.updatedAt ? ` · saved ${timeAgo(draft.updatedAt)}` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button type="button" style={s.ghost} onClick={discard}>Discard</button>
        <button type="button" style={s.primary} onClick={resume}>Continue →</button>
      </div>
    </div>
  );
}
