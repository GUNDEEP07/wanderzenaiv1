'use strict';

const { getDB, fetchFoursquareVenues, fetchAmadeusScore, log } = require('/opt/nodejs/index');

const DESTINATIONS = [
  { id: 'kyoto-japan',       destination: 'Kyoto',        country: 'Japan',       continent: 'asia',     styles: ['cultural','nature','wellness'],        budget_range: 'mid',    lat: 35.0116,  lng: 135.7681, image_url: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=600&h=400&fit=crop', top_places: ['Nanzenji','Arashiyama','Fushimi Inari','Philosopher\'s Path','Gion'] },
  { id: 'hoi-an-vietnam',    destination: 'Hoi An',       country: 'Vietnam',     continent: 'asia',     styles: ['cultural','foodie','relaxation'],      budget_range: 'budget', lat: 15.8800,  lng: 108.3380, image_url: 'https://images.unsplash.com/photo-1528127269322-539801943592?w=600&h=400&fit=crop', top_places: ['Ancient Town','Thu Bon River','An Bang Beach','Tra Que Village','My Son'] },
  { id: 'tbilisi-georgia',   destination: 'Tbilisi',      country: 'Georgia',     continent: 'asia',     styles: ['cultural','foodie','adventure'],       budget_range: 'budget', lat: 41.6938,  lng: 44.8015,  image_url: 'https://images.unsplash.com/photo-1601974984960-4e1d498e3b2f?w=600&h=400&fit=crop', top_places: ['Old Town','Narikala Fortress','Mtatsminda','Fabrika','Sighnaghi'] },
  { id: 'ubud-indonesia',    destination: 'Ubud',         country: 'Indonesia',   continent: 'asia',     styles: ['nature','wellness','cultural'],        budget_range: 'budget', lat: -8.5069,  lng: 115.2625, image_url: 'https://images.unsplash.com/photo-1539635278303-d4002c07eae3?w=600&h=400&fit=crop', top_places: ['Tegalalang Rice Terrace','Sacred Monkey Forest','Campuhan Ridge','Tirta Empul','Penglipuran'] },
  { id: 'ella-sri-lanka',    destination: 'Ella',         country: 'Sri Lanka',   continent: 'asia',     styles: ['nature','adventure','relaxation'],     budget_range: 'budget', lat: 6.8667,   lng: 81.0500,  image_url: 'https://images.unsplash.com/photo-1553526665-dbfe31a25a55?w=600&h=400&fit=crop', top_places: ['Little Adam\'s Peak','Nine Arch Bridge','Ella Rock','Ravana Falls','Mini World\'s End'] },
  { id: 'hampi-india',       destination: 'Hampi',        country: 'India',       continent: 'asia',     styles: ['cultural','adventure','nature'],       budget_range: 'budget', lat: 15.3350,  lng: 76.4600,  image_url: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&h=400&fit=crop', top_places: ['Virupaksha Temple','Vittala Temple','Hemakuta Hill','Matanga Hill','Hippie Island'] },
  { id: 'luang-prabang-laos',destination: 'Luang Prabang',country: 'Laos',        continent: 'asia',     styles: ['cultural','relaxation','nature'],      budget_range: 'budget', lat: 19.8900,  lng: 102.1350, image_url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=400&fit=crop', top_places: ['Kuang Si Falls','Mount Phousi','Wat Xieng Thong','Morning Alms','Pak Ou Caves'] },
  { id: 'matera-italy',      destination: 'Matera',       country: 'Italy',       continent: 'europe',   styles: ['cultural','nature','relaxation'],      budget_range: 'mid',    lat: 40.6664,  lng: 16.6043,  image_url: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=600&h=400&fit=crop', top_places: ['Sassi di Matera','Casa Noha','Madonna de Idris','Murgia Plateau','Caveoso'] },
  { id: 'kotor-montenegro',  destination: 'Kotor',        country: 'Montenegro',  continent: 'europe',   styles: ['cultural','nature','relaxation'],      budget_range: 'budget', lat: 42.4247,  lng: 18.7712,  image_url: 'https://images.unsplash.com/photo-1555990793-da11153b2473?w=600&h=400&fit=crop', top_places: ['Old Town Walls','St Tryphon Cathedral','Fortress of St John','Bay of Kotor','Perast'] },
  { id: 'evora-portugal',    destination: 'Evora',        country: 'Portugal',    continent: 'europe',   styles: ['cultural','relaxation','foodie'],      budget_range: 'budget', lat: 38.5714,  lng: -7.9122,  image_url: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=600&h=400&fit=crop', top_places: ['Roman Temple','Chapel of Bones','Almendres Cromlech','Giraldo Square','Alentejo wineries'] },
  { id: 'berat-albania',     destination: 'Berat',        country: 'Albania',     continent: 'europe',   styles: ['cultural','adventure','nature'],       budget_range: 'budget', lat: 40.7058,  lng: 19.9522,  image_url: 'https://images.unsplash.com/photo-1598300058816-b7cef6d4c90c?w=600&h=400&fit=crop', top_places: ['Berat Castle','Mangalem Quarter','Gorica Quarter','Ethnographic Museum','Osum Canyon'] },
  { id: 'lake-bled-slovenia',destination: 'Lake Bled',    country: 'Slovenia',    continent: 'europe',   styles: ['nature','adventure','relaxation'],     budget_range: 'mid',    lat: 46.3683,  lng: 14.1146,  image_url: 'https://images.unsplash.com/photo-1587974928442-77dc3e0dba72?w=600&h=400&fit=crop', top_places: ['Bled Island','Vintgar Gorge','Bled Castle','Ojstrica Viewpoint','Triglav NP'] },
  { id: 'meteora-greece',    destination: 'Meteora',      country: 'Greece',      continent: 'europe',   styles: ['cultural','nature','adventure'],       budget_range: 'mid',    lat: 39.7217,  lng: 21.6306,  image_url: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=600&h=400&fit=crop', top_places: ['Great Meteoron','Varlaam Monastery','Roussanou','Kalambaka','Kastraki Village'] },
  { id: 'chefchaouen-morocco',destination:'Chefchaouen',  country: 'Morocco',     continent: 'africa',   styles: ['cultural','relaxation','nature'],      budget_range: 'budget', lat: 35.1714,  lng: -5.2697,  image_url: 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=600&h=400&fit=crop', top_places: ['Blue Medina','Ras el Maa','Spanish Mosque','Kasbah Museum','Ain Tissimane'] },
  { id: 'lalibela-ethiopia', destination: 'Lalibela',     country: 'Ethiopia',    continent: 'africa',   styles: ['cultural','adventure','nature'],       budget_range: 'budget', lat: 12.0320,  lng: 39.0474,  image_url: 'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=600&h=400&fit=crop', top_places: ['Rock-Hewn Churches','Bete Giyorgis','Timkat Festival','Asheten Mariam','Yimrehane Kristos'] },
  { id: 'zanzibar-tanzania', destination: 'Zanzibar',     country: 'Tanzania',    continent: 'africa',   styles: ['nature','relaxation','cultural'],      budget_range: 'mid',    lat: -6.1659,  lng: 39.2026,  image_url: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=600&h=400&fit=crop', top_places: ['Stone Town','Nungwi Beach','Jozani Forest','Kendwa','Matemwe'] },
  { id: 'oaxaca-mexico',     destination: 'Oaxaca',       country: 'Mexico',      continent: 'americas', styles: ['cultural','foodie','relaxation'],      budget_range: 'budget', lat: 17.0732,  lng: -96.7266, image_url: 'https://images.unsplash.com/photo-1518638150340-f706e86654de?w=600&h=400&fit=crop', top_places: ['Monte Alban','Mercado Benito Juarez','Hierve el Agua','Tlacolula Market','Mitla'] },
  { id: 'salento-colombia',  destination: 'Salento',      country: 'Colombia',    continent: 'americas', styles: ['nature','adventure','cultural'],       budget_range: 'budget', lat: 4.6377,   lng: -75.5710, image_url: 'https://images.unsplash.com/photo-1576019280693-5a56c25d8dc6?w=600&h=400&fit=crop', top_places: ['Cocora Valley','Coffee Farms','La Serrana','Acaime Sanctuary','Filandia'] },
  { id: 'cusco-peru',        destination: 'Cusco',        country: 'Peru',        continent: 'americas', styles: ['cultural','adventure','nature'],       budget_range: 'budget', lat: -13.5319, lng: -71.9675, image_url: 'https://images.unsplash.com/photo-1526392060635-9d6019884377?w=600&h=400&fit=crop', top_places: ['Sacred Valley','Pisac Market','Chinchero','Moray','Maras Salt Mines'] },
  { id: 'patagonia-chile',   destination: 'Patagonia',    country: 'Chile',       continent: 'americas', styles: ['nature','adventure'],                  budget_range: 'mid',    lat: -50.9423, lng: -73.4068, image_url: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&h=400&fit=crop', top_places: ['Torres del Paine','Grey Glacier','Valle del Frances','Lago Pehoe','Mirador Las Torres'] },
  { id: 'blue-mountains-au', destination: 'Blue Mountains',country: 'Australia',  continent: 'oceania',  styles: ['nature','relaxation','adventure'],     budget_range: 'mid',    lat: -33.7089, lng: 150.3114, image_url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=400&fit=crop', top_places: ['Three Sisters','Wentworth Falls','Leura','Scenic World','Grand Canyon Walk'] },
  { id: 'abel-tasman-nz',    destination: 'Abel Tasman',  country: 'New Zealand', continent: 'oceania',  styles: ['nature','adventure','relaxation'],     budget_range: 'mid',    lat: -40.9260, lng: 172.9790, image_url: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600&h=400&fit=crop', top_places: ['Coastal Track','Anchorage Bay','Torrent Bay','Bark Bay','Awaroa'] },
  { id: 'petra-jordan',      destination: 'Petra',        country: 'Jordan',      continent: 'mideast',  styles: ['cultural','adventure','nature'],       budget_range: 'mid',    lat: 30.3285,  lng: 35.4444,  image_url: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=600&h=400&fit=crop', top_places: ['Treasury','Monastery','Siq','High Place of Sacrifice','Royal Tombs'] },
  { id: 'nizwa-oman',        destination: 'Nizwa',        country: 'Oman',        continent: 'mideast',  styles: ['cultural','nature','adventure'],       budget_range: 'mid',    lat: 22.9333,  lng: 57.5333,  image_url: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=600&h=400&fit=crop', top_places: ['Nizwa Fort','Nizwa Souk','Jebel Akhdar','Wadi Ghul','Bahla Fort'] },
];

const BUDGET_AVG_RATES = { budget: '$25-45', mid: '$60-120', luxury: '$150+' };

exports.handler = async () => {
  log.info('Weekly cache refresh started', { destinations: DESTINATIONS.length });
  const db = getDB();
  let updated = 0, failed = 0;

  for (const dest of DESTINATIONS) {
    try {
      log.info('Processing', { id: dest.id });
      const venues = await fetchFoursquareVenues(dest.destination);
      const foursquareTip = venues.length > 0
        ? venues.slice(0, 5).map(v => {
            const area = v.area ? `, ${v.area}` : '';
            const tastes = v.tastes?.length ? ` [${v.tastes.slice(0,2).join(', ')}]` : '';
            return `- ${v.name} (${v.category}${area})${tastes}`;
          }).join('\n')
        : null;
      const venuesJson = JSON.stringify(venues);
      const amadeusScore = await fetchAmadeusScore(dest.lat, dest.lng);

      await db.query(`
        INSERT INTO recommendations_cache
          (id, destination, country, continent, styles, budget_range,
           amadeus_score, trending_rank, foursquare_tip, top_places,
           avg_nightly_rate, image_url, venues_json, cached_at, expires_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW() + INTERVAL '7 days')
        ON CONFLICT (id) DO UPDATE SET
          amadeus_score    = EXCLUDED.amadeus_score,
          foursquare_tip   = EXCLUDED.foursquare_tip,
          top_places       = EXCLUDED.top_places,
          venues_json      = EXCLUDED.venues_json,
          avg_nightly_rate = EXCLUDED.avg_nightly_rate,
          cached_at        = NOW(),
          expires_at       = NOW() + INTERVAL '7 days'
      `, [
        dest.id, dest.destination, dest.country, dest.continent,
        dest.styles, dest.budget_range, amadeusScore, 0,
        foursquareTip, dest.top_places,
        BUDGET_AVG_RATES[dest.budget_range] || '$60-120', dest.image_url,
        venuesJson,
      ]);

      updated++;
      await new Promise(r => setTimeout(r, 300)); // rate limit buffer
    } catch (err) {
      failed++;
      log.error('Failed', { id: dest.id, error: err.message });
    }
  }

  log.info('Cache refresh complete', { updated, failed });
  return { updated, failed };
};
