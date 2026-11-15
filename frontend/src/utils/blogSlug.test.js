import { slugify, blogSlug, blogPath, postKeyFromParam, isUuid } from './blogSlug';

const post = { id: '08a02053-e1b9-4a6d-a4c2-3440817ad6e6', title: 'Vietnam, slowly: rice fields, river mornings and a quiet Hoi An' };

test('slugify', () => {
  expect(slugify('Café & Crêpes in Hội An!')).toBe('cafe-and-crepes-in-hoi-an');
  expect(slugify('   ')).toBe('');
  expect(slugify('one two three four five six seven eight nine ten eleven')).toBe('one-two-three-four-five-six-seven-eight-nine-ten');
});

test('blog slug and path', () => {
  expect(blogSlug(post)).toBe('vietnam-slowly-rice-fields-river-mornings-and-a-quiet-hoi-08a02053');
  expect(blogPath(post)).toBe('/blog/vietnam-slowly-rice-fields-river-mornings-and-a-quiet-hoi-08a02053');
  expect(blogSlug({ id: post.id, title: '!!!' })).toBe('08a02053');
});

test('post key from address', () => {
  expect(postKeyFromParam(post.id.toUpperCase())).toBe(post.id);
  expect(postKeyFromParam(blogSlug(post))).toBe('08a02053');
  expect(postKeyFromParam('old-words-08A02053')).toBe('08a02053');
  expect(postKeyFromParam('08a02053')).toBe('08a02053');
  expect(postKeyFromParam('no-id-here')).toBeNull();
  expect(postKeyFromParam('x-08a0205z')).toBeNull();
  expect(isUuid(post.id)).toBe(true);
});
