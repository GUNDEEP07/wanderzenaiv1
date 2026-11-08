import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdjustDay, { toggleSuggestion } from './AdjustDay';

const summary = { remaining: 2, max: 3, pending: null };

test('toggleSuggestion adds and removes a suggestion', () => {
  expect(toggleSuggestion('', 'Less walking')).toBe('Less walking');
  expect(toggleSuggestion('Less walking', 'More local food')).toBe('Less walking, More local food');
  expect(toggleSuggestion('Less walking, More local food', 'less walking')).toBe('More local food');
});

test('nothing for non-owners, or when no changes are left', () => {
  const { container, rerender } = render(<AdjustDay dayNumber={2} summary={null} onStart={jest.fn()} />);
  expect(container.innerHTML).toBe('');
  rerender(<AdjustDay dayNumber={2} summary={{ ...summary, remaining: 0 }} onStart={jest.fn()} />);
  expect(container.innerHTML).toBe('');
});

test('owner writes a note (or taps suggestions) and starts the rewrite', async () => {
  const onStart = jest.fn(async () => {});
  render(<AdjustDay dayNumber={2} summary={summary} onStart={onStart} />);
  fireEvent.click(screen.getByText('✎ Adjust this day'));
  expect(screen.getByText(/2 of 3 free changes left/)).toBeInTheDocument();
  const go = screen.getByText('Rewrite day 2');
  expect(go).toBeDisabled();
  fireEvent.click(screen.getByText('Less walking'));
  fireEvent.click(screen.getByText('More local food'));
  expect(screen.getByLabelText('Change for day 2')).toHaveValue('Less walking, More local food');
  fireEvent.click(screen.getByText('Rewrite day 2'));
  await waitFor(() => expect(onStart).toHaveBeenCalledWith(2, 'Less walking, More local food'));
  await waitFor(() => expect(screen.getByText('✎ Adjust this day')).toBeInTheDocument());
});

test('an error from the API is shown and the panel stays open', async () => {
  const onStart = jest.fn(async () => { throw new Error('This trip has used its 3 day changes.'); });
  render(<AdjustDay dayNumber={1} summary={summary} onStart={onStart} />);
  fireEvent.click(screen.getByText('✎ Adjust this day'));
  fireEvent.change(screen.getByLabelText('Change for day 1'), { target: { value: 'slower please' } });
  fireEvent.click(screen.getByText('Rewrite day 1'));
  expect(await screen.findByRole('alert')).toHaveTextContent(/used its 3 day changes/);
  expect(screen.getByLabelText('Change for day 1')).toHaveValue('slower please');
});

test('while a day is being rewritten: that day says so, others wait', () => {
  const busy = { ...summary, pending: { id: '7', day: 3 } };
  const { rerender } = render(<AdjustDay dayNumber={3} summary={busy} onStart={jest.fn()} />);
  expect(screen.getByTestId('adjusting-3')).toHaveTextContent(/Rewriting day 3/);
  rerender(<AdjustDay dayNumber={1} summary={busy} onStart={jest.fn()} />);
  expect(screen.getByText('✎ Adjust this day')).toBeDisabled();
  expect(screen.getByText(/Another day is being rewritten/)).toBeInTheDocument();
});
