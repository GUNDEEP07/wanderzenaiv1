import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminBlogPanel, { validateStory } from './AdminBlogPanel';
import { fetchPosts, createPost, updatePost, deletePost } from '../api/blog';

jest.mock('../api/blog', () => ({
  fetchPosts: jest.fn(), createPost: jest.fn(), updatePost: jest.fn(), deletePost: jest.fn(),
}));
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ currentUser: { uid: 'u1', email: 'team@wanderzenai.com' }, getIdToken: async () => 'tok' }),
}));
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));

const story = {
  id: 'p1', title: 'Tea houses of Kyoto', description: 'Quiet mornings', content: 'x'.repeat(60),
  location: 'Kyoto', country: 'Japan', category: 'culture', travel_dates: '[2026-03-01,2026-03-08)',
  published_at: '2026-11-08T00:00:00Z',
};
const good = { title: 'Slow Hoi An', description: 'Bikes and rice fields', content: 'y'.repeat(60), location: 'Hoi An', country: 'Vietnam', category: 'culture', start: '', end: '' };

beforeEach(() => {
  jest.clearAllMocks();
  fetchPosts.mockResolvedValue({ success: true, data: [story] });
});

test('validateStory mirrors the backend limits', () => {
  expect(validateStory(good)).toEqual({});
  const errs = validateStory({ ...good, title: 'ab', content: 'short', category: 'nope', start: '2026-03-02' });
  expect(Object.keys(errs).sort()).toEqual(['category', 'content', 'dates', 'title']);
  expect(validateStory({ ...good, start: '2026-03-08', end: '2026-03-01' }).dates).toMatch(/after/);
});

test('lists published stories', async () => {
  render(<AdminBlogPanel />);
  expect(await screen.findByText('Tea houses of Kyoto')).toBeInTheDocument();
  expect(screen.getByText(/Comments are closed/)).toBeInTheDocument();
});

test('a new story publishes straight away with the payload the API expects', async () => {
  createPost.mockResolvedValue({ success: true, data: { id: 'p2' } });
  render(<AdminBlogPanel />);
  await screen.findByText('Tea houses of Kyoto');
  fireEvent.click(screen.getByText('+ New story'));
  fireEvent.click(screen.getByText('Publish'));
  expect(await screen.findByText(/Title: 3–200/)).toBeInTheDocument();
  expect(createPost).not.toHaveBeenCalled();

  const type = (label, v) => fireEvent.change(screen.getByLabelText(label), { target: { value: v } });
  type('Title', ' Slow Hoi An '); type('Summary', good.description); type('Story', good.content);
  type('Place', 'Hoi An'); type('Country', 'Vietnam'); type('Category', 'food');
  type('Travelled from', '2026-02-01'); type('Travelled until', '2026-02-06');
  fireEvent.click(screen.getByText('Publish'));
  await waitFor(() => expect(createPost).toHaveBeenCalledWith({
    title: 'Slow Hoi An', description: good.description, content: good.content, location: 'Hoi An', country: 'Vietnam',
    category: 'food', travelDates: { start: '2026-02-01', end: '2026-02-06' },
  }, 'tok'));
  expect(await screen.findByText(/live on the blog/)).toBeInTheDocument();
  expect(fetchPosts).toHaveBeenCalledTimes(2);
});

test('edit loads the story (dates included) and saves with updatePost', async () => {
  updatePost.mockResolvedValue({ success: true, data: story });
  render(<AdminBlogPanel />);
  await screen.findByText('Tea houses of Kyoto');
  fireEvent.click(screen.getByText('Edit'));
  expect(screen.getByLabelText('Title')).toHaveValue('Tea houses of Kyoto');
  expect(screen.getByLabelText('Travelled from')).toHaveValue('2026-03-01');
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Tea houses (updated)' } });
  fireEvent.click(screen.getByText('Save changes'));
  await waitFor(() => expect(updatePost).toHaveBeenCalledWith('p1', expect.objectContaining({ title: 'Tea houses (updated)', travelDates: { start: '2026-03-01', end: '2026-03-08' } }), 'tok'));
});

test('delete asks once before removing', async () => {
  deletePost.mockResolvedValue({ success: true });
  render(<AdminBlogPanel />);
  await screen.findByText('Tea houses of Kyoto');
  fireEvent.click(screen.getByText('Delete'));
  expect(deletePost).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Yes, delete'));
  await waitFor(() => expect(deletePost).toHaveBeenCalledWith('p1', 'tok'));
});

test('shows the API error when saving fails (e.g. not on the team)', async () => {
  createPost.mockRejectedValue(new Error('Failed to create post: Only the WanderZen team can publish stories right now'));
  render(<AdminBlogPanel />);
  await screen.findByText('Tea houses of Kyoto');
  fireEvent.click(screen.getByText('+ New story'));
  const type = (label, v) => fireEvent.change(screen.getByLabelText(label), { target: { value: v } });
  type('Title', good.title); type('Summary', good.description); type('Story', good.content); type('Place', 'Hoi An'); type('Country', 'Vietnam');
  fireEvent.click(screen.getByText('Publish'));
  expect(await screen.findByRole('alert')).toHaveTextContent(/Only the WanderZen team/);
});
