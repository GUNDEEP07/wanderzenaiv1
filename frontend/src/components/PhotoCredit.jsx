import { useDestinationPhotoWithCredit, getFallbackPhoto } from '../utils/destinationPhotos';

/**
 * "Photo: <photographer> / Unsplash" — required by the Unsplash API Guidelines wherever a
 * photo from the API is shown. Links carry utm_source/utm_medium (added by the backend).
 * Sits in a corner of the nearest position:relative parent. Renders nothing for stock
 * photos (credit null).
 */
export function PhotoCredit({ credit, corner = 'top-right' }) {
  if (!credit) return null;
  const [v, h] = corner.split('-');
  const link = { color: 'inherit', textDecoration: 'underline' };
  const stop = (e) => e.stopPropagation(); // cards are clickable; the credit links are not part of that
  return (
    <span
      style={{
        position: 'absolute', [v]: 4, [h]: 4, zIndex: 2,
        maxWidth: 'calc(100% - 8px)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        padding: '1px 6px', borderRadius: 4, fontSize: 9, lineHeight: '14px',
        background: 'rgba(0,0,0,0.45)', color: 'rgba(255,255,255,0.85)',
      }}
    >
      Photo:{' '}
      <a href={credit.photographerUrl || credit.unsplashUrl} target="_blank" rel="noopener noreferrer" onClick={stop} style={link}>
        {credit.photographer}
      </a>
      {' / '}
      <a href={credit.unsplashUrl} target="_blank" rel="noopener noreferrer" onClick={stop} style={link}>
        Unsplash
      </a>
    </span>
  );
}

/**
 * An Unsplash-backed photo with its credit. `style` sizes the frame (as it sized the
 * <img> before); the image fills it.
 */
export function CreditedPhoto({ destination = '', keyword = '', size = 'card', alt = '', style, loading = 'lazy', corner }) {
  const { src, credit } = useDestinationPhotoWithCredit(destination, keyword, size);
  return (
    <span style={{ position: 'relative', display: 'block', overflow: 'hidden', ...style }}>
      <img
        src={src}
        alt={alt || credit?.alt || keyword || destination}
        loading={loading}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        onError={e => { e.target.src = getFallbackPhoto(size); }}
      />
      <PhotoCredit credit={credit} corner={corner} />
    </span>
  );
}
