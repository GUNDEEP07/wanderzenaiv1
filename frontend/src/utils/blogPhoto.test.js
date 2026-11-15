import { blogPhotoQuery } from './blogPhoto';
test('first place + country', () => {
  expect(blogPhotoQuery({ location: 'Ninh Binh & Hoi An', country: 'Vietnam' })).toEqual({ destination: 'Vietnam', keyword: 'Ninh Binh Vietnam' });
  expect(blogPhotoQuery({ location: 'Ubud, Bali', country: 'Indonesia' }).keyword).toBe('Ubud Indonesia');
  expect(blogPhotoQuery({ location: 'Bangkok and Hanoi', country: 'Multiple' })).toEqual({ destination: 'Bangkok', keyword: 'Bangkok' });
  expect(blogPhotoQuery({ title: 'Budget Travel Tips: Southeast Asia' }).keyword).toBe('Budget Travel Tips');
});
