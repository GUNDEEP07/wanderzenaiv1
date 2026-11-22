import { render, screen } from '@testing-library/react';
import StopRow from './StopRow';
import { hoursOn } from '../../api/googlePlaces';

const HOURS = ['Monday: 5:00 – 8:30 PM', 'Tuesday: Closed', 'Wednesday: 5:00 – 8:30 PM', 'Thursday: 5:00 – 8:30 PM', 'Friday: 5:00 – 9:00 PM', 'Saturday: 5:00 – 9:00 PM', 'Sunday: 5:00 – 8:30 PM'];

test('hoursOn picks the trip day\'s weekday; nothing without a date', () => {
  expect(hoursOn(HOURS, new Date(2026, 11, 8))).toBe('Closed'); // Tue 8 Dec 2026
  expect(hoursOn(HOURS, new Date(2026, 11, 13))).toBe('5:00 – 8:30 PM'); // Sunday
  expect(hoursOn(HOURS, null)).toBeNull();
  expect(hoursOn(null, new Date())).toBeNull();
});

const stop = { id: 'eveningActivity', kind: 'activity', period: 'Evening', timeLabel: '6:00 PM', title: 'Dinner at Aosta', place: 'Aosta', act: { activity: 'Dinner at Aosta', location: 'Aosta', placeId: 'ChIJaostaaaaaaa1' } };

test('a Google-checked stop shows fresh rating, that day\'s hours, credited photo, Maps link and attribution', () => {
  const info = { name: 'Aosta', status: 'OPERATIONAL', rating: 4.6, reviews: 596, hours: HOURS, mapsUri: 'https://maps.google.com/?cid=1', photo: { name: 'places/ChIJaostaaaaaaa1/photos/AbCdEfGhIjKlMn', authors: [{ name: 'Zeph', uri: 'https://maps.google.com/contrib/9' }] } };
  render(<StopRow stop={stop} base="Arrowtown" destination="New Zealand" currency="AUD" isNext google={info} date={new Date(2026, 11, 8)} onToggleDone={() => {}} />);
  expect(screen.getByLabelText('Rated 4.6 out of 5 from 596 Google reviews')).toHaveTextContent('★ 4.6 (596)');
  expect(screen.getByText('Tue: Closed')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open in Google Maps' })).toHaveAttribute('href', 'https://maps.google.com/?cid=1');
  expect(screen.getByRole('link', { name: 'Zeph' })).toBeInTheDocument();
  expect(screen.getByText('Google Maps')).toBeInTheDocument();
});

test('closed places are flagged; no Google info → nothing extra', () => {
  const { rerender } = render(<StopRow stop={stop} base="Arrowtown" destination="NZ" currency="AUD" isNext google={{ status: 'CLOSED_PERMANENTLY', hours: null }} onToggleDone={() => {}} />);
  expect(screen.getByRole('note')).toHaveTextContent('permanently closed');
  rerender(<StopRow stop={stop} base="Arrowtown" destination="NZ" currency="AUD" isNext google={null} onToggleDone={() => {}} />);
  expect(screen.queryByText('Google Maps')).toBeNull();
});
