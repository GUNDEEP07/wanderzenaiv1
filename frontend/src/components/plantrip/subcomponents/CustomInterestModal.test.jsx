import { render, screen, fireEvent } from '@testing-library/react';
import { CustomInterestModal } from './CustomInterestModal';

test('CustomInterestModal is hidden when isOpen=false', () => {
  const { container } = render(
    <CustomInterestModal
      destination="Bangkok"
      isOpen={false}
      onClose={() => {}}
      onSubmit={() => {}}
      loading={false}
    />
  );
  const overlays = container.querySelectorAll('[style*="display: none"]');
  expect(overlays.length > 0).toBe(true);
});

test('CustomInterestModal shows when isOpen=true', () => {
  render(
    <CustomInterestModal
      destination="Bangkok"
      isOpen={true}
      onClose={() => {}}
      onSubmit={() => {}}
      loading={false}
    />
  );
  expect(screen.getByText('Add Custom Interest')).toBeInTheDocument();
  expect(screen.getByText(/Bangkok/)).toBeInTheDocument();
});

test('CustomInterestModal calls onSubmit with input', () => {
  const mockSubmit = jest.fn();
  render(
    <CustomInterestModal
      destination="Bangkok"
      isOpen={true}
      onClose={() => {}}
      onSubmit={mockSubmit}
      loading={false}
    />
  );
  const input = screen.getByPlaceholderText(/Street Art/);
  const addButton = screen.getByText('Add Interest');
  fireEvent.change(input, { target: { value: 'Street Art' } });
  fireEvent.click(addButton);
  expect(mockSubmit).toHaveBeenCalledWith('Street Art');
});

test('CustomInterestModal calls onClose when Cancel clicked', () => {
  const mockClose = jest.fn();
  render(
    <CustomInterestModal
      destination="Bangkok"
      isOpen={true}
      onClose={mockClose}
      onSubmit={() => {}}
      loading={false}
    />
  );
  const cancelButton = screen.getByText('Cancel');
  fireEvent.click(cancelButton);
  expect(mockClose).toHaveBeenCalled();
});

test('CustomInterestModal submits on Enter key', () => {
  const mockSubmit = jest.fn();
  render(
    <CustomInterestModal
      destination="Bangkok"
      isOpen={true}
      onClose={() => {}}
      onSubmit={mockSubmit}
      loading={false}
    />
  );
  const input = screen.getByPlaceholderText(/Street Art/);
  fireEvent.change(input, { target: { value: 'Street Art' } });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
  expect(mockSubmit).toHaveBeenCalledWith('Street Art');
});
