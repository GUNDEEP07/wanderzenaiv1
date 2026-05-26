import { render, screen } from '@testing-library/react';
import { YouTubeCarousel } from './YouTubeCarousel';

const mockVideos = [
  {
    id: 'abc123',
    title: 'Best Hiking Trails',
    creator: 'Adventure Max',
    thumbnailUrl: 'https://example.com/thumb.jpg',
  },
  {
    id: 'def456',
    title: 'Hidden Waterfall Trek',
    creator: 'Travel Vlog',
    thumbnailUrl: 'https://example.com/thumb2.jpg',
  },
];

test('YouTubeCarousel renders video cards', () => {
  render(
    <YouTubeCarousel
      activity="Hiking"
      destination="Bangkok"
      countryCode="TH"
      videos={mockVideos}
      loading={false}
      isMobile={true}
    />
  );
  expect(screen.getByText('Best Hiking Trails')).toBeInTheDocument();
  expect(screen.getByText('Hidden Waterfall Trek')).toBeInTheDocument();
  expect(screen.getByText('Adventure Max')).toBeInTheDocument();
});

test('YouTubeCarousel displays country flag', () => {
  render(
    <YouTubeCarousel
      activity="Hiking"
      destination="Bangkok"
      countryCode="TH"
      videos={mockVideos}
      loading={false}
      isMobile={true}
    />
  );
  expect(screen.getByText(/Bangkok/)).toBeInTheDocument();
});

test('YouTubeCarousel shows loading state', () => {
  render(
    <YouTubeCarousel
      activity="Hiking"
      destination="Bangkok"
      countryCode="TH"
      videos={[]}
      loading={true}
      isMobile={true}
    />
  );
  expect(screen.getByText('Loading videos...')).toBeInTheDocument();
});

test('YouTubeCarousel shows empty state', () => {
  render(
    <YouTubeCarousel
      activity="Hiking"
      destination="Bangkok"
      countryCode="TH"
      videos={[]}
      loading={false}
      isMobile={true}
    />
  );
  expect(screen.getByText(/No trending videos found/)).toBeInTheDocument();
});

test('YouTubeCarousel shows swipe hint on mobile', () => {
  const { rerender } = render(
    <YouTubeCarousel
      activity="Hiking"
      destination="Bangkok"
      countryCode="TH"
      videos={mockVideos}
      loading={false}
      isMobile={true}
    />
  );
  expect(screen.getByText('← Swipe for more →')).toBeInTheDocument();

  rerender(
    <YouTubeCarousel
      activity="Hiking"
      destination="Bangkok"
      countryCode="TH"
      videos={mockVideos}
      loading={false}
      isMobile={false}
    />
  );
  expect(screen.queryByText('← Swipe for more →')).not.toBeInTheDocument();
});
