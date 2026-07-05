'use strict';

jest.mock('../db/blog', () => ({
  createPost: jest.fn(),
  getPost: jest.fn(),
  listPosts: jest.fn().mockResolvedValue([]),
  updatePost: jest.fn(),
  deletePost: jest.fn(),
}));
jest.mock('../utils/validation', () => ({
  validatePostInput: jest.fn((title, description, content, location, country, travelDates, category) => {
    if (!title || title.length < 3) {
      throw new Error('Post title is required, must be 3-200 characters');
    }
    if (!category || !['tips', 'adventure', 'culture', 'food', 'budget', 'other'].includes(category)) {
      throw new Error('Category must be one of: tips, adventure, culture, food, budget, other');
    }
  }),
  validatePhotoUpload: jest.fn(),
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

const posts = require('./posts');

describe('Posts Handler', () => {
  describe('exports', () => {
    it('should export all required functions', () => {
      expect(typeof posts.createPost).toBe('function');
      expect(typeof posts.getPost).toBe('function');
      expect(typeof posts.listPosts).toBe('function');
      expect(typeof posts.updatePost).toBe('function');
      expect(typeof posts.deletePost).toBe('function');
    });
  });

  describe('createPost', () => {
    it('should return 401 when userId is not provided', async () => {
      const result = await posts.createPost({}, null, 'user@example.com');
      expect(result.statusCode).toBe(401);
    });

    it('should return 400 when title is invalid', async () => {
      const body = {
        title: 'ab',
        description: 'This is a valid description',
        content: 'This is a valid content with enough characters',
        location: 'Paris',
        country: 'France',
        category: 'tips',
      };
      const result = await posts.createPost(body, 'user-123', 'user@example.com');
      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when category is invalid', async () => {
      const body = {
        title: 'Valid Title',
        description: 'This is a valid description',
        content: 'This is a valid content with enough characters to satisfy the requirement',
        location: 'Paris',
        country: 'France',
        category: 'invalid_category',
      };
      const result = await posts.createPost(body, 'user-123', 'user@example.com');
      expect(result.statusCode).toBe(400);
    });
  });

  describe('getPost', () => {
    it('should return 400 when postId is not provided', async () => {
      const result = await posts.getPost(null);
      expect(result.statusCode).toBe(400);
    });
  });

  describe('listPosts', () => {
    it('should handle empty query parameters', async () => {
      const result = await posts.listPosts({});
      expect(result.statusCode).toBe(200);
      expect(result.body).toBeDefined();
    });

    it('should handle filters in query parameters', async () => {
      const result = await posts.listPosts({
        category: 'tips',
        country: 'France',
        page: '1',
      });
      expect(result.statusCode).toBe(200);
    });
  });

  describe('updatePost', () => {
    it('should return 401 when userId is not provided', async () => {
      const result = await posts.updatePost('post-123', {}, null);
      expect(result.statusCode).toBe(401);
    });

    it('should return 400 when postId is not provided', async () => {
      const result = await posts.updatePost(null, {}, 'user-123');
      expect(result.statusCode).toBe(400);
    });
  });

  describe('deletePost', () => {
    it('should return 401 when userId is not provided', async () => {
      const result = await posts.deletePost('post-123', null, 'user');
      expect(result.statusCode).toBe(401);
    });

    it('should return 400 when postId is not provided', async () => {
      const result = await posts.deletePost(null, 'user-123', 'user');
      expect(result.statusCode).toBe(400);
    });
  });
});
