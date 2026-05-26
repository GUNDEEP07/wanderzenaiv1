import { getYouTubeUrl, formatViewCount } from './youtube.js';

describe('YouTube utilities', () => {
  test('getYouTubeUrl returns correct YouTube URL', () => {
    const url = getYouTubeUrl('dQw4w9WgXcQ');
    expect(url).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  test('formatViewCount formats view counts correctly', () => {
    expect(formatViewCount(1500000)).toBe('1.5M views');
    expect(formatViewCount(245000)).toBe('245.0K views');
    expect(formatViewCount(500)).toBe('500 views');
    expect(formatViewCount(0)).toBe('0 views');
  });
});
