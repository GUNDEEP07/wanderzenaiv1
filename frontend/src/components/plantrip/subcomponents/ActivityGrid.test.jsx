import { render, screen, fireEvent } from '@testing-library/react';
import { ActivityGrid } from './ActivityGrid';

test('ActivityGrid renders all preset activities', () => {
  render(
    <ActivityGrid selectedActivities={[]} onActivityToggle={() => {}} onOpenCustomModal={() => {}} />
  );
  expect(screen.getByText('Hiking')).toBeInTheDocument();
  expect(screen.getByText('Food')).toBeInTheDocument();
  expect(screen.getByText('Culture')).toBeInTheDocument();
  expect(screen.getByText('Add Custom')).toBeInTheDocument();
});

test('ActivityGrid highlights selected activity', () => {
  const { container } = render(
    <ActivityGrid selectedActivities={['Hiking']} onActivityToggle={() => {}} onOpenCustomModal={() => {}} />
  );
  const buttons = screen.getAllByRole('button');
  const hikingButton = buttons.find(btn => btn.textContent.includes('Hiking'));
  expect(hikingButton.style.border).toContain('rgb(0, 212, 170)');
});

test('ActivityGrid calls onActivityToggle when activity clicked', () => {
  const mockToggle = jest.fn();
  render(
    <ActivityGrid selectedActivities={[]} onActivityToggle={mockToggle} onOpenCustomModal={() => {}} />
  );
  const buttons = screen.getAllByRole('button');
  fireEvent.click(buttons[0]);
  expect(mockToggle).toHaveBeenCalled();
});

test('ActivityGrid calls onOpenCustomModal when + clicked', () => {
  const mockOpen = jest.fn();
  render(
    <ActivityGrid selectedActivities={[]} onActivityToggle={() => {}} onOpenCustomModal={mockOpen} />
  );
  const customButton = screen.getByText('Add Custom').closest('button');
  fireEvent.click(customButton);
  expect(mockOpen).toHaveBeenCalled();
});
