import { render, screen, fireEvent } from '@testing-library/react';
import { DayList } from './DayList';

test('renders the correct number of day rows', () => {
  render(<DayList days={5} startDate="2026-05-31" selectedDay={null} onSelect={jest.fn()} />);
  expect(screen.getAllByRole('button')).toHaveLength(5);
  expect(screen.getByText('Day 1')).toBeInTheDocument();
  expect(screen.getByText('Day 5')).toBeInTheDocument();
});

test('renders dates when startDate provided', () => {
  render(<DayList days={3} startDate="2026-05-31" selectedDay={null} onSelect={jest.fn()} />);
  expect(screen.getByText(/31 May/)).toBeInTheDocument();
});

test('highlights selected day', () => {
  const { container } = render(
    <DayList days={5} startDate="2026-05-31" selectedDay="Day 2" onSelect={jest.fn()} />
  );
  const rows = container.querySelectorAll('.day-list__row');
  expect(rows[1].className).toContain('day-list__row--chosen');
});

test('fires onSelect with day label when row clicked', () => {
  const onSelect = jest.fn();
  render(<DayList days={5} startDate="2026-05-31" selectedDay={null} onSelect={onSelect} />);
  fireEvent.click(screen.getByText('Day 3').closest('button'));
  expect(onSelect).toHaveBeenCalledWith('Day 3');
});

test('renders without dates when no startDate', () => {
  render(<DayList days={3} startDate={null} selectedDay={null} onSelect={jest.fn()} />);
  expect(screen.getByText('Day 1')).toBeInTheDocument();
  expect(screen.queryByText(/May/)).not.toBeInTheDocument();
});
