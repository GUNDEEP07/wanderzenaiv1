import { useNavigate } from 'react-router-dom';

/**
 * BlogPostCard - Displays a blog post in card format
 * Props:
 *   - post: { id, user_id, title, description, location, country, category, published_at, created_at, thumbnail_url? }
 *   - currentUserId: UUID of logged-in user (for edit/delete visibility)
 *   - onEdit: callback when edit button clicked
 *   - onDelete: callback when delete button clicked
 */
export function BlogPostCard({ post, currentUserId, onEdit, onDelete }) {
  const navigate = useNavigate();

  // Display a fallback date if published_at is unavailable
  const displayDate = post.published_at || post.created_at;
  const dateObj = new Date(displayDate);
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const isOwnPost = currentUserId && post.user_id === currentUserId;

  const handleCardClick = (e) => {
    // Don't navigate if clicking buttons
    if (e.target.closest('button')) return;
    navigate(`/blog/${post.id}`);
  };

  return (
    <div
      onClick={handleCardClick}
      style={{
        background: 'linear-gradient(135deg, rgba(0,212,170,0.05), rgba(0,168,126,0.05))',
        border: '1px solid rgba(0,212,170,0.15)',
        borderRadius: '12px',
        padding: '16px',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        ':hover': {
          borderColor: 'rgba(0,212,170,0.3)',
          background: 'linear-gradient(135deg, rgba(0,212,170,0.1), rgba(0,168,126,0.1))',
        },
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(0,212,170,0.3)';
        e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0,212,170,0.1), rgba(0,168,126,0.1))';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(0,212,170,0.15)';
        e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0,212,170,0.05), rgba(0,168,126,0.05))';
      }}
    >
      {/* Thumbnail */}
      {post.thumbnail_url && (
        <div
          style={{
            width: '100%',
            height: '200px',
            marginBottom: '12px',
            borderRadius: '8px',
            overflow: 'hidden',
            background: 'rgba(0,0,0,0.2)',
          }}
        >
          <img
            src={post.thumbnail_url}
            alt={post.title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        </div>
      )}

      {/* Header with category and action buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
          {/* Category badge */}
          <span
            style={{
              background: 'rgba(0,212,170,0.2)',
              color: '#00d4aa',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: '600',
              textTransform: 'capitalize',
            }}
          >
            {post.category}
          </span>

          {/* Location/Country */}
          <span
            style={{
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.7)',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: '500',
            }}
          >
            {post.country}
          </span>
        </div>

        {/* Edit/Delete buttons */}
        {isOwnPost && (
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(post.id);
              }}
              style={{
                background: 'rgba(0,212,170,0.2)',
                border: '1px solid rgba(0,212,170,0.4)',
                color: '#00d4aa',
                padding: '6px 12px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0,212,170,0.3)';
                e.currentTarget.style.borderColor = 'rgba(0,212,170,0.6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0,212,170,0.2)';
                e.currentTarget.style.borderColor = 'rgba(0,212,170,0.4)';
              }}
            >
              Edit
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(post.id);
              }}
              style={{
                background: 'rgba(255,69,69,0.2)',
                border: '1px solid rgba(255,69,69,0.4)',
                color: '#ff4545',
                padding: '6px 12px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,69,69,0.3)';
                e.currentTarget.style.borderColor = 'rgba(255,69,69,0.6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,69,69,0.2)';
                e.currentTarget.style.borderColor = 'rgba(255,69,69,0.4)';
              }}
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Title */}
      <h3
        style={{
          fontSize: '18px',
          fontWeight: '700',
          color: '#ffffff',
          margin: '0 0 8px 0',
          lineHeight: '1.4',
          textDecoration: 'none',
        }}
      >
        {post.title}
      </h3>

      {/* Description */}
      <p
        style={{
          fontSize: '14px',
          color: 'rgba(255,255,255,0.7)',
          margin: '0 0 12px 0',
          lineHeight: '1.5',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {post.description}
      </p>

      {/* Footer with location and date */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px' }}>
        <span
          style={{
            fontSize: '13px',
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          {post.location}
        </span>
        <span
          style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.4)',
          }}
        >
          {formattedDate}
        </span>
      </div>
    </div>
  );
}
