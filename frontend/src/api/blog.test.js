import { fetchComments, createComment } from './blog';

afterEach(() => { delete global.fetch; });

test('fetchComments returns the list inside { success, data } (it used to always return [])', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [{ id: 'c1' }, { id: 'c2' }] }) });
  expect((await fetchComments('p1')).map(c => c.id)).toEqual(['c1', 'c2']);
});

test('createComment returns the comment, not the envelope', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { id: 'c3', content: 'hi' } }) });
  expect(await createComment('p1', 'hi', 'tok')).toEqual({ id: 'c3', content: 'hi' });
});
