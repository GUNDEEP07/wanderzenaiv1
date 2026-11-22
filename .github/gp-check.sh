#!/bin/bash
# Run real WanderZenAI places through Places API (New) Text Search. Key comes from env K; never printed.
set +e
Q=(
"Onsen Hot Pools|Queenstown, New Zealand"
"Sherwood|Queenstown, New Zealand"
"Bob's Cove Track|Queenstown, New Zealand"
"Glenorchy Cafe (The GY Cafe)|Glenorchy, New Zealand"
"Sawpit Gully Trail|Arrowtown, New Zealand"
"Arrow River Bridges Trail e-bike hire|Arrowtown, New Zealand"
"Aosta|Arrowtown, New Zealand"
"Milford Road Merchant|Te Anau, New Zealand"
"Redcliff Cafe|Te Anau, New Zealand"
"Miles Better Pies|Te Anau, New Zealand"
"Te Anau Glowworm Caves|Te Anau, New Zealand"
"Moke Lake|Queenstown, New Zealand"
"Lake Hayes walkway|Queenstown, New Zealand"
"Queenstown Gardens|Queenstown, New Zealand"
"Kea Cafe|Te Anau, New Zealand"
"Lions Park|Te Anau, New Zealand"
"Henry's Park|Te Anau, New Zealand"
"Te Anau Bird Sanctuary|Te Anau, New Zealand"
"Fergbaker|Queenstown, New Zealand"
"Marble Mountains|Da Nang, Vietnam"
)
FM='places.id,places.displayName,places.formattedAddress,places.businessStatus,places.rating,places.userRatingCount,places.primaryTypeDisplayName,places.googleMapsUri,places.regularOpeningHours.weekdayDescriptions,places.photos.name,places.location'
for row in "${Q[@]}"; do
  name="${row%%|*}"; town="${row##*|}"
  body=$(jq -nc --arg q "$name, $town" '{textQuery:$q, pageSize:1}')
  r=$(curl -s -X POST https://places.googleapis.com/v1/places:searchText -H "Content-Type: application/json" -H "X-Goog-Api-Key: $K" -H "X-Goog-FieldMask: $FM" -d "$body")
  echo "$r" | jq -c --arg asked "$name ($town)" '{asked:$asked, err:.error.status, got:.places[0].displayName.text, type:.places[0].primaryTypeDisplayName.text, status:.places[0].businessStatus, rating:.places[0].rating, reviews:.places[0].userRatingCount, addr:.places[0].formattedAddress, hours:(.places[0].regularOpeningHours.weekdayDescriptions[0] // null), photos:(.places[0].photos|length? // 0)}'
done
echo "== discovery: what Google ranks for slow-travel queries"
for q in "scenic walks near Queenstown New Zealand" "local cafes Te Anau" "hidden gems Arrowtown"; do
  body=$(jq -nc --arg q "$q" '{textQuery:$q, pageSize:6}')
  curl -s -X POST https://places.googleapis.com/v1/places:searchText -H "Content-Type: application/json" -H "X-Goog-Api-Key: $K" -H "X-Goog-FieldMask: places.displayName,places.rating,places.userRatingCount,places.primaryTypeDisplayName,places.businessStatus" -d "$body" \
   | jq -r --arg q "$q" '"-- " + $q, (.places[]? | "   " + .displayName.text + " · " + ((.primaryTypeDisplayName.text)//"?") + " · " + ((.rating|tostring)//"-") + "★ (" + ((.userRatingCount|tostring)//"0") + ") " + ((.businessStatus)//""))'
done
echo "== one photo (Onsen Hot Pools): media URL works?"
PN=$(curl -s -X POST https://places.googleapis.com/v1/places:searchText -H "Content-Type: application/json" -H "X-Goog-Api-Key: $K" -H "X-Goog-FieldMask: places.photos" -d '{"textQuery":"Moke Lake Queenstown","pageSize":1}' | jq -r '.places[0].photos[0].name // empty')
A=$(curl -s -X POST https://places.googleapis.com/v1/places:searchText -H "Content-Type: application/json" -H "X-Goog-Api-Key: $K" -H "X-Goog-FieldMask: places.photos" -d '{"textQuery":"Moke Lake Queenstown","pageSize":1}' | jq -r '.places[0].photos[0].authorAttributions[0].displayName // empty')
curl -s -L -o photo_moke.jpg "https://places.googleapis.com/v1/$PN/media?maxWidthPx=800&key=$K"; file photo_moke.jpg | cut -c1-120; echo "photo by: $A"
