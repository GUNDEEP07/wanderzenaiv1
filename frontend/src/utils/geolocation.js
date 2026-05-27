export async function getUserLocationFromIP() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error('Geolocation API failed');
    const data = await response.json();
    return {
      country: data.country_name || 'Unknown',
      city: data.city || 'Unknown',
      countryCode: data.country_code || 'US',
      latitude: data.latitude || null,
      longitude: data.longitude || null,
    };
  } catch (error) {
    console.warn('IP geolocation failed, using fallback', error);
    return {
      country: 'Unknown',
      city: 'Unknown',
      countryCode: 'US',
      latitude: null,
      longitude: null,
    };
  }
}
