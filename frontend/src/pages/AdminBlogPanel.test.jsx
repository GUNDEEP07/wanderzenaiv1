import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminBlogPanel, { validateStory } from './AdminBlogPanel';
import { fetchPosts, createPost, updatePost, deletePost, fetchPhotos, uploadPhoto, updatePhotoCaption, deletePhoto } from '../api/blog';

jest.mock('../api/blog', () => ({
  fetchPosts: jest.fn(), createPost: jest.fn(), updatePost: jest.fn(), deletePost: jest.fn(),
  fetchPhotos: jest.fn(), uploadPhoto: jest.fn(), updatePhotoCaption: jest.fn(), deletePhoto: jest.fn(),
}));
// Canvas isn't available in jsdom; the resize step is tested on its own.
jest.mock('../utils/resizeImage', () => ({
  ACCEPTED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  resizeImage: jest.fn(async (file) => `data:image/jpeg;base64,RESIZED-${file.name}`),
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
  fetchPhotos.mockResolvedValue([]);
  global.URL.createObjectURL = jest.fn(f => `blob:${f.name}`);
  global.URL.revokeObjectURL = jest.fn();
});

const jpg = (name) => new File(['x'], name, { type: 'image/jpeg' });

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

test('a new story uploads its photos in order after publishing (first = cover)', async () => {
  createPost.mockResolvedValue({ success: true, data: { id: 'p9' } });
  uploadPhoto.mockResolvedValue({ id: 'ph', url: 'u' });
  render(<AdminBlogPanel />);
  await screen.findByText('Tea houses of Kyoto');
  fireEvent.click(screen.getByText('+ New story'));
  const type = (label, v) => fireEvent.change(screen.getByLabelText(label), { target: { value: v } });
  type('Title', good.title); type('Summary', good.description); type('Story', good.content); type('Place', 'Hoi An'); type('Country', 'Vietnam');
  fireEvent.change(screen.getByLabelText('Add photos'), { target: { files: [jpg('a.jpg'), jpg('b.jpg'), new File(['x'], 'c.heic', { type: 'image/heic' })] } });
  expect(screen.getByText('Cover')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent(/c\.heic/);
  type('Caption for photo 1', 'Lanterns');
  fireEvent.click(screen.getByText('Publish'));
  await waitFor(() => expect(uploadPhoto).toHaveBeenCalledTimes(2));
  expect(uploadPhoto.mock.calls[0]).toEqual(['p9', 'data:image/jpeg;base64,RESIZED-a.jpg', 'Lanterns', 'tok']);
  expect(uploadPhoto.mock.calls[1]).toEqual(['p9', 'data:image/jpeg;base64,RESIZED-b.jpg', null, 'tok']);
  expect(await screen.findByText(/live on the blog/)).toBeInTheDocument();
});

test('editing: loads saved photos, deletes removed ones and saves changed captions', async () => {
  updatePost.mockResolvedValue({ success: true, data: story });
  fetchPhotos.mockResolvedValue([{ id: 'ph1', url: 'https://s/1.jpg', caption: 'Old' }, { id: 'ph2', url: 'https://s/2.jpg', caption: null }]);
  render(<AdminBlogPanel />);
  await screen.findByText('Tea houses of Kyoto');
  fireEvent.click(screen.getByText('Edit'));
  expect(await screen.findByLabelText('Caption for photo 1')).toHaveValue('Old');
  fireEvent.change(screen.getByLabelText('Caption for photo 1'), { target: { value: 'New caption' } });
  fireEvent.click(screen.getAllByText('Remove')[1]);
  fireEvent.click(screen.getByText('Save changes'));
  await waitFor(() => expect(deletePhoto).toHaveBeenCalledWith('p1', 'ph2', 'tok'));
  expect(updatePhotoCaption).toHaveBeenCalledWith('p1', 'ph1', 'New caption', 'tok');
  expect(uploadPhoto).not.toHaveBeenCalled();
});

test('a failed photo upload keeps the editor open on the saved story to retry', async () => {
  createPost.mockResolvedValue({ success: true, data: { id: 'p9' } });
  uploadPhoto.mockRejectedValue(new Error('Failed to upload photo: too large'));
  render(<AdminBlogPanel />);
  await screen.findByText('Tea houses of Kyoto');
  fireEvent.click(screen.getByText('+ New story'));
  const type = (label, v) => fireEvent.change(screen.getByLabelText(label), { target: { value: v } });
  type('Title', good.title); type('Summary', good.description); type('Story', good.content); type('Place', 'Hoi An'); type('Country', 'Vietnam');
  fireEvent.change(screen.getByLabelText('Add photos'), { target: { files: [jpg('a.jpg')] } });
  fireEvent.click(screen.getByText('Publish'));
  expect(await screen.findByRole('alert')).toHaveTextContent(/story is saved, but 1 photo change failed/);
  expect(screen.getByText('Save changes')).toBeInTheDocument(); // now editing p9, not a new story
  expect(screen.getByText('New')).toBeInTheDocument(); // the failed photo is still queued
});
