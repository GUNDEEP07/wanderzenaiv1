import { withCheckoutIdentity } from './paymentLink';

describe('withCheckoutIdentity', () => {
  const link = 'https://buy.stripe.com/test_abc123';

  it('adds the Firebase uid and email', () => {
    const url = new URL(withCheckoutIdentity(link, { uid: 'Ab3_x-9', email: 'a+b@example.com' }));
    expect(url.searchParams.get('client_reference_id')).toBe('Ab3_x-9');
    expect(url.searchParams.get('prefilled_email')).toBe('a+b@example.com');
  });

  it('keeps existing query parameters', () => {
    const url = new URL(withCheckoutIdentity(`${link}?locale=en`, { uid: 'u1', email: 'x@example.com' }));
    expect(url.searchParams.get('locale')).toBe('en');
    expect(url.searchParams.get('client_reference_id')).toBe('u1');
  });

  it('omits a uid Stripe would silently drop', () => {
    const url = new URL(withCheckoutIdentity(link, { uid: 'has spaces@', email: 'x@example.com' }));
    expect(url.searchParams.has('client_reference_id')).toBe(false);
  });

  it('returns the link unchanged without a user, or when it cannot be parsed', () => {
    expect(withCheckoutIdentity(link, null)).toBe(link);
    expect(withCheckoutIdentity('not a url', { uid: 'u1' })).toBe('not a url');
    expect(withCheckoutIdentity(undefined, { uid: 'u1' })).toBeUndefined();
  });
});
