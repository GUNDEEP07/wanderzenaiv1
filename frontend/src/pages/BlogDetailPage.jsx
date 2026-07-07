import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchPost, fetchComments, createComment, updateComment, deleteComment } from '../api/blog';
import { BlogCommentThread } from '../components/blog/BlogCommentThread';

export default function BlogDetailPage() {
  const { postId } = useParams();
  const { currentUser, getIdToken } = useAuth();
  const navigate = useNavigate();

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadPost = async () => {
    if (!postId) {
      setError('Post ID not found');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const token = currentUser ? await getIdToken() : null;
      const response = await fetchPost(postId, currentUser?.uid, token);
      // API returns { success: true, data: {...} }
      const postData = response.data || response;
      setPost(postData);
      // Comments are fetched separately
      if (postData.id) {
        try {
          const commentsData = await fetchComments(postData.id, token);
          setComments(commentsData || []);
        } catch (err) {
          console.warn('Failed to load comments:', err.message);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPost();
  }, [postId, currentUser]);

  const handleCommentAdded = async (content) => {
    if (!currentUser || !postId) return;
    try {
      const token = await getIdToken();
      const newComment = await createComment(postId, content, token);
      setComments([...comments, newComment]);
    } catch (err) {
      alert(`Failed to add comment: ${err.message}`);
    }
  };

  const handleCommentEdit = async (commentId, content) => {
    if (!currentUser) return;
    try {
      const token = await getIdToken();
      const updated = await updateComment(commentId, content, token);
      setComments(comments.map(c => c.id === commentId ? updated : c));
    } catch (err) {
      alert(`Failed to edit comment: ${err.message}`);
    }
  };

  const handleCommentDelete = async (commentId) => {
    if (!currentUser) return;
    try {
      const token = await getIdToken();
      await deleteComment(commentId, token);
      setComments(comments.filter(c => c.id !== commentId));
    } catch (err) {
      alert(`Failed to delete comment: ${err.message}`);
    }
  };

  const s = {
    page: {
      minHeight: '100vh',
      background: '#06090f',
      color: '#fff',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    },
    header: {
      padding: '16px 32px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(6,9,15,0.95)',
      backdropFilter: 'blur(20px)',
      position: 'sticky',
      top: 0,
      zIndex: 10,
    },
    backBtn: {
      background: 'none',
      border: 'none',
      color: 'rgba(255,255,255,0.5)',
      cursor: 'pointer',
      fontFamily: 'inherit',
      fontSize: 13,
      fontWeight: 600,
    },
    content: {
      maxWidth: 900,
      margin: '0 auto',
      padding: '32px 32px',
    },
    loader: {
      textAlign: 'center',
      padding: '48px 24px',
      color: 'rgba(255,255,255,0.4)',
      fontSize: 14,
    },
    error: {
      padding: '12px 16px',
      borderRadius: 8,
      background: 'rgba(255,107,107,0.12)',
      border: '1px solid rgba(255,107,107,0.25)',
      color: '#ff6b6b',
      fontSize: 14,
      marginBottom: 16,
    },
    postHeader: {
      marginBottom: 32,
      paddingBottom: 24,
      borderBottom: '1px solid rgba(255,255,255,0.08)',
    },
    postMeta: {
      display: 'flex',
      gap: 12,
      marginBottom: 12,
      fontSize: 12,
      color: 'rgba(255,255,255,0.5)',
      flexWrap: 'wrap',
      alignItems: 'center',
    },
    badge: {
      display: 'inline-block',
      background: 'rgba(0,212,170,0.15)',
      color: '#00d4aa',
      padding: '3px 10px',
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
      textTransform: 'capitalize',
    },
    title: {
      fontFamily: "'Fraunces', serif",
      fontSize: 36,
      fontWeight: 700,
      marginBottom: 12,
      lineHeight: 1.2,
    },
    description: {
      fontSize: 16,
      color: 'rgba(255,255,255,0.7)',
      lineHeight: 1.6,
    },
    thumbnail: {
      width: '100%',
      height: 400,
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 32,
      background: 'rgba(0,0,0,0.3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    content_body: {
      fontSize: 15,
      lineHeight: 1.7,
      color: 'rgba(255,255,255,0.8)',
      marginBottom: 48,
      whiteSpace: 'pre-wrap',
      wordWrap: 'break-word',
    },
    commentsSection: {
      paddingTop: 24,
      borderTop: '1px solid rgba(255,255,255,0.08)',
    },
    commentTitle: {
      fontSize: 18,
      fontWeight: 700,
      marginBottom: 20,
    },
  };

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <button onClick={() => navigate('/blog')} style={s.backBtn}>
          ← Back to stories
        </button>
      </div>

      {/* Content */}
      <div style={s.content}>
        {/* Error state */}
        {error && <div style={s.error}>⚠️ {error}</div>}

        {/* Loading state */}
        {loading && <div style={s.loader}>Loading story…</div>}

        {/* Post content */}
        {!loading && post && (
          <>
            {/* Post header */}
            <div style={s.postHeader}>
              <div style={s.postMeta}>
                <span style={s.badge}>{post.category}</span>
                <span>{post.country}</span>
                {post.location && <span>·</span>}
                {post.location && <span>{post.location}</span>}
                <span>·</span>
                <span>{new Date(post.published_at || post.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                <span>·</span>
                <span style={{ color: 'rgba(255,255,255,0.35)' }}>by {post.author_email}</span>
              </div>
              <h1 style={s.title}>{post.title}</h1>
              {post.description && <p style={s.description}>{post.description}</p>}
            </div>

            {/* Thumbnail */}
            {post.thumbnail_url && (
              <div style={s.thumbnail}>
                <img
                  src={post.thumbnail_url}
                  alt={post.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            )}

            {/* Post content */}
            {post.content && <div style={s.content_body}>{post.content}</div>}

            {/* Comments section */}
            {currentUser && (
              <div style={s.commentsSection}>
                <h2 style={s.commentTitle}>Comments</h2>
                <BlogCommentThread
                  comments={comments}
                  postId={postId}
                  currentUserId={currentUser.uid}
                  onCommentAdded={handleCommentAdded}
                  onCommentEdit={handleCommentEdit}
                  onCommentDelete={handleCommentDelete}
                />
              </div>
            )}

            {!currentUser && (
              <div style={{ ...s.commentsSection, paddingTop: 32 }}>
                <div style={{
                  padding: '16px',
                  borderRadius: 8,
                  background: 'rgba(0,212,170,0.08)',
                  border: '1px solid rgba(0,212,170,0.2)',
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: 14,
                  textAlign: 'center',
                }}>
                  Sign in to view and post comments
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
