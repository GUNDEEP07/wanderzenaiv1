/**
 * Photo search for a blog story without its own cover. "Ninh Binh & Hoi An, Vietnam" finds
 * nothing on Unsplash (and the generic stock fallback — a desert road — showed instead), so
 * search the first place plus the country: "Ninh Binh Vietnam".
 * Returns { destination, keyword } for CreditedPhoto (destination picks the stock fallback).
 */
export function blogPhotoQuery(post = {}) {
  const country = post.country && !/^multiple$/i.test(post.country) ? String(post.country).trim() : '';
  const firstPlace = String(post.location || '').split(/\s*(?:&|,|\/|\band\b|·)\s*/i)[0].trim();
  const keyword = [firstPlace, country].filter(Boolean).join(' ') || String(post.title || '').split(/[:—-]/)[0].trim();
  return { destination: country || firstPlace, keyword };
}
