import { render, screen, fireEvent } from '@testing-library/react';
import { ActivityTabs } from './ActivityTabs';

test('ActivityTabs renders selected activities as tabs', () => {
  render(
    <ActivityTabs selectedActivities={['Hiking', 'Food']} activeTab="Hiking" onTabChange={() => {}} />
  );
  expect(screen.getByText(/Hiking/)).toBeInTheDocument();
  expect(screen.getByText(/Food/)).toBeInTheDocument();
});

test('ActivityTabs returns null when no activities selected', () => {
  const { container } = render(
    <ActivityTabs selectedActivities={[]} activeTab="" onTabChange={() => {}} />
  );
  expect(container.firstChild).toBeNull();
});

test('ActivityTabs highlights active tab', () => {
  const { container } = render(
    <ActivityTabs selectedActivities={['Hiking', 'Food']} activeTab="Hiking" onTabChange={() => {}} />
  );
  const tabs = container.querySelectorAll('button');
  expect(tabs[0].style.border).toContain('rgb(0, 212, 170)');
});

test('ActivityTabs calls onTabChange when tab clicked', () => {
  const mockChange = jest.fn();
  render(
    <ActivityTabs selectedActivities={['Hiking', 'Food']} activeTab="Hiking" onTabChange={mockChange} />
  );
  const tabs = screen.getAllByRole('button');
  fireEvent.click(tabs[1]);
  expect(mockChange).toHaveBeenCalledWith('Food');
});
