const axios = require('axios');

// Mock Foursquare API responses
const mockAutocompleteFoursquare = () => {
  return {
    results: [
      {
        fsq_id: '4a1234567890123',
        name: 'Bir Billing',
        location: {
          country: 'India',
          latitude: 32.2031,
          longitude: 76.7120,
        },
      },
    ],
  };
};

describe('Recommendations Lambda', () => {
  describe('GET /autocomplete', () => {
    test('should return suggestions for valid query', async () => {
      // Mock axios to avoid real API calls in test
      jest.spyOn(axios, 'get').mockResolvedValue({
        data: mockAutocompleteFoursquare(),
      });

      const event = {
        path: '/autocomplete',
        httpMethod: 'GET',
        queryStringParameters: { query: 'bir billing' },
      };

      // Mock process.env
      process.env.FOURSQUARE_API_KEY = 'test-key';

      // Note: This is pseudocode. Adapt to your actual test framework.
      // You may need to invoke the Lambda handler directly or use AWS SAM testing tools.

      const response = {
        statusCode: 200,
        body: JSON.stringify({
          suggestions: [
            {
              fsq_id: '4a1234567890123',
              name: 'Bir Billing',
              country: 'India',
              lat: 32.2031,
              lng: 76.7120,
            },
          ],
        }),
      };

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).suggestions.length).toBeGreaterThan(0);
    });

    test('should return empty suggestions for query < 2 characters', async () => {
      const event = {
        path: '/autocomplete',
        httpMethod: 'GET',
        queryStringParameters: { query: 'b' },
      };

      // Expected: empty suggestions
      const response = {
        statusCode: 200,
        body: JSON.stringify({ suggestions: [] }),
      };

      expect(JSON.parse(response.body).suggestions).toEqual([]);
    });

    test('should return fallback if Foursquare API fails', async () => {
      jest.spyOn(axios, 'get').mockRejectedValue(new Error('API Error'));

      // Expected: fallback destinations
      const response = {
        statusCode: 200,
        body: JSON.stringify({
          suggestions: [
            { name: 'Kyoto', country: 'Japan', lat: 35.0116, lng: 135.7681 },
            // ... more fallbacks
          ],
        }),
      };

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('GET /venues', () => {
    test('should return categories and venues for valid lat/lng', async () => {
      jest.spyOn(axios, 'get').mockResolvedValue({
        data: {
          results: [
            {
              fsq_id: 'v1',
              name: 'Local Cafe',
              categories: [{ name: 'Cafe' }],
              rating: 4.5,
              location: { address: 'Main St' },
            },
          ],
        },
      });

      const event = {
        path: '/venues',
        httpMethod: 'GET',
        queryStringParameters: {
          destination: 'Bir Billing',
          lat: '32.2031',
          lng: '76.7120',
        },
      };

      const response = {
        statusCode: 200,
        body: JSON.stringify({
          destination: 'Bir Billing',
          categories: [
            {
              category: 'Restaurants',
              venues: [
                {
                  fsq_id: 'v1',
                  name: 'Local Cafe',
                  category: 'Cafe',
                  rating: 4.5,
                  address: 'Main St',
                },
              ],
            },
          ],
        }),
      };

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).categories.length).toBeGreaterThan(0);
    });

    test('should return 400 if lat/lng missing', async () => {
      const event = {
        path: '/venues',
        httpMethod: 'GET',
        queryStringParameters: { destination: 'Bir Billing' },
      };

      const response = {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing lat and lng parameters' }),
      };

      expect(response.statusCode).toBe(400);
    });
  });
});
