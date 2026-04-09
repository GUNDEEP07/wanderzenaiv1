'use strict';

const { getDB, ok, log } = require('/opt/nodejs/index');

const FALLBACK = [
  { id: 'kyoto-japan',        destination: 'Kyoto',        country: 'Japan',       continent: 'asia',     styles: ['cultural','nature','wellness'],   budget_range: 'mid',    amadeus_score: 94, trending_rank: 1, foursquare_tip: 'Go before 8am — monks walking, mist on the canal, zero crowds',          top_places: ['Nanzenji','Arashiyama','Fushimi Inari'], avg_nightly_rate: '$60-120', image_url: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=600&h=400&fit=crop' },
  { id: 'oaxaca-mexico',      destination: 'Oaxaca',       country: 'Mexico',      continent: 'americas', styles: ['cultural','foodie','relaxation'],  budget_range: 'budget', amadeus_score: 88, trending_rank: 2, foursquare_tip: 'Mercado de Abastos on Saturdays — where locals actually shop',             top_places: ['Monte Alban','Tlacolula Market','Hierve el Agua'], avg_nightly_rate: '$25-45', image_url: 'https://images.unsplash.com/photo-1518638150340-f706e86654de?w=600&h=400&fit=crop' },
  { id: 'matera-italy',       destination: 'Matera',       country: 'Italy',       continent: 'europe',   styles: ['cultural','nature','relaxation'], budget_range: 'mid',    amadeus_score: 91, trending_rank: 3, foursquare_tip: 'Walk the sassi after 9pm — lit up and almost no tourists',                  top_places: ['Sassi di Matera','Murgia Plateau','Casa Noha'], avg_nightly_rate: '$60-120', image_url: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=600&h=400&fit=crop' },
  { id: 'tbilisi-georgia',    destination: 'Tbilisi',      country: 'Georgia',     continent: 'asia',     styles: ['cultural','foodie','adventure'],   budget_range: 'budget', amadeus_score: 86, trending_rank: 4, foursquare_tip: 'Fabrika creative space on weekday mornings — locals not tourists',          top_places: ['Old Town','Narikala Fortress','Mtatsminda'], avg_nightly_rate: '$25-45', image_url: 'https://images.unsplash.com/photo-1601974984960-4e1d498e3b2f?w=600&h=400&fit=crop' },
  { id: 'chefchaouen-morocco',destination: 'Chefchaouen',  country: 'Morocco',     continent: 'africa',   styles: ['cultural','relaxation','nature'],  budget_range: 'budget', amadeus_score: 89, trending_rank: 5, foursquare_tip: 'Hike to the Spanish mosque at sunset — empty, golden light, best views',  top_places: ['Blue Medina','Ras el Maa','Kasbah Museum'], avg_nightly_rate: '$25-45', image_url: 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=600&h=400&fit=crop' },
  { id: 'ubud-indonesia',     destination: 'Ubud',         country: 'Indonesia',   continent: 'asia',     styles: ['nature','wellness','cultural'],    budget_range: 'budget', amadeus_score: 87, trending_rank: 6, foursquare_tip: 'Campuhan Ridge Walk at 6am — rice paddies, mist, completely empty paths',  top_places: ['Tegalalang Terrace','Monkey Forest','Tirta Empul'], avg_nightly_rate: '$25-45', image_url: 'https://images.unsplash.com/photo-1539635278303-d4002c07eae3?w=600&h=400&fit=crop' },
  { id: 'ella-sri-lanka',     destination: 'Ella',         country: 'Sri Lanka',   continent: 'asia',     styles: ['nature','adventure','relaxation'], budget_range: 'budget', amadeus_score: 83, trending_rank: 7, foursquare_tip: 'Nine Arch Bridge at dawn — trains pass twice before 8am, golden light',    top_places: ['Nine Arch Bridge','Little Adam\'s Peak','Ella Rock'], avg_nightly_rate: '$25-45', image_url: 'https://images.unsplash.com/photo-1553526665-dbfe31a25a55?w=600&h=400&fit=crop' },
  { id: 'lake-bled-slovenia', destination: 'Lake Bled',    country: 'Slovenia',    continent: 'europe',   styles: ['nature','adventure','relaxation'], budget_range: 'mid',    amadeus_score: 90, trending_rank: 8, foursquare_tip: 'Ojstrica viewpoint at sunrise — whole lake to yourself, 20min hike',       top_places: ['Bled Island','Vintgar Gorge','Bled Castle'], avg_nightly_rate: '$60-120', image_url: 'https://images.unsplash.com/photo-1587974928442-77dc3e0dba72?w=600&h=400&fit=crop' },
  { id: 'salento-colombia',   destination: 'Salento',      country: 'Colombia',    continent: 'americas', styles: ['nature','adventure','cultural'],   budget_range: 'budget', amadeus_score: 82, trending_rank: 9, foursquare_tip: 'Cocora Valley early morning — wax palms in mist, condors overhead',          top_places: ['Cocora Valley','Coffee Farms','Filandia'], avg_nightly_rate: '$25-45', image_url: 'https://images.unsplash.com/photo-1576019280693-5a56c25d8dc6?w=600&h=400&fit=crop' },
  { id: 'petra-jordan',       destination: 'Petra',        country: 'Jordan',      continent: 'mideast',  styles: ['cultural','adventure','nature'],   budget_range: 'mid',    amadeus_score: 95, trending_rank: 10, foursquare_tip: 'Treasury by candlelight on Tuesday nights — silence, stars, no crowds',  top_places: ['Treasury','Monastery','High Place of Sacrifice'], avg_nightly_rate: '$60-120', image_url: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=600&h=400&fit=crop' },
  { id: 'zanzibar-tanzania',  destination: 'Zanzibar',     country: 'Tanzania',    continent: 'africa',   styles: ['nature','relaxation','cultural'],  budget_range: 'mid',    amadeus_score: 85, trending_rank: 11, foursquare_tip: 'Stone Town spice market at 7am — before tour groups, real vendors',       top_places: ['Stone Town','Nungwi Beach','Jozani Forest'], avg_nightly_rate: '$60-120', image_url: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=600&h=400&fit=crop' },
  { id: 'meteora-greece',     destination: 'Meteora',      country: 'Greece',      continent: 'europe',   styles: ['cultural','nature','adventure'],   budget_range: 'mid',    amadeus_score: 92, trending_rank: 12, foursquare_tip: 'Varlaam Monastery at opening time 9am — monks still in morning prayer', top_places: ['Great Meteoron','Varlaam Monastery','Kalambaka'], avg_nightly_rate: '$60-120', image_url: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=600&h=400&fit=crop' },
];

const stylesMatch = (destStyles, filterStyles) =>
  !filterStyles?.length || filterStyles.some(s => destStyles.includes(s));

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.FRONTEND_URL || '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
    },
    body: '',
  };

  const p          = event.queryStringParameters || {};
  const continent  = p.continent || null;
  const styles     = p.style ? p.style.split(',').map(s => s.trim().toLowerCase()) : [];
  const budget     = p.budget  || null;
  const limit      = Math.min(parseInt(p.limit || '6', 10), 12);

  log.info('Recommendations request', { continent, styles, budget, limit });

  const db = getDB();
  try {
    const conditions = ['expires_at > NOW()'];
    const values = [];
    let i = 1;
    if (continent) { conditions.push(`continent = $${i++}`); values.push(continent); }
    if (budget)    { conditions.push(`budget_range = $${i++}`); values.push(budget); }
    if (styles.length) { conditions.push(`styles && $${i++}::text[]`); values.push(styles); }

    const result = await db.query(`
      SELECT id, destination, country, continent, styles, budget_range,
             amadeus_score, trending_rank, foursquare_tip, top_places,
             avg_nightly_rate, image_url, cached_at
      FROM recommendations_cache
      WHERE ${conditions.join(' AND ')}
      ORDER BY amadeus_score DESC, trending_rank ASC
      LIMIT $${i}
    `, [...values, limit]);

    const destinations = result.rows.length > 0
      ? result.rows
      : FALLBACK
          .filter(d => (!continent || d.continent === continent))
          .filter(d => (!budget    || d.budget_range === budget))
          .filter(d => stylesMatch(d.styles, styles))
          .slice(0, limit);

    return ok({
      destinations,
      cached_at: result.rows[0]?.cached_at || new Date().toISOString(),
      source: result.rows.length > 0 ? 'cache' : 'fallback',
    });

  } catch (err) {
    log.error('Query failed, returning fallback', { error: err.message });
    return ok({
      destinations: FALLBACK
        .filter(d => (!continent || d.continent === continent))
        .filter(d => (!budget    || d.budget_range === budget))
        .filter(d => stylesMatch(d.styles, styles))
        .slice(0, limit),
      cached_at: new Date().toISOString(),
      source: 'fallback',
    });
  }
};
