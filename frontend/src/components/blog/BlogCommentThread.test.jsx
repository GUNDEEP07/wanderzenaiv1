import { render, screen } from '@testing-library/react';
import { BlogCommentThread } from './BlogCommentThread';

const comments = [
  { id: 'c2', user_id: 'u-2', author_name: 'Gundeep', is_mine: true, content: 'Start behind Nanzenji', created_at: '2026-11-07T10:00:00Z' },
  { id: 'c1', user_id: 'u-1', author_name: 'A WanderZen traveller', is_mine: false, content: 'Which tea house first?', created_at: '2026-11-07T09:00:00Z' },
];

test('shows display names, never emails; edit/delete only on your own comment', () => {
  render(<BlogCommentThread comments={comments} currentUserId="firebase-uid-123" onAdd={jest.fn()} onEdit={jest.fn()} onDelete={jest.fn()} />);
  expect(screen.getByText('Gundeep')).toBeInTheDocument();
  expect(screen.getByText('A WanderZen traveller')).toBeInTheDocument();
  expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  expect(screen.getAllByText('Edit')).toHaveLength(1);
  expect(screen.getAllByText('Delete')).toHaveLength(1);
});

test('signed out: no edit/delete at all', () => {
  render(<BlogCommentThread comments={comments} currentUserId={null} onAdd={jest.fn()} onEdit={jest.fn()} onDelete={jest.fn()} />);
  expect(screen.queryByText('Edit')).not.toBeInTheDocument();
});
