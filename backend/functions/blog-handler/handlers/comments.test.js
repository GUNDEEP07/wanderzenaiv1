'use strict';

jest.mock('../db/blog', () => ({
  createComment: jest.fn(),
  updateComment: jest.fn(),
  deleteComment: jest.fn(),
}));

jest.mock('/opt/nodejs/index', () => ({
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}), { virtual: true });

// Mock errors module with proper return values
jest.mock('../utils/errors', () => ({
  badRequest: jest.fn((msg) => ({
    statusCode: 400,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: msg }),
  })),
  unauthorized: jest.fn(() => ({
    statusCode: 401,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'Unauthorized' }),
  })),
  notFound: jest.fn((msg) => ({
    statusCode: 404,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: msg }),
  })),
  serverError: jest.fn((msg) => ({
    statusCode: 500,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: msg }),
  })),
}));

const comments = require('./comments');
const blog = require('../db/blog');

describe('Comments Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── CREATE COMMENT ───────────────────────────────────────────────────────

  describe('createComment', () => {
    test('returns 201 with comment data on success', async () => {
      const mockComment = {
        id: '123',
        post_id: 'post-1',
        user_id: 'user-1',
        user_email: 'test@example.com',
        content: 'Great post!',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      blog.createComment.mockResolvedValue(mockComment);

      const result = await comments.createComment('post-1', { content: 'Great post!' }, 'user-1', 'test@example.com');

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(mockComment);
    });

    test('returns 401 if not authenticated', async () => {
      const result = await comments.createComment('post-1', { content: 'Great post!' }, null, 'test@example.com');

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Unauthorized');
    });

    test('returns 400 if content missing', async () => {
      const result = await comments.createComment('post-1', {}, 'user-1', 'test@example.com');

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Comment content is required');
    });

    test('returns 404 if post not found', async () => {
      blog.createComment.mockRejectedValue(new Error('Post not found or not available for comments'));

      const result = await comments.createComment('post-1', { content: 'Great post!' }, 'user-1', 'test@example.com');

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Post not found or not available for comments');
    });
  });

  // ─── UPDATE COMMENT ───────────────────────────────────────────────────────

  describe('updateComment', () => {
    test('returns 200 with updated comment on success', async () => {
      const mockComment = {
        id: '123',
        post_id: 'post-1',
        user_id: 'user-1',
        user_email: 'test@example.com',
        content: 'Updated comment!',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T12:00:00Z',
      };

      blog.updateComment.mockResolvedValue(mockComment);

      const result = await comments.updateComment('123', { content: 'Updated comment!' }, 'user-1');

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(mockComment);
    });

    test('returns 401 if not authenticated', async () => {
      const result = await comments.updateComment('123', { content: 'Updated comment!' }, null);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Unauthorized');
    });

    test('returns 404 if comment not found', async () => {
      blog.updateComment.mockRejectedValue(new Error('Comment not found'));

      const result = await comments.updateComment('123', { content: 'Updated comment!' }, 'user-1');

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Comment not found');
    });

    test('returns 403 if user unauthorized', async () => {
      blog.updateComment.mockRejectedValue(new Error('Unauthorized'));

      const result = await comments.updateComment('123', { content: 'Updated comment!' }, 'user-2');

      expect(result.statusCode).toBe(403);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('You do not have permission to edit this comment');
    });
  });

  // ─── DELETE COMMENT ───────────────────────────────────────────────────────

  describe('deleteComment', () => {
    test('returns 204 on success', async () => {
      blog.deleteComment.mockResolvedValue();

      const result = await comments.deleteComment('123', 'user-1', 'user');

      expect(result.statusCode).toBe(204);
      expect(result.body).toBe('');
    });

    test('returns 401 if not authenticated', async () => {
      const result = await comments.deleteComment('123', null, 'user');

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Unauthorized');
    });

    test('returns 404 if comment not found', async () => {
      blog.deleteComment.mockRejectedValue(new Error('Comment not found'));

      const result = await comments.deleteComment('123', 'user-1', 'user');

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Comment not found');
    });

    test('returns 403 if user unauthorized', async () => {
      blog.deleteComment.mockRejectedValue(new Error('Unauthorized'));

      const result = await comments.deleteComment('123', 'user-2', 'user');

      expect(result.statusCode).toBe(403);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('You do not have permission to delete this comment');
    });
  });
});
