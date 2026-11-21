import { render, screen } from '@testing-library/react';
import PriceNote from './PriceNote';

test('step 1 shows the full-trip price and a pricing link', () => {
  render(<PriceNote pricing={{ trip: { amount: 19, currency: 'AUD', trips: 1 }, pass: null }} />);
  expect(screen.getByTestId('price-note')).toHaveTextContent('Free: your route and Day 1. Every day: A$19 AUD.');
  expect(screen.getByRole('link', { name: 'See pricing' })).toHaveAttribute('href', '/pricing');
});

test('nothing until prices load', () => {
  const { container } = render(<PriceNote pricing={{ loading: true, trip: null, pass: null }} />);
  expect(container).toBeEmptyDOMElement();
});
