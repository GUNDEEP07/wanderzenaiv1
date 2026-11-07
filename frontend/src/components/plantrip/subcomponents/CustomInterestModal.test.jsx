import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CustomInterestModal } from './CustomInterestModal';

const CATEGORIES = [
  { id: 'c1', name: 'Street Art', label: 'Arts > Street Art' },
  { id: 'c2', name: 'Night Market', label: 'Shopping > Night Market' },
];
const DEST = { name: 'Bangkok' };
const props = { destination: DEST, onClose: () => {}, onSubmit: () => {}, loading: false };

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ categories: CATEGORIES }) });
});
afterEach(() => { delete global.fetch; });

test('renders nothing when closed (no hidden focusable input)', () => {
  render(<CustomInterestModal {...props} isOpen={false} />);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(global.fetch).not.toHaveBeenCalled();
});

test('shows a labelled dialog for the destination when open', async () => {
  render(<CustomInterestModal {...props} isOpen />);
  expect(screen.getByRole('dialog', { name: 'Add Custom Interest' })).toBeInTheDocument();
  expect(screen.getByText(/What interests you in Bangkok\?/)).toBeInTheDocument();
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/recommendations/categories')));
});

test('submits typed text with the button', () => {
  const onSubmit = jest.fn();
  render(<CustomInterestModal {...props} isOpen onSubmit={onSubmit} />);
  expect(screen.getByText('Add Interest')).toBeDisabled();
  fireEvent.change(screen.getByPlaceholderText(/Search categories/), { target: { value: 'Street Art' } });
  fireEvent.click(screen.getByText('Add Interest'));
  expect(onSubmit).toHaveBeenCalledWith('Street Art');
});

test('submits on Enter', () => {
  const onSubmit = jest.fn();
  render(<CustomInterestModal {...props} isOpen onSubmit={onSubmit} />);
  const input = screen.getByPlaceholderText(/Search categories/);
  fireEvent.change(input, { target: { value: 'Pottery' } });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
  expect(onSubmit).toHaveBeenCalledWith('Pottery');
});

test('matching categories can be picked and submitted by label', async () => {
  const onSubmit = jest.fn();
  render(<CustomInterestModal {...props} isOpen onSubmit={onSubmit} />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  await waitFor(() => {}); // let categories land
  fireEvent.change(screen.getByPlaceholderText(/Search categories/), { target: { value: 'night' } });
  fireEvent.click(await screen.findByText('Night Market'));
  fireEvent.click(screen.getByText('Add Interest'));
  expect(onSubmit).toHaveBeenCalledWith('Shopping > Night Market');
});

test('Cancel calls onClose', () => {
  const onClose = jest.fn();
  render(<CustomInterestModal {...props} isOpen onClose={onClose} />);
  fireEvent.click(screen.getByText('Cancel'));
  expect(onClose).toHaveBeenCalled();
});
