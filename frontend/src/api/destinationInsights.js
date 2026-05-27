const API_URL = import.meta.env.VITE_API_URL;

export async function fetchDestinationInsights(destination, travelStyles, startDate, endDate) {
  if (!destination || !startDate || !endDate) {
    console.warn('Missing required parameters for destination insights');
    return null;
  }

  try {
    const params = new URLSearchParams({
      destination,
      travelStyles: Array.isArray(travelStyles) ? travelStyles.join(',') : '',
      startDate,
      endDate,
    });

    const response = await fetch(`${API_URL}/destination-insights?${params}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Destination insights API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[DestinationInsights] Fetched insights for ${destination}:`, data);

    return data.insights || null;
  } catch (error) {
    console.error('Failed to fetch destination insights:', error);
    return null;
  }
}
