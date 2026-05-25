# Dynamic Destinations Deployment Checklist

## Task 11: Manual E2E Testing

### Prerequisites
- Ensure all code commits are pushed to `main`
- Backend Lambda packages installed: `npm run install:all`
- Frontend dependencies installed: `cd frontend && npm install`

### Testing Steps

#### Step 1: Deploy to Staging/Dev
```bash
sam deploy --guided
# Follow prompts:
# - Stack name: wanderzenai-stack-dev (or your dev stack name)
# - Region: ap-southeast-2
# - FOURSQUARE_API_KEY: (use test key)
# - Accept all other defaults
```

#### Step 2: Test Autocomplete Endpoint
```bash
# Get your API URL from CloudFormation outputs or:
# API_URL=https://YOUR_API_GATEWAY_ID.execute-api.ap-southeast-2.amazonaws.com/prod

curl "$API_URL/autocomplete?query=bir"
# Expected response:
# {
#   "suggestions": [
#     {
#       "fsq_id": "...",
#       "name": "Bir Billing",
#       "country": "India",
#       "lat": 32.2031,
#       "lng": 76.7120
#     },
#     ...
#   ]
# }
```

#### Step 3: Test Venues Endpoint
```bash
curl "$API_URL/venues?destination=Bir%20Billing&lat=32.2031&lng=76.7120"
# Expected response:
# {
#   "destination": "Bir Billing",
#   "categories": [
#     {
#       "category": "Restaurants",
#       "venues": [
#         {
#           "fsq_id": "...",
#           "name": "Local Restaurant",
#           "category": "Restaurant",
#           "rating": 4.5,
#           "address": "..."
#         },
#         ...
#       ]
#     },
#     ...
#   ]
# }
```

#### Step 4: Test Frontend Flow in Browser
1. **Start dev server:**
   ```bash
   cd frontend
   npm run dev
   # Opens http://localhost:5173
   ```

2. **Test destination search:**
   - Type "Bangkok" → should see autocomplete suggestions
   - Click on "Bangkok" → should advance to venue selection
   - Verify form shows: `destination: "Bangkok"`, `destinationLat`, `destinationLng`

3. **Test venue selection:**
   - Should show ~10 categories with venues
   - Categories: Restaurants, Cafes, Parks, Temples, Museums, Hiking Trails, Viewpoints, Markets, Bars & Nightlife, Accommodations
   - Each category should have up to 5 selectable venues
   - Select 2-3 venues from different categories
   - Click "Continue with Selections"

4. **Complete the form:**
   - Fill out Budget & Dates (Step 3)
   - Fill out Travel Style (Step 4)
   - Fill out Your Details (Step 5)
   - Review and Submit (Step 6)

5. **Verify submission:**
   - Open Browser DevTools → Network tab
   - On submit, check the POST request to `/submit-itinerary`
   - Verify `selected_venues` is sent in request body:
     ```json
     {
       "destination": "Bangkok",
       "destinationLat": 13.7563,
       "destinationLng": 100.5018,
       "selected_venues": {
         "Restaurants": ["v1_id", "v2_id"],
         "Parks": ["v3_id"]
       },
       ...other fields
     }
     ```

#### Step 5: Verify Database Storage
```bash
# Connect to your RDS instance
psql -h $DB_HOST -U wanderzen_admin -d wanderzenai

# Query the latest submission
SELECT id, destination, selected_venues, created_at 
FROM submissions 
ORDER BY created_at DESC 
LIMIT 1;

# Expected output:
# id        | destination | selected_venues                           | created_at
# ----------|-------------|------------------------------------------|---
# abc123    | Bangkok     | {"Restaurants":["v1","v2"],"Parks":...} | 2026-05-26...
```

#### Step 6: Check Itinerary Generation
1. **Monitor CloudWatch logs:**
   ```bash
   npm run logs:gen
   # Look for logs containing:
   # - "Itinerary generation started"
   # - "Selected venues included: [...]"
   # - "Generated itinerary successfully"
   ```

2. **Verify venues in itinerary:**
   - Wait 3-5 minutes for itinerary to be generated
   - Check email for the itinerary PDF
   - Open the PDF and verify:
     - Selected venues appear in the itinerary
     - Venues are naturally integrated (not just a list at the end)
     - Example: "Breakfast at [Venue Name], a highly-rated restaurant..."

#### Step 7: Test Error Scenarios

**Test missing lat/lng in venues endpoint:**
```bash
curl "$API_URL/venues?destination=Bangkok"
# Expected: 400 error
# {
#   "error": "Missing lat and lng parameters"
# }
```

**Test empty query in autocomplete:**
```bash
curl "$API_URL/autocomplete?query="
# Expected: 200 with empty suggestions
# {
#   "suggestions": []
# }
```

**Test short query in autocomplete:**
```bash
curl "$API_URL/autocomplete?query=b"
# Expected: 200 with empty suggestions
# {
#   "suggestions": []
# }
```

#### Step 8: Test Fallback Behavior
(Note: This requires temporarily disabling Foursquare API or using an invalid key)
```bash
# Simulate API key error by setting FOURSQUARE_API_KEY to invalid value
# Then:
curl "$API_URL/autocomplete?query=paris"
# Expected: fallback destinations returned
# {
#   "suggestions": [
#     { "name": "Kyoto", "country": "Japan", ... },
#     { "name": "Bangkok", "country": "Thailand", ... },
#     ...
#   ]
# }
```

---

## Task 12: SAM Template Verification

### Checklist

- [x] RecommendationsFunction defined in template.yaml
- [x] /autocomplete route configured
- [x] /venues route configured
- [x] FOURSQUARE_API_KEY parameter defined
- [x] FRONTEND_URL parameter defined
- [x] SharedLayer attached to function
- [x] Environment variables set
- [x] YAML validation passes: `sam validate --template infra/template.yaml`

### Verification Commands

```bash
# Validate YAML syntax
sam validate --template infra/template.yaml

# Check function definition
grep -A 15 "RecommendationsFunction:" infra/template.yaml

# Check API routes
grep -A 5 "/autocomplete" infra/template.yaml
grep -A 5 "/venues" infra/template.yaml

# Check parameters
grep "FoursquareApiKey:" infra/template.yaml
grep "FrontendUrl:" infra/template.yaml
```

### Known Issues & Resolutions

If YAML validation fails:
1. Check indentation (2 spaces per level)
2. Verify all quotes are matching
3. Ensure no tabs (only spaces)
4. Check for duplicate keys

---

## Task 13: Final Checklist & Deploy to Production

### Pre-Deployment Verification

- [ ] All code committed and pushed to `main`
  ```bash
  git status  # Should show "nothing to commit"
  ```

- [ ] Database migration ready
  ```bash
  ls -la infra/migrations/add_selected_venues.sql
  ```

- [ ] All Lambda functions have dependencies installed
  ```bash
  npm run install:all
  ```

- [ ] Frontend builds without errors
  ```bash
  cd frontend && npm run build
  # Check: dist/ directory is created with no errors
  ```

- [ ] No lint errors
  ```bash
  cd frontend && npm run lint 2>/dev/null || echo "No lint script"
  ```

### Production Database Migration

**Important:** Do this BEFORE deploying Lambda functions that use `selected_venues`

```bash
# 1. Verify you have access to production RDS
psql -h $PROD_DB_HOST -U wanderzen_admin -d wanderzenai -c "SELECT version();"

# 2. Run migration
psql -h $PROD_DB_HOST -U wanderzen_admin -d wanderzenai -f infra/migrations/add_selected_venues.sql

# 3. Verify column was added
psql -h $PROD_DB_HOST -U wanderzen_admin -d wanderzenai -c "\d submissions" | grep selected_venues
# Expected output: selected_venues | jsonb | default '{}'::jsonb
```

### Production Backend Deployment

```bash
# 1. Build Lambda functions
sam build

# 2. Deploy to production
sam deploy \
  --stack-name wanderzenai-stack \
  --region ap-southeast-2 \
  --parameter-overrides \
    Stage=prod \
    FoursquareApiKey=$FOURSQUARE_API_KEY \
    FrontendUrl=https://wanderzenai.com

# 3. Wait for deployment to complete (~5-10 minutes)
# Monitor CloudFormation stack in AWS Console or:
aws cloudformation describe-stacks \
  --stack-name wanderzenai-stack \
  --region ap-southeast-2 \
  --query "Stacks[0].StackStatus"
# Expected: CREATE_COMPLETE or UPDATE_COMPLETE
```

### Verify Production API Endpoints

```bash
API_URL=https://y44o2x9cu1.execute-api.ap-southeast-2.amazonaws.com/prod

# Test autocomplete
curl "$API_URL/autocomplete?query=bangkok"
# Expected: 200 with suggestions

# Test venues
curl "$API_URL/venues?destination=Bangkok&lat=13.7563&lng=100.5018"
# Expected: 200 with categories

# Test CORS
curl -H "Origin: https://wanderzenai.com" \
  -H "Access-Control-Request-Method: GET" \
  -X OPTIONS "$API_URL/autocomplete" -v
# Expected: 200 with CORS headers
```

### Production Frontend Deployment

```bash
# 1. Build frontend with production environment
cd frontend
VITE_API_URL=$API_URL VITE_STRIPE_PUBLISHABLE_KEY=$STRIPE_KEY npm run build

# 2. Sync to S3
aws s3 sync dist/ s3://wanderzenai-frontend-prod/

# 3. Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id E329HHUPH0JQTP \
  --paths "/*"

# 4. Verify deployment
curl https://wanderzenai.com
# Should load the app without errors
```

### Smoke Testing in Production

1. **Destination search:**
   - Visit https://wanderzenai.com/plan
   - Type "Barcelona"
   - Verify autocomplete shows results
   - Select a destination

2. **Venue selection:**
   - Verify 10 categories load
   - Select 3-4 venues
   - Click "Continue"

3. **Form completion:**
   - Fill in all form fields
   - Submit itinerary

4. **Email & PDF:**
   - Check email for itinerary PDF
   - Verify PDF contains selected venues

### Monitoring & Post-Deployment

```bash
# Monitor errors for first 24 hours
npm run logs:gen
npm run logs:pdf
npm run logs:email

# Check Foursquare API quota
# Visit Foursquare developer dashboard
# Verify usage is within expected limits

# Monitor database
psql -h $PROD_DB_HOST -U wanderzen_admin -d wanderzenai -c \
  "SELECT COUNT(*), MAX(created_at) FROM submissions;"
```

### Rollback Plan (If Issues)

If critical issues occur after deployment:

```bash
# 1. Disable API routes (temporary)
# Edit template.yaml, comment out /autocomplete and /venues routes
# Redeploy: sam deploy ...

# 2. Revert frontend (use CloudFront cache invalidation + old build)
aws s3 sync old-dist/ s3://wanderzenai-frontend-prod/
aws cloudfront create-invalidation --distribution-id E329HHUPH0JQTP --paths "/*"

# 3. Keep database migration (it's safe to leave selected_venues column)

# 4. Notify users if necessary
```

Rollback time: ~15 minutes

---

## Final Status

All 13 tasks completed:

1. ✅ Database migration created
2. ✅ Recommendations Lambda directory & package.json
3. ✅ Recommendations Lambda index.js (autocomplete + venues)
4. ✅ SAM template updated with recommendations Lambda
5. ✅ itinerary-gen Lambda modified for selected_venues
6. ✅ form-handler Lambda modified for selected_venues
7. ✅ DestinationSearch component created
8. ✅ VenueSelection component created
9. ✅ PlanTrip component updated with new flow
10. ✅ Integration tests created
11. ✅ Manual E2E testing procedures documented
12. ✅ SAM template verified
13. ✅ Deployment checklist completed

**Ready for production deployment!**
