import { useState } from 'react';

/**
 * BlogCommentThread - Displays comments for a blog post with edit/delete functionality
 * Props:
 *   - comments: Array of comment objects { id, user_id, user_email, content, created_at, updated_at }
 *   - postId: ID of the blog post
 *   - currentUserId: UUID of logged-in user
 *   - onCommentAdded: Callback when a new comment is posted
 *   - onCommentEdit: Callback when a comment is edited
 *   - onCommentDelete: Callback when a comment is deleted
 */
export function BlogCommentThread({
  comments = [],
  postId,
  currentUserId,
  onCommentAdded,
  onCommentEdit,
  onCommentDelete,
}) {
  const [newComment, setNewComment] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      await onCommentAdded(newComment);
      setNewComment('');
    } catch (error) {
      console.error('Failed to add comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (comment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const handleSaveEdit = async (commentId) => {
    if (!editContent.trim()) return;

    setSubmitting(true);
    try {
      await onCommentEdit(commentId, editContent);
      setEditingId(null);
      setEditContent('');
    } catch (error) {
      console.error('Failed to edit comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;

    setSubmitting(true);
    try {
      await onCommentDelete(commentId);
    } catch (error) {
      console.error('Failed to delete comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (date) => {
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div style={{ maxWidth: '100%' }}>
      {/* Comment input section */}
      {currentUserId && (
        <div
          style={{
            background: 'rgba(0,212,170,0.05)',
            border: '1px solid rgba(0,212,170,0.15)',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px',
          }}
        >
          <label style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', display: 'block', marginBottom: '8px' }}>
            Add a comment
          </label>
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Share your thoughts about this post..."
            disabled={submitting}
            style={{
              width: '100%',
              minHeight: '100px',
              padding: '12px',
              background: 'rgba(0,0,0,0.2)',
              border: '1px solid rgba(0,212,170,0.2)',
              borderRadius: '6px',
              color: '#ffffff',
              fontSize: '14px',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              resize: 'vertical',
              marginBottom: '12px',
              transition: 'all 0.2s ease',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(0,212,170,0.4)';
              e.currentTarget.style.background = 'rgba(0,0,0,0.3)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(0,212,170,0.2)';
              e.currentTarget.style.background = 'rgba(0,0,0,0.2)';
            }}
          />
          <button
            onClick={handleAddComment}
            disabled={submitting || !newComment.trim()}
            style={{
              background: 'linear-gradient(135deg, #00d4aa, #00a87e)',
              border: 'none',
              color: '#06090f',
              padding: '10px 20px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: submitting || !newComment.trim() ? 'not-allowed' : 'pointer',
              opacity: submitting || !newComment.trim() ? 0.6 : 1,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (!submitting && newComment.trim()) {
                e.currentTarget.style.opacity = '0.9';
                e.currentTarget.style.transform = 'scale(1.02)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            {submitting ? 'Posting...' : 'Post Comment'}
          </button>
        </div>
      )}

      {/* Comments list */}
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#ffffff', margin: '0 0 16px 0' }}>
          Comments ({comments.length})
        </h3>

        {comments.length === 0 ? (
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px',
              padding: '24px',
              textAlign: 'center',
              color: 'rgba(255,255,255,0.5)',
              fontSize: '14px',
            }}
          >
            No comments yet. Be the first to share your thoughts!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {comments.map((comment) => {
              const isOwn = currentUserId && comment.user_id === currentUserId;
              const isEditing = editingId === comment.id;

              return (
                <div
                  key={comment.id}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    padding: '12px',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  }}
                >
                  {/* Comment header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '8px' }}>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#00d4aa' }}>
                        {comment.user_email}
                      </span>
                      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginLeft: '8px' }}>
                        {formatDate(comment.created_at)}
                        {comment.updated_at && comment.updated_at !== comment.created_at && ' (edited)'}
                      </span>
                    </div>

                    {/* Edit/Delete buttons */}
                    {isOwn && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {!isEditing && (
                          <>
                            <button
                              onClick={() => handleStartEdit(comment)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'rgba(0,212,170,0.7)',
                                fontSize: '12px',
                                cursor: 'pointer',
                                fontWeight: '600',
                                padding: '4px 8px',
                                transition: 'all 0.2s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = '#00d4aa';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = 'rgba(0,212,170,0.7)';
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'rgba(255,69,69,0.7)',
                                fontSize: '12px',
                                cursor: 'pointer',
                                fontWeight: '600',
                                padding: '4px 8px',
                                transition: 'all 0.2s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = '#ff4545';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = 'rgba(255,69,69,0.7)';
                              }}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Comment content */}
                  {isEditing ? (
                    <div>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        disabled={submitting}
                        style={{
                          width: '100%',
                          minHeight: '80px',
                          padding: '10px',
                          background: 'rgba(0,0,0,0.2)',
                          border: '1px solid rgba(0,212,170,0.3)',
                          borderRadius: '6px',
                          color: '#ffffff',
                          fontSize: '13px',
                          fontFamily: "'Plus Jakarta Sans', sans-serif",
                          resize: 'vertical',
                          marginBottom: '8px',
                        }}
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleSaveEdit(comment.id)}
                          disabled={submitting}
                          style={{
                            background: 'linear-gradient(135deg, #00d4aa, #00a87e)',
                            border: 'none',
                            color: '#06090f',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: submitting ? 'not-allowed' : 'pointer',
                            opacity: submitting ? 0.6 : 1,
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          disabled={submitting}
                          style={{
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: '#ffffff',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: submitting ? 'not-allowed' : 'pointer',
                            opacity: submitting ? 0.6 : 1,
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p
                      style={{
                        fontSize: '13px',
                        color: 'rgba(255,255,255,0.8)',
                        margin: '0',
                        lineHeight: '1.6',
                      }}
                    >
                      {comment.content}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
