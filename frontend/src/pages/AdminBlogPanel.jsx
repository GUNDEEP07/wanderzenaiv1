import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchPosts, createPost, updatePost, deletePost, fetchPhotos, uploadPhoto, updatePhotoCaption, deletePhoto } from '../api/blog';
import { resizeImage, ACCEPTED_TYPES } from '../utils/resizeImage';

/**
 * Admin → Blog (Nov 8 2026, Gundeep's decision "2B"): only the WanderZen team writes
 * stories, and they go live as soon as they are saved. No user submissions, so the old
 * review queue isn't shown (its backend stays for when submissions open).
 */

export const CATEGORIES = [
  { val: 'tips', label: 'Tips' },
  { val: 'adventure', label: 'Adventure' },
  { val: 'culture', label: 'Culture' },
  { val: 'food', label: 'Food' },
  { val: 'budget', label: 'Budget' },
  { val: 'other', label: 'Other' },
];

export const MAX_PHOTOS = 12; // same limit as the API

const EMPTY = { title: '', description: '', content: '', location: '', country: '', category: 'culture', start: '', end: '' };

/** Same limits as the backend (blog-handler/utils/validation.js), checked before saving. */
export function validateStory(f) {
  const errs = {};
  const len = (v) => (v || '').trim().length;
  if (len(f.title) < 3 || f.title.length > 200) errs.title = 'Title: 3–200 characters';
  if (len(f.description) < 10 || f.description.length > 500) errs.description = 'Summary: 10–500 characters';
  if (len(f.content) < 50 || f.content.length > 50000) errs.content = 'Story: at least 50 characters';
  if (len(f.location) < 2 || f.location.length > 100) errs.location = 'Place: 2–100 characters';
  if (len(f.country) < 2 || f.country.length > 100) errs.country = 'Country: 2–100 characters';
  if (!CATEGORIES.some(c => c.val === f.category)) errs.category = 'Pick a category';
  if ((f.start && !f.end) || (!f.start && f.end)) errs.dates = 'Give both travel dates, or neither';
  else if (f.start && f.end && f.start >= f.end) errs.dates = 'The end date must be after the start date';
  return errs;
}

/** Postgres daterange "[2026-02-01,2026-02-08)" → { start, end }. */
function datesOf(range) {
  const m = typeof range === 'string' && range.match(/(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})/);
  return m ? { start: m[1], end: m[2] } : { start: '', end: '' };
}

const unwrap = (json) => (json && typeof json === 'object' && 'data' in json ? json.data : json);

const s = {
  page: { minHeight: '100vh', background: '#06090f', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#fff' },
  nav: { padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(6,9,15,0.95)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10, flexWrap: 'wrap', gap: 10 },
  logoMark: { width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg,#00d4aa,#00916a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#06090f' },
  badge: { padding: '3px 10px', borderRadius: 20, background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.25)', fontSize: 10, fontWeight: 800, color: '#ff6b6b', textTransform: 'uppercase', letterSpacing: '0.08em' },
  content: { padding: '28px 32px', maxWidth: 960, margin: '0 auto' },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' },
  secTitle: { fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 700, color: '#fff' },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4 },
  success: { padding: '12px 16px', borderRadius: 8, background: 'rgba(0,212,170,0.12)', border: '1px solid rgba(0,212,170,0.25)', color: '#00d4aa', fontSize: 14, marginBottom: 16 },
  error: { padding: '12px 16px', borderRadius: 8, background: 'rgba(255,107,107,0.12)', border: '1px solid rgba(255,107,107,0.25)', color: '#ff6b6b', fontSize: 14, marginBottom: 16 },
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  title: { fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 },
  meta: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  btn: (tone = 'plain') => ({
    padding: '8px 14px', borderRadius: 8, fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer',
    border: `1px solid ${tone === 'primary' ? '#00d4aa' : tone === 'danger' ? 'rgba(255,107,107,0.35)' : 'rgba(255,255,255,0.12)'}`,
    background: tone === 'primary' ? '#00d4aa' : tone === 'danger' ? 'rgba(255,107,107,0.12)' : 'rgba(255,255,255,0.04)',
    color: tone === 'primary' ? '#06090f' : tone === 'danger' ? '#ff6b6b' : 'rgba(255,255,255,0.75)',
  }),
  form: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20, marginBottom: 24 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 },
  label: { display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', margin: '12px 0 6px' },
  input: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)', color: '#fff', fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box' },
  fieldErr: { fontSize: 12, color: '#ff6b6b', marginTop: 4 },
  hint: { fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 },
  photoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 },
  photoCard: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 8 },
  photoImg: { width: '100%', height: 110, objectFit: 'cover', borderRadius: 6, display: 'block', background: 'rgba(0,0,0,0.3)' },
  coverTag: { position: 'absolute', top: 6, left: 6, padding: '2px 8px', borderRadius: 10, background: '#00d4aa', color: '#06090f', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' },
  empty: { color: 'rgba(255,255,255,0.35)', fontSize: 14, padding: 32, textAlign: 'center' },
};

/**
 * Story photos. The first one is the cover (blog list + top of the story); the rest show
 * under the story. Nothing uploads until the story is saved.
 */
function PhotosField({ items, onAdd, onRemove, onCaption, disabled }) {
  const left = MAX_PHOTOS - items.length;
  return (
    <div>
      <label style={s.label}>Photos (optional)</label>
      {items.length > 0 && (
        <div style={s.photoGrid}>
          {items.map((p, i) => (
            <div key={p.key} style={s.photoCard}>
              <div style={{ position: 'relative' }}>
                <img src={p.url} alt={p.caption || `Photo ${i + 1}`} style={s.photoImg} />
                {i === 0 && <span style={s.coverTag}>Cover</span>}
                {p.file && <span style={{ ...s.coverTag, left: 'auto', right: 6, background: 'rgba(6,9,15,0.75)', color: '#fff' }}>New</span>}
              </div>
              <input aria-label={`Caption for photo ${i + 1}`} style={{ ...s.input, fontSize: 12, padding: '6px 8px', marginTop: 6 }} value={p.caption} maxLength={200}
                placeholder="Caption (optional)" onChange={e => onCaption(p.key, e.target.value)} disabled={disabled} />
              <button type="button" style={{ ...s.btn('danger'), marginTop: 6, width: '100%', padding: '6px 8px' }} onClick={() => onRemove(p.key)} disabled={disabled}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
      {left > 0 ? (
        <label style={{ ...s.btn(), display: 'inline-block', marginTop: 10, opacity: disabled ? 0.5 : 1 }}>
          + Add photos
          <input type="file" aria-label="Add photos" accept={ACCEPTED_TYPES.join(',')} multiple style={{ display: 'none' }} disabled={disabled}
            onChange={e => { onAdd([...e.target.files].slice(0, left)); e.target.value = ''; }} />
        </label>
      ) : null}
      <div style={s.hint}>
        The first photo is the cover. JPEG, PNG or WebP, up to {MAX_PHOTOS}. Photos are resized and their location data removed before upload.
      </div>
    </div>
  );
}

function Field({ label, error, hint, children }) {
  return (
    <div>
      <label style={s.label}>{label}</label>
      {children}
      {error ? <div style={s.fieldErr}>{error}</div> : hint ? <div style={s.hint}>{hint}</div> : null}
    </div>
  );
}

export default function AdminBlogPanel() {
  const { currentUser, getIdToken } = useAuth();
  const navigate = useNavigate();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | post id
  const [form, setForm] = useState(EMPTY);
  const [fieldErrs, setFieldErrs] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // post id awaiting "Yes, delete"
  // Photos being edited: saved ones ({ id, url, caption, savedCaption }) and new ones ({ file, url: preview }).
  const [photos, setPhotos] = useState([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState([]);
  const [progress, setProgress] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = currentUser ? await getIdToken() : null;
      const list = unwrap(await fetchPosts({}, token));
      setPosts(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(`Could not load stories: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [currentUser?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const flash = (msg) => { setNotice(msg); setTimeout(() => setNotice(null), 4000); };
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const dropPreviews = (list) => list.forEach(p => p.file && URL.revokeObjectURL?.(p.url));
  const resetPhotos = (list = []) => {
    setPhotos(prev => { dropPreviews(prev); return list; });
    setRemovedPhotoIds([]);
  };
  const loadPhotos = async (postId) => {
    try {
      const token = await getIdToken();
      const saved = await fetchPhotos(postId, token);
      resetPhotos(saved.map(p => ({ key: p.id, id: p.id, url: p.url, caption: p.caption || '', savedCaption: p.caption || '' })));
    } catch (err) {
      setError(`Could not load this story's photos: ${err.message}`);
    }
  };
  const addPhotos = (files) => {
    const bad = files.filter(f => !ACCEPTED_TYPES.includes(f.type));
    if (bad.length) setError(`Skipped ${bad.map(f => f.name).join(', ')}: use JPEG, PNG or WebP (export iPhone HEIC photos as JPEG).`);
    const ok = files.filter(f => ACCEPTED_TYPES.includes(f.type));
    setPhotos(prev => [...prev, ...ok.slice(0, MAX_PHOTOS - prev.length).map((file, i) => ({
      key: `new-${Date.now()}-${i}-${file.name}`, file, url: URL.createObjectURL(file), caption: '',
    }))]);
  };
  const removePhoto = (key) => setPhotos(prev => {
    const p = prev.find(x => x.key === key);
    if (p?.file) URL.revokeObjectURL?.(p.url);
    if (p?.id) setRemovedPhotoIds(ids => [...ids, p.id]);
    return prev.filter(x => x.key !== key);
  });
  const captionPhoto = (key, caption) => setPhotos(prev => prev.map(p => (p.key === key ? { ...p, caption } : p)));

  /**
   * After the story text is saved: delete removed photos, save changed captions, upload new
   * photos in order. Returns the new photos that failed (they stay in the editor to retry).
   */
  const syncPhotos = async (postId, token) => {
    const failed = [];
    for (const id of removedPhotoIds) {
      try { await deletePhoto(postId, id, token); } catch (err) { failed.push({ err }); }
    }
    const newOnes = photos.filter(p => p.file);
    for (const p of photos.filter(x => x.id && x.caption.trim() !== x.savedCaption)) {
      try { await updatePhotoCaption(postId, p.id, p.caption.trim(), token); } catch (err) { failed.push({ err }); }
    }
    for (let i = 0; i < newOnes.length; i++) {
      const p = newOnes[i];
      setProgress(`Uploading photo ${i + 1} of ${newOnes.length}…`);
      try {
        await uploadPhoto(postId, await resizeImage(p.file), p.caption.trim() || null, token);
      } catch (err) {
        failed.push({ item: p, err });
      }
    }
    setProgress(null);
    return failed;
  };

  const startNew = () => { setEditing('new'); setForm(EMPTY); setFieldErrs({}); setError(null); resetPhotos(); };
  const startEdit = (p) => {
    resetPhotos();
    loadPhotos(p.id);
    setEditing(p.id);
    setForm({ title: p.title || '', description: p.description || '', content: p.content || '', location: p.location || '', country: p.country || '', category: p.category || 'other', ...datesOf(p.travel_dates) });
    setFieldErrs({});
    setError(null);
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  };
  const cancel = () => { setEditing(null); setForm(EMPTY); setFieldErrs({}); resetPhotos(); };

  const save = async () => {
    const errs = validateStory(form);
    setFieldErrs(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    setError(null);
    try {
      const token = await getIdToken();
      const payload = {
        title: form.title.trim(), description: form.description.trim(), content: form.content.trim(),
        location: form.location.trim(), country: form.country.trim(), category: form.category,
        ...(form.start && form.end ? { travelDates: { start: form.start, end: form.end } } : {}),
      };
      const saved = unwrap(editing === 'new' ? await createPost(payload, token) : await updatePost(editing, payload, token));
      const postId = editing === 'new' ? saved?.id : editing;
      const failed = postId ? await syncPhotos(postId, token) : [];
      if (failed.length) {
        // The story is saved; keep the editor open on it so the failed photos can be retried.
        setEditing(postId);
        await loadPhotos(postId);
        setPhotos(prev => [...prev, ...failed.filter(f => f.item).map(f => f.item)]);
        await load(); // before the message: load() clears errors
        setError(`The story is saved, but ${failed.length} photo change${failed.length > 1 ? 's' : ''} failed: ${failed[0].err.message}. Press save again to retry.`);
        return saved;
      }
      flash(editing === 'new' ? 'Published — it is live on the blog now.' : 'Saved.');
      setEditing(null);
      setForm(EMPTY);
      resetPhotos();
      await load();
      return saved;
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      const token = await getIdToken();
      await deletePost(id, token);
      setConfirmDelete(null);
      flash('Story deleted.');
      await load();
    } catch (err) {
      setError(`Could not delete: ${err.message}`);
    }
  };

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
          <button type="button" onClick={() => navigate('/admin')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>
            Back to dashboard
          </button>
        </div>
      </nav>

      <div style={s.content}>
        <div style={s.head}>
          <div>
            <div style={s.secTitle}>Blog</div>
            <div style={s.sub}>Stories are written by the WanderZen team and go live when you publish. Comments are closed for now.</div>
          </div>
          {!editing && <button type="button" style={s.btn('primary')} onClick={startNew}>+ New story</button>}
        </div>

        {notice && <div style={s.success} role="status">{notice}</div>}
        {error && <div style={s.error} role="alert">{error}</div>}

        {editing && (
          <div style={s.form}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{editing === 'new' ? 'New story' : 'Edit story'}</div>
            <Field label="Title" error={fieldErrs.title}>
              <input aria-label="Title" style={s.input} value={form.title} maxLength={200} onChange={e => set('title', e.target.value)} placeholder="Lost in Kyoto's hidden tea houses" />
            </Field>
            <Field label="Summary" error={fieldErrs.description} hint="Shown on the blog list (10–500 characters).">
              <textarea aria-label="Summary" style={{ ...s.input, minHeight: 70, resize: 'vertical' }} value={form.description} maxLength={500} onChange={e => set('description', e.target.value)} />
            </Field>
            <div style={s.grid}>
              <Field label="Place" error={fieldErrs.location}>
                <input aria-label="Place" style={s.input} value={form.location} maxLength={100} onChange={e => set('location', e.target.value)} placeholder="Kyoto" />
              </Field>
              <Field label="Country" error={fieldErrs.country}>
                <input aria-label="Country" style={s.input} value={form.country} maxLength={100} onChange={e => set('country', e.target.value)} placeholder="Japan" />
              </Field>
              <Field label="Category" error={fieldErrs.category}>
                <select aria-label="Category" style={s.input} value={form.category} onChange={e => set('category', e.target.value)}>
                  {CATEGORIES.map(c => <option key={c.val} value={c.val}>{c.label}</option>)}
                </select>
              </Field>
            </div>
            <div style={s.grid}>
              <Field label="Travelled from (optional)" error={fieldErrs.dates}>
                <input aria-label="Travelled from" type="date" style={s.input} value={form.start} onChange={e => set('start', e.target.value)} />
              </Field>
              <Field label="Travelled until (optional)">
                <input aria-label="Travelled until" type="date" style={s.input} value={form.end} onChange={e => set('end', e.target.value)} />
              </Field>
            </div>
            <Field label="Story" error={fieldErrs.content} hint="Plain text. Leave an empty line between paragraphs.">
              <textarea aria-label="Story" style={{ ...s.input, minHeight: 260, resize: 'vertical', lineHeight: 1.6 }} value={form.content} maxLength={50000} onChange={e => set('content', e.target.value)} />
            </Field>
            <PhotosField items={photos} onAdd={addPhotos} onRemove={removePhoto} onCaption={captionPhoto} disabled={saving} />
            <div style={{ ...s.actions, marginTop: 16, alignItems: 'center' }}>
              <button type="button" style={s.btn('primary')} onClick={save} disabled={saving}>
                {saving ? 'Saving…' : editing === 'new' ? 'Publish' : 'Save changes'}
              </button>
              <button type="button" style={s.btn()} onClick={cancel} disabled={saving}>Cancel</button>
              {progress && <span style={s.hint} role="status">{progress}</span>}
            </div>
          </div>
        )}

        {loading && <div style={s.empty}>Loading stories…</div>}
        {!loading && posts.length === 0 && <div style={s.empty}>No stories yet — write the first one.</div>}
        {!loading && posts.map(p => (
          <div key={p.id} style={s.card}>
            {p.thumbnail_url && <img src={p.thumbnail_url} alt="" style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 6 }} />}
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={s.title}>{p.title}</div>
              <div style={s.meta}>
                {[p.location, p.country].filter(Boolean).join(', ')} · {CATEGORIES.find(c => c.val === p.category)?.label || p.category}
                {' · '}{new Date(p.published_at || p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
            <div style={s.actions}>
              <button type="button" style={s.btn()} onClick={() => navigate(`/blog/${p.id}`)}>View</button>
              <button type="button" style={s.btn()} onClick={() => startEdit(p)}>Edit</button>
              {confirmDelete === p.id ? (
                <>
                  <button type="button" style={s.btn('danger')} onClick={() => remove(p.id)}>Yes, delete</button>
                  <button type="button" style={s.btn()} onClick={() => setConfirmDelete(null)}>Keep</button>
                </>
              ) : (
                <button type="button" style={s.btn('danger')} onClick={() => setConfirmDelete(p.id)}>Delete</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
