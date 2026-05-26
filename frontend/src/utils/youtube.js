// YouTube API key - injected at build time via Vite
const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY || '';

export async function fetchTrendingVideos(activity, destination, countryCode, maxResults = 8) {
  if (!YOUTUBE_API_KEY) {
    console.warn('YouTube API key not configured');
    return [];
  }

  try {
    const queries = [
      `#${activity.toLowerCase()}in${destination.toLowerCase()}`,
      `#${destination.toLowerCase()}2024`,
      `#${activity.toLowerCase()}`,
    ];
    const searchQuery = queries.join(' ');

    const params = new URLSearchParams({
      part: 'snippet',
      q: searchQuery,
      type: 'video',
      maxResults: maxResults.toString(),
      order: 'viewCount',
      regionCode: countryCode,
      relevanceLanguage: 'en',
      key: YOUTUBE_API_KEY,
    });

    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    if (!response.ok) throw new Error(`YouTube API error: ${response.status}`);

    const data = await response.json();
    if (!data.items) return [];

    return data.items.map(item => ({
      id: item.id.videoId,
      title: item.snippet.title,
      creator: item.snippet.channelTitle,
      thumbnailUrl: item.snippet.thumbnails.default.url,
      description: item.snippet.description,
    }));
  } catch (error) {
    console.error('Failed to fetch YouTube videos:', error);
    return [];
  }
}

export function getYouTubeUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function formatViewCount(views) {
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M views`;
  }
  if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}K views`;
  }
  return `${views} views`;
}
