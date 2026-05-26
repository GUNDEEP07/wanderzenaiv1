import React from 'react';
import { getCountryFlag } from '../../../utils/countryFlags';

const s = {
  section: {
    marginBottom: '20px',
  },
  header: {
    fontSize: '10px',
    color: '#ffd93d',
    fontWeight: '800',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  carousel: (isMobile) => ({
    display: 'flex',
    gap: '10px',
    overflowX: 'auto',
    scrollBehavior: 'smooth',
    marginBottom: '16px',
    paddingBottom: '8px',
    scrollSnapType: 'x mandatory',
  }),
  cardContainer: (isMobile) => ({
    flex: isMobile ? '0 0 calc(100% - 4px)' : '0 0 calc(33% - 10px)',
    scrollSnapAlign: 'start',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    overflow: 'hidden',
  }),
  thumbnail: {
    width: '100%',
    height: '120px',
    objectFit: 'cover',
    background: 'linear-gradient(135deg, #1a1f2e 0%, #0f1419 100%)',
  },
  content: {
    padding: '12px',
  },
  title: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '4px',
    lineHeight: '1.3',
  },
  metadata: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: '8px',
  },
  tags: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap',
    marginBottom: '8px',
  },
  tag: {
    fontSize: '9px',
    background: 'rgba(0,212,170,0.15)',
    color: '#00d4aa',
    padding: '3px 8px',
    borderRadius: '12px',
  },
  link: {
    color: '#00d4aa',
    textDecoration: 'none',
    fontSize: '11px',
    fontWeight: '600',
  },
  swipeHint: {
    textAlign: 'center',
    fontSize: '10px',
    color: 'rgba(255,255,255,0.3)',
    marginBottom: '16px',
  },
  loading: {
    textAlign: 'center',
    padding: '20px',
    color: 'rgba(255,255,255,0.5)',
  },
  empty: {
    textAlign: 'center',
    padding: '20px',
    color: 'rgba(255,255,255,0.4)',
    fontSize: '14px',
  },
};

export function YouTubeCarousel({ activity, destination, countryCode, videos, loading, isMobile }) {
  const flag = getCountryFlag(countryCode);

  if (loading) {
    return (
      <div style={s.section}>
        <div style={s.header}>
          <span>🔥</span> Trending in {flag} {destination}
        </div>
        <div style={s.loading}>Loading videos...</div>
      </div>
    );
  }

  if (!videos || videos.length === 0) {
    return (
      <div style={s.section}>
        <div style={s.header}>
          <span>🔥</span> Trending in {flag} {destination}
        </div>
        <div style={s.empty}>No trending videos found for {activity}</div>
      </div>
    );
  }

  return (
    <div style={s.section}>
      <div style={s.header}>
        <span>🔥</span> Trending in <span style={{ fontSize: '18px' }}>{flag}</span> {destination}
      </div>

      <div style={s.carousel(isMobile)}>
        {videos.map(video => (
          <div key={video.id} style={s.cardContainer(isMobile)}>
            {video.thumbnailUrl && (
              <img
                src={video.thumbnailUrl}
                alt={video.title}
                style={s.thumbnail}
              />
            )}
            <div style={s.content}>
              <div style={s.title}>{video.title}</div>
              <div style={s.metadata}>{video.creator}</div>
              <div style={s.tags}>
                <span style={s.tag}>#trending</span>
                <span style={s.tag}>{activity.toLowerCase()}</span>
              </div>
              <a
                href={`https://www.youtube.com/watch?v=${video.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={s.link}
              >
                Watch video →
              </a>
            </div>
          </div>
        ))}
      </div>

      {isMobile && (
        <div style={s.swipeHint}>← Swipe for more →</div>
      )}
    </div>
  );
}
