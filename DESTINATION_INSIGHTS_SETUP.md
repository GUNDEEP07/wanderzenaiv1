# Destination Insights Feature — Setup Guide

This document covers the new destination insights caching system that displays personalized destination recommendations based on travel styles and dates.

## What's New

- **New Lambda Function:** `backend/functions/destination-insights/` — generates destination insights using Claude Haiku
- **New Database Table:** `destination_insights_cache` — caches insights per destination + date range with 30-day TTL
- **New Frontend Component:** `DestinationInsightsPanel.jsx` — displays insights in a card-based layout
- **Frontend Service:** `src/api/destinationInsights.js` — client-side API wrapper
- **Updated SAM Template:** Added destination-insights Lambda to `infra/template.yaml`

## Database Migration

Before deploying, run the migration to create the cache table:

```bash
cd infra
psql -h $DB_HOST -U wanderzen_admin -d wanderzenai -f migrations/001_add_destination_insights_cache.sql
```

**Cache Strategy:**
- Composite unique key: `(destination, start_date, end_date, travel_styles)`
- Each cache entry expires after 30 days (`expires_at`)
- Multiple date ranges can coexist for the same destination
- Old entries are automatically expired; destinations persist indefinitely
- Optional: Run periodic cleanup with `DELETE FROM destination_insights_cache WHERE expires_at < NOW()`

## Lambda Deployment

The function is defined in `infra/template.yaml` and will be deployed with `sam deploy`:

```bash
cd infra
sam validate  # Check YAML is valid
sam build     # Build all Lambdas including destination-insights
sam deploy    # Deploy to AWS
```

**Environment Requirements:**
- `CLAUDE_API_KEY` — Anthropic API key (already in SAM parameters)
- `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` — Database credentials (already in SAM parameters)

## Frontend Integration

The `DestinationInsightsPanel` is now integrated into `VenueSelection.jsx` and displays when:
1. A destination is selected
2. Travel dates are available
3. The panel fetches insights from `/destination-insights` endpoint

Example usage (already in `PlanTrip.jsx`):

```jsx
<DestinationInsightsPanel
  destination={destination}
  travelStyles={travelStyles}
  startDate={startDate}
  endDate={endDate}
  loading={loading}
/>
```

## Testing Locally

1. **Frontend:** `npm run dev` — dev server will call live API at `VITE_API_URL`
2. **Database:** Ensure RDS has the new table (run migration above)
3. **API:** Verify endpoint at `https://<api-gateway-url>/prod/destination-insights?destination=Paris&startDate=2026-06-01&endDate=2026-06-10`

## API Response Format

```json
{
  "insights": {
    "bestMonths": ["June", "July", "September"],
    "whyThisMonth": "Perfect weather with fewer crowds",
    "weather": "Mild, occasional rain",
    "crowdLevel": "Moderate",
    "seasonalHighlights": "Summer festivals and outdoor dining",
    "travelTip": "Book restaurants in advance during peak season",
    "thingsToDo": [
      {
        "name": "Louvre Museum",
        "category": "Culture",
        "reason": "World-class art collection perfect for cultural travelers",
        "emoji": "🏛️"
      }
    ]
  },
  "cached": false
}
```

## Cache Maintenance

**Cleanup Job (optional):**
To prevent the cache table from growing indefinitely, run this periodically:

```sql
DELETE FROM destination_insights_cache WHERE expires_at < NOW();
```

This could be implemented as:
- A CloudWatch scheduled event (Lambda cron)
- Part of the existing `weekly-cache-refresh` job
- A manual database maintenance script

No implementation is required initially — old entries will just accumulate. Delete when table size becomes a concern.

## Troubleshooting

**No insights appear:**
- Check browser console for fetch errors
- Verify `/destination-insights` endpoint exists in API Gateway
- Ensure Claude API key is set and valid
- Check Lambda logs: `npm run logs:destination-insights` (if command exists)

**Database errors:**
- Migration not applied: Run `psql` command above
- Connection error: Verify `DB_HOST`, `DB_USER`, `DB_PASSWORD` in SAM parameters

**CORS issues:**
- Verify `ALLOWED_ORIGINS` in SAM template includes your frontend URL
- Check API Gateway CORS settings in template.yaml

## Files Modified/Created

**Created:**
- `infra/migrations/001_add_destination_insights_cache.sql`
- `backend/functions/destination-insights/handler.js`
- `backend/functions/destination-insights/package.json`
- `frontend/src/api/destinationInsights.js`
- `frontend/src/components/plantrip/subcomponents/DestinationInsightsPanel.jsx`

**Modified:**
- `infra/template.yaml` — Added DestinationInsightsFunction
- `frontend/src/components/plantrip/VenueSelection.jsx` — Integrated panel, updated props
- `frontend/src/pages/PlanTrip.jsx` — Pass startDate/endDate to VenueSelection
