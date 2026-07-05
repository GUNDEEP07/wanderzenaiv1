import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchPendingPosts, approvePost, rejectPost } from '../api/blog';

export default function AdminBlogPanel() {
  const { currentUser, getIdToken } = useAuth();
  const navigate = useNavigate();

  const [pendingPosts, setPendingPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [itemsPerPage] = useState(10);

  // Rejection modal state
  const [rejectionModal, setRejectionModal] = useState({ show: false, postId: null, notes: '' });
  const [rejectLoading, setRejectLoading] = useState(false);

  // Load pending posts
  const loadPendingPosts = async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      setError(null);
      const token = await getIdToken();
      const data = await fetchPendingPosts(page, token);
      setPendingPosts(data.posts || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(`Failed to load pending posts: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingPosts();
  }, [currentUser, page]);

  const handleApprove = async (postId) => {
    if (!currentUser) return;
    try {
      const token = await getIdToken();
      await approvePost(postId, token);
      setSuccessMessage('Post approved successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      loadPendingPosts();
    } catch (err) {
      setError(`Failed to approve post: ${err.message}`);
    }
  };

  const handleRejectClick = (postId) => {
    setRejectionModal({ show: true, postId, notes: '' });
  };

  const handleRejectConfirm = async () => {
    if (rejectionModal.notes.length < 10 || rejectionModal.notes.length > 1000) {
      setError('Rejection notes must be between 10 and 1000 characters');
      return;
    }
    if (!currentUser) return;
    try {
      setRejectLoading(true);
      setError(null);
      const token = await getIdToken();
      await rejectPost(rejectionModal.postId, rejectionModal.notes, token);
      setSuccessMessage('Post rejected successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      setRejectionModal({ show: false, postId: null, notes: '' });
      loadPendingPosts();
    } catch (err) {
      setError(`Failed to reject post: ${err.message}`);
    } finally {
      setRejectLoading(false);
    }
  };

  const handleRejectCancel = () => {
    setRejectionModal({ show: false, postId: null, notes: '' });
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= Math.ceil(total / itemsPerPage)) {
      setPage(newPage);
    }
  };

  const s = {
    page: { minHeight: '100vh', background: '#06090f', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#fff' },
    nav: { padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(6,9,15,0.95)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10 },
    logoMark: { width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg,#00d4aa,#00916a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#06090f' },
    badge: { padding: '3px 10px', borderRadius: 20, background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.25)', fontSize: 10, fontWeight: 800, color: '#ff6b6b', textTransform: 'uppercase', letterSpacing: '0.08em' },
    content: { padding: '28px 32px', maxWidth: 1200, margin: '0 auto' },
    secTitle: { fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 20 },
    message: {
      success: { padding: '12px 16px', borderRadius: 8, background: 'rgba(0,212,170,0.12)', border: '1px solid rgba(0,212,170,0.25)', color: '#00d4aa', fontSize: 14, marginBottom: 16 },
      error: { padding: '12px 16px', borderRadius: 8, background: 'rgba(255,107,107,0.12)', border: '1px solid rgba(255,107,107,0.25)', color: '#ff6b6b', fontSize: 14, marginBottom: 16 },
    },
    postCard: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    postInfo: { flex: 1 },
    postTitle: { fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 6 },
    postMeta: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 4 },
    postActions: { display: 'flex', gap: 10, marginLeft: 16 },
    button: (variant) => {
      const baseStyle = { padding: '8px 14px', borderRadius: 8, border: 'none', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' };
      if (variant === 'approve') {
        return { ...baseStyle, background: 'rgba(0,212,170,0.12)', color: '#00d4aa', border: '1px solid rgba(0,212,170,0.25)' };
      } else if (variant === 'reject') {
        return { ...baseStyle, background: 'rgba(255,107,107,0.12)', color: '#ff6b6b', border: '1px solid rgba(255,107,107,0.25)' };
      }
      return baseStyle;
    },
    empty: { color: 'rgba(255,255,255,0.25)', fontSize: 14, fontStyle: 'italic', padding: '32px', textAlign: 'center' },
    loader: { color: 'rgba(255,255,255,0.35)', fontSize: 14, padding: '32px', textAlign: 'center' },
    pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 24 },
    paginationBtn: (active) => ({ padding: '6px 10px', borderRadius: 6, border: `1px solid ${active ? 'rgba(0,212,170,0.4)' : 'rgba(255,255,255,0.1)'}`, background: active ? 'rgba(0,212,170,0.12)' : 'transparent', color: active ? '#00d4aa' : 'rgba(255,255,255,0.5)', fontFamily: 'inherit', fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer' }),
    // Modal styles
    modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
    modal: { background: '#06090f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 24, maxWidth: 500, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' },
    modalTitle: { fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 16 },
    modalLabel: { fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 8 },
    textarea: { width: '100%', padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)', color: '#fff', fontFamily: 'inherit', fontSize: 12, marginBottom: 12, boxSizing: 'border-box', minHeight: 100, resize: 'vertical' },
    charCount: { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 16, textAlign: 'right' },
    modalActions: { display: 'flex', gap: 12 },
    modalBtn: (variant) => {
      const baseStyle = { flex: 1, padding: '10px 16px', borderRadius: 8, border: 'none', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' };
      if (variant === 'cancel') {
        return { ...baseStyle, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' };
      } else if (variant === 'reject') {
        return { ...baseStyle, background: 'rgba(255,107,107,0.12)', color: '#ff6b6b', border: '1px solid rgba(255,107,107,0.25)' };
      }
      return baseStyle;
    },
  };

  const totalPages = Math.ceil(total / itemsPerPage);

  return (
    <div style={s.page}>
      {/* Navigation */}
      <nav style={s.nav}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={s.logoMark}>W</div>
          <span style={{ fontSize: 14, fontWeight: 700 }}>WanderZenAI</span>
          <span style={s.badge}>Admin</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{currentUser?.email}</span>
          <button
            type="button"
            onClick={() => navigate('/admin')}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}
          >
            Back to dashboard
          </button>
        </div>
      </nav>

      {/* Main content */}
      <div style={s.content}>
        <div style={s.secTitle}>Blog Moderation</div>

        {/* Success message */}
        {successMessage && <div style={s.message.success}>{successMessage}</div>}

        {/* Error message */}
        {error && <div style={s.message.error}>{error}</div>}

        {/* Loading state */}
        {loading && <div style={s.loader}>Loading pending posts…</div>}

        {/* Empty state */}
        {!loading && pendingPosts.length === 0 && (
          <div style={s.empty}>No pending posts for review</div>
        )}

        {/* Posts list */}
        {!loading && pendingPosts.length > 0 && (
          <div>
            {pendingPosts.map((post) => (
              <div key={post.id} style={s.postCard}>
                <div style={s.postInfo}>
                  <div style={s.postTitle}>{post.title}</div>
                  <div style={s.postMeta}>By: {post.author_email}</div>
                  <div style={s.postMeta}>Submitted: {new Date(post.created_at).toLocaleDateString('en-GB')}</div>
                  {post.description && (
                    <div style={{ ...s.postMeta, marginTop: 8, color: 'rgba(255,255,255,0.55)' }}>
                      {post.description.length > 100 ? post.description.substring(0, 100) + '...' : post.description}
                    </div>
                  )}
                </div>
                <div style={s.postActions}>
                  <button
                    type="button"
                    onClick={() => handleApprove(post.id)}
                    style={s.button('approve')}
                  >
                    ✓ Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRejectClick(post.id)}
                    style={s.button('reject')}
                  >
                    ✕ Reject
                  </button>
                </div>
              </div>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={s.pagination}>
                <button
                  type="button"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  style={{ ...s.paginationBtn(false), opacity: page === 1 ? 0.5 : 1 }}
                >
                  ← Prev
                </button>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                  Page {page} of {totalPages}
                </div>
                <button
                  type="button"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  style={{ ...s.paginationBtn(false), opacity: page === totalPages ? 0.5 : 1 }}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      {rejectionModal.show && (
        <div style={s.modalOverlay}>
          <div style={s.modal}>
            <div style={s.modalTitle}>Reject Post</div>
            <div style={s.modalLabel}>Rejection Notes (10-1000 characters)</div>
            <textarea
              value={rejectionModal.notes}
              onChange={(e) => setRejectionModal({ ...rejectionModal, notes: e.target.value })}
              placeholder="Explain why this post is being rejected..."
              style={s.textarea}
            />
            <div style={s.charCount}>
              {rejectionModal.notes.length} / 1000 characters
            </div>
            <div style={s.modalActions}>
              <button
                type="button"
                onClick={handleRejectCancel}
                style={s.modalBtn('cancel')}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectConfirm}
                disabled={rejectLoading || rejectionModal.notes.length < 10 || rejectionModal.notes.length > 1000}
                style={{
                  ...s.modalBtn('reject'),
                  opacity: rejectLoading || rejectionModal.notes.length < 10 || rejectionModal.notes.length > 1000 ? 0.5 : 1,
                  cursor: rejectLoading || rejectionModal.notes.length < 10 || rejectionModal.notes.length > 1000 ? 'not-allowed' : 'pointer',
                }}
              >
                {rejectLoading ? 'Rejecting…' : 'Reject Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
