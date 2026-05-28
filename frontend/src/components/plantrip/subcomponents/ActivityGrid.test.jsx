import { render, screen, fireEvent } from '@testing-library/react';
import { ActivityGrid } from './ActivityGrid';

const ACTIVITIES = ['Hiking', 'Food', 'Views', 'Culture', 'Nature', 'Nightlife', 'Wellness'];

test('renders all available activities', () => {
  render(<ActivityGrid availableActivities={ACTIVITIES} selectedActivities={[]} onActivityToggle={() => {}} onOpenCustomModal={() => {}} />);
  expect(screen.getByText('Hiking')).toBeInTheDocument();
  expect(screen.getByText('Wellness')).toBeInTheDocument();
  expect(screen.getByText('Add own')).toBeInTheDocument();
});

test('selected activity has --selected class', () => {
  const { container } = render(
    <ActivityGrid availableActivities={ACTIVITIES} selectedActivities={['Hiking']} onActivityToggle={() => {}} onOpenCustomModal={() => {}} />
  );
  const cards = container.querySelectorAll('.activity-card');
  expect(cards[0].className).toContain('activity-card--selected');
  expect(cards[1].className).not.toContain('activity-card--selected');
});

test('clicking activity calls onActivityToggle with name', () => {
  const toggle = jest.fn();
  render(<ActivityGrid availableActivities={ACTIVITIES} selectedActivities={[]} onActivityToggle={toggle} onOpenCustomModal={() => {}} />);
  fireEvent.click(screen.getByText('Food').closest('button'));
  expect(toggle).toHaveBeenCalledWith('Food');
});

test('clicking Add own calls onOpenCustomModal', () => {
  const open = jest.fn();
  render(<ActivityGrid availableActivities={ACTIVITIES} selectedActivities={[]} onActivityToggle={() => {}} onOpenCustomModal={open} />);
  fireEvent.click(screen.getByText('Add own').closest('button'));
  expect(open).toHaveBeenCalled();
});

test('each category gets its own colour class', () => {
  const { container } = render(
    <ActivityGrid availableActivities={['Hiking','Food','Views']} selectedActivities={[]} onActivityToggle={() => {}} onOpenCustomModal={() => {}} />
  );
  const cards = container.querySelectorAll('.activity-card');
  expect(cards[0].className).toContain('activity-card--hiking');
  expect(cards[1].className).toContain('activity-card--food');
  expect(cards[2].className).toContain('activity-card--views');
});
