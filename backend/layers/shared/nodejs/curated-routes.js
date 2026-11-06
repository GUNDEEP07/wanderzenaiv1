'use strict';

/**
 * Hand-curated slow-travel routes for the launch countries (route first, option B —
 * confirmed by Gundeep, Nov 6 2026). DRAFT: travel times and day splits are being
 * reviewed in Notion ("Curated routes — review"); correct them HERE, the Notion page is
 * generated from this file (scripts/curated-routes-to-markdown.mjs).
 *
 * Each route:
 *   id, name, summary, kidFriendly (short transfers, no overnight legs),
 *   bases: [{ name, region, lat, lng, weight (share of the days), why, stayType,
 *             transferIn: { mode, hours, note } | null, dayTrips: [names] }]
 * `hours` is door-to-door for the realistic option a slow traveller would take.
 * A base may appear twice (e.g. Hanoi → Sapa → Hanoi) — each visit is its own stop.
 */

const T = (mode, hours, note) => ({ mode, hours, note: note || null });

const COUNTRIES = {
  vietnam: {
    name: 'Vietnam',
    aliases: ['vietnam', 'viet nam'],
    routes: [
      {
        id: 'vn-north-centre',
        name: 'Classic north + centre',
        summary: 'Hanoi’s old quarter, rice terraces around Sapa, then lanterns and beaches in Hoi An.',
        kidFriendly: false,
        bases: [
          { name: 'Hanoi', region: 'Hanoi', lat: 21.0285, lng: 105.8542, weight: 2, why: 'Old Quarter mornings, street food, Hoan Kiem lake walks.', stayType: 'small boutique hotel in the Old Quarter', transferIn: null, dayTrips: ['Ninh Binh (Tam Coc)', 'Duong Lam village'] },
          { name: 'Sapa', region: 'Lao Cai', lat: 22.3364, lng: 103.8438, weight: 2.5, why: 'Terraced valleys and village walks with local guides.', stayType: 'family homestay in Ta Van or Lao Chai', transferIn: T('bus', 5.5, 'Limousine bus on the expressway; the overnight train to Lao Cai is the alternative'), dayTrips: ['Ta Van & Lao Chai walk', 'Cat Cat village'] },
          { name: 'Hanoi', region: 'Hanoi', lat: 21.0285, lng: 105.8542, weight: 1, why: 'A night back in the city before flying south.', stayType: 'same hotel as before', transferIn: T('bus', 5.5), dayTrips: [] },
          { name: 'Hoi An', region: 'Quang Nam', lat: 15.8801, lng: 108.338, weight: 3.5, why: 'Cycle through rice fields, tailors, An Bang beach, slow evenings by the river.', stayType: 'garden homestay among the rice fields', transferIn: T('flight', 2.5, 'Hanoi → Da Nang 1 h 20, then 45 min by car'), dayTrips: ['My Son ruins at sunrise', 'Cam Thanh coconut village'] },
        ],
      },
      {
        id: 'vn-central-easy',
        name: 'Central coast, easy pace',
        summary: 'One region, short hops: beach mornings in Da Nang, old-town Hoi An, imperial Hue over the Hai Van pass.',
        kidFriendly: true,
        bases: [
          { name: 'Da Nang', region: 'Da Nang', lat: 16.0544, lng: 108.2022, weight: 2, why: 'Easy arrival, long sandy beach, Son Tra peninsula.', stayType: 'beachside guesthouse on My Khe', transferIn: null, dayTrips: ['Marble Mountains', 'Son Tra peninsula'] },
          { name: 'Hoi An', region: 'Quang Nam', lat: 15.8801, lng: 108.338, weight: 4, why: 'Bikes, lanterns, cooking class in a garden village.', stayType: 'villa homestay with a pool near the rice fields', transferIn: T('car', 0.75), dayTrips: ['Tra Que vegetable village', 'Cham Islands (calm months)'] },
          { name: 'Hue', region: 'Thua Thien Hue', lat: 16.4637, lng: 107.5909, weight: 3, why: 'Citadel, royal tombs by bike, Perfume River.', stayType: 'garden house on the river', transferIn: T('car', 2.5, 'Over the Hai Van pass with photo stops'), dayTrips: ['Tu Duc & Minh Mang tombs', 'Thuy Bieu village'] },
        ],
      },
      {
        id: 'vn-north-slow',
        name: 'The north, slowly',
        summary: 'Stay in the north and skip flights: Hanoi, the karst rivers of Ninh Binh, and a night on quieter Lan Ha Bay.',
        kidFriendly: true,
        bases: [
          { name: 'Hanoi', region: 'Hanoi', lat: 21.0285, lng: 105.8542, weight: 3, why: 'Old Quarter, coffee culture, West Lake by bike.', stayType: 'small boutique hotel in the Old Quarter', transferIn: null, dayTrips: ['Bat Trang ceramic village'] },
          { name: 'Ninh Binh', region: 'Ninh Binh', lat: 20.2506, lng: 105.9745, weight: 3, why: 'Rowing boats through karst caves, cycling between rice paddies.', stayType: 'bungalow homestay in Tam Coc', transferIn: T('car', 2), dayTrips: ['Trang An boat ride', 'Hang Mua viewpoint at sunrise'] },
          { name: 'Lan Ha Bay', region: 'Cat Ba, Hai Phong', lat: 20.7270, lng: 107.0470, weight: 2, why: 'Kayaking among limestone islands, fewer boats than Ha Long.', stayType: 'eco-lodge on Cat Ba island', transferIn: T('car', 3, 'Car + short ferry'), dayTrips: ['Kayak to Viet Hai village'] },
        ],
      },
    ],
  },

  japan: {
    name: 'Japan',
    aliases: ['japan', 'nippon'],
    routes: [
      {
        id: 'jp-kyoto-alps-coast',
        name: 'Kyoto, the Alps and the Sea of Japan',
        summary: 'Temples at dawn in Kyoto, an old merchant town in the mountains, then gardens and seafood in Kanazawa.',
        kidFriendly: true,
        bases: [
          { name: 'Kyoto', region: 'Kyoto', lat: 35.0116, lng: 135.7681, weight: 4, why: 'Quiet temples before 8am, northern hills, Philosopher’s Path.', stayType: 'machiya townhouse guesthouse', transferIn: null, dayTrips: ['Kurama & Kibune', 'Ohara', 'Nara'] },
          { name: 'Takayama', region: 'Gifu', lat: 36.1461, lng: 137.2522, weight: 3, why: 'Morning markets, Edo-era streets, Hida beef.', stayType: 'family-run ryokan', transferIn: T('train', 3.5, 'Via Nagoya on the scenic Hida line'), dayTrips: ['Shirakawa-go', 'Hida-Furukawa'] },
          { name: 'Kanazawa', region: 'Ishikawa', lat: 36.5613, lng: 136.6562, weight: 3, why: 'Kenroku-en, geisha districts, Omicho market.', stayType: 'small inn in Higashi Chaya', transferIn: T('bus', 2.25), dayTrips: ['Noto peninsula', 'Kaga onsen'] },
        ],
      },
      {
        id: 'jp-tokyo-hakone-kyoto',
        name: 'Tokyo, Hakone and Kyoto',
        summary: 'A gentle first trip: Tokyo neighbourhoods, a hot-spring night in Hakone, then Kyoto.',
        kidFriendly: true,
        bases: [
          { name: 'Tokyo', region: 'Tokyo', lat: 35.6762, lng: 139.6503, weight: 3, why: 'Yanaka and Kichijoji over Shibuya; parks and small museums.', stayType: 'small hotel in Yanaka or Kuramae', transferIn: null, dayTrips: ['Kamakura', 'Mt Takao'] },
          { name: 'Hakone', region: 'Kanagawa', lat: 35.2324, lng: 139.1069, weight: 2, why: 'Onsen, lake, ropeway views of Fuji on clear days.', stayType: 'ryokan with a private bath', transferIn: T('train', 1.5, 'Romancecar from Shinjuku'), dayTrips: ['Lake Ashi loop', 'Old Tokaido road walk'] },
          { name: 'Kyoto', region: 'Kyoto', lat: 35.0116, lng: 135.7681, weight: 4, why: 'Temples at dawn, Arashiyama away from the crowds.', stayType: 'machiya townhouse guesthouse', transferIn: T('train', 2.5, 'Odawara → Kyoto by shinkansen'), dayTrips: ['Nara', 'Uji'] },
        ],
      },
      {
        id: 'jp-kyushu-onsen',
        name: 'Kyushu hot-spring towns',
        summary: 'Fewer tourists: Fukuoka food stalls, the onsen village of Yufuin and Kurokawa’s riverside baths.',
        kidFriendly: true,
        bases: [
          { name: 'Fukuoka', region: 'Fukuoka', lat: 33.5904, lng: 130.4017, weight: 2, why: 'Yatai food stalls, easy airport, Ohori park.', stayType: 'small hotel in Tenjin', transferIn: null, dayTrips: ['Dazaifu'] },
          { name: 'Yufuin', region: 'Oita', lat: 33.2656, lng: 131.3690, weight: 3, why: 'Lake Kinrin mist at dawn, private onsen.', stayType: 'ryokan with an open-air bath', transferIn: T('train', 2.25, 'Yufuin no Mori limited express'), dayTrips: ['Beppu hells'] },
          { name: 'Kurokawa Onsen', region: 'Kumamoto', lat: 33.0807, lng: 131.1442, weight: 3, why: 'Riverside bath-hopping in a village with no neon.', stayType: 'traditional ryokan', transferIn: T('bus', 2), dayTrips: ['Mt Aso caldera'] },
        ],
      },
    ],
  },

  india: {
    name: 'India',
    aliases: ['india', 'bharat'],
    routes: [
      {
        id: 'in-kerala',
        name: 'Kerala: coast, backwaters, tea hills',
        summary: 'Fort Kochi’s lanes, a slow day on the backwaters, then cool tea estates in Munnar.',
        kidFriendly: true,
        bases: [
          { name: 'Fort Kochi', region: 'Kerala', lat: 9.9658, lng: 76.2421, weight: 3, why: 'Colonial lanes, Chinese nets at sunset, Kathakali.', stayType: 'heritage homestay', transferIn: null, dayTrips: ['Kumbalangi village'] },
          { name: 'Alleppey', region: 'Kerala', lat: 9.4981, lng: 76.3388, weight: 2, why: 'Canoe (not a big houseboat) through the narrow canals.', stayType: 'lakeside homestay', transferIn: T('car', 1.5), dayTrips: ['Kuttanad canoe trip'] },
          { name: 'Munnar', region: 'Kerala', lat: 10.0889, lng: 77.0595, weight: 3, why: 'Tea estate walks, misty mornings, spice gardens.', stayType: 'plantation bungalow', transferIn: T('car', 4.5, 'Winding hill road — stop at the waterfalls'), dayTrips: ['Kolukkumalai sunrise', 'Top Station'] },
        ],
      },
      {
        id: 'in-himachal',
        name: 'Himachal: Kangra valley to Manali',
        summary: 'Tibetan culture in McLeod Ganj, paragliding country in Bir, apple orchards in old Manali.',
        kidFriendly: false,
        bases: [
          { name: 'Dharamshala', region: 'Himachal Pradesh', lat: 32.2190, lng: 76.3234, weight: 3, why: 'McLeod Ganj monasteries, Triund trail.', stayType: 'mountain guesthouse in Dharamkot', transferIn: null, dayTrips: ['Triund', 'Norbulingka'] },
          { name: 'Bir', region: 'Himachal Pradesh', lat: 32.0441, lng: 76.7246, weight: 3, why: 'Tea gardens, monasteries, tandem paragliding from Billing.', stayType: 'mud-house homestay', transferIn: T('car', 1.5), dayTrips: ['Billing', 'Baijnath temple'] },
          { name: 'Manali', region: 'Himachal Pradesh', lat: 32.2396, lng: 77.1887, weight: 3, why: 'Old Manali orchards, Solang valley, cedar forests.', stayType: 'orchard cottage in Old Manali', transferIn: T('car', 5), dayTrips: ['Naggar castle', 'Solang valley'] },
        ],
      },
      {
        id: 'in-rajasthan-south',
        name: 'Southern Rajasthan, slowly',
        summary: 'Lakes of Udaipur, the great wall of Kumbhalgarh, and the blue city of Jodhpur.',
        kidFriendly: true,
        bases: [
          { name: 'Udaipur', region: 'Rajasthan', lat: 24.5854, lng: 73.7125, weight: 3, why: 'Lake palaces, old-city havelis, sunset boat.', stayType: 'lakeside haveli', transferIn: null, dayTrips: ['Eklingji & Nagda'] },
          { name: 'Kumbhalgarh', region: 'Rajasthan', lat: 25.1486, lng: 73.5870, weight: 2, why: 'Walk the fort walls, Aravalli villages.', stayType: 'country lodge', transferIn: T('car', 2.5), dayTrips: ['Ranakpur temple'] },
          { name: 'Jodhpur', region: 'Rajasthan', lat: 26.2389, lng: 73.0243, weight: 3, why: 'Mehrangarh fort, blue lanes, stepwells.', stayType: 'haveli guesthouse below the fort', transferIn: T('car', 3.5), dayTrips: ['Bishnoi villages'] },
        ],
      },
    ],
  },

  thailand: {
    name: 'Thailand',
    aliases: ['thailand'],
    routes: [
      {
        id: 'th-north',
        name: 'The quiet north',
        summary: 'Old-city temples in Chiang Mai, caves and forest in Chiang Dao, tea hills near Chiang Rai.',
        kidFriendly: true,
        bases: [
          { name: 'Chiang Mai', region: 'Chiang Mai', lat: 18.7883, lng: 98.9853, weight: 4, why: 'Temples, markets, cooking classes, Doi Suthep.', stayType: 'garden guesthouse in the old city', transferIn: null, dayTrips: ['Doi Inthanon', 'Mae Kampong village'] },
          { name: 'Chiang Dao', region: 'Chiang Mai', lat: 19.3644, lng: 98.9647, weight: 2, why: 'Limestone caves, birdwatching, mountain views.', stayType: 'eco bungalow', transferIn: T('car', 1.5), dayTrips: ['Chiang Dao cave'] },
          { name: 'Chiang Rai', region: 'Chiang Rai', lat: 19.9105, lng: 99.8406, weight: 3, why: 'White and Blue temples early, tea plantations.', stayType: 'riverside homestay', transferIn: T('car', 2.5), dayTrips: ['Doi Mae Salong tea'] },
        ],
      },
      {
        id: 'th-andaman-easy',
        name: 'Andaman coast, easy',
        summary: 'Krabi’s cliffs and then a long, unhurried stay on Koh Lanta.',
        kidFriendly: true,
        bases: [
          { name: 'Krabi (Ao Nang)', region: 'Krabi', lat: 8.0360, lng: 98.8250, weight: 3, why: 'Railay by longtail, island hopping on calm days.', stayType: 'small resort near Klong Muang', transferIn: null, dayTrips: ['Railay', 'Hong islands'] },
          { name: 'Koh Lanta', region: 'Krabi', lat: 7.6243, lng: 99.0790, weight: 5, why: 'Long quiet beaches, old town on stilts, mangroves.', stayType: 'beach bungalow on Klong Nin', transferIn: T('car', 2.5, 'Van with two short car ferries'), dayTrips: ['Mu Ko Lanta national park', 'Koh Rok (snorkel)'] },
        ],
      },
      {
        id: 'th-west-isaan',
        name: 'Rivers and national parks',
        summary: 'Bangkok’s canals, the River Kwai in Kanchanaburi, wildlife in Khao Yai.',
        kidFriendly: true,
        bases: [
          { name: 'Bangkok', region: 'Bangkok', lat: 13.7563, lng: 100.5018, weight: 2, why: 'Thonburi canals by boat, old town, night markets.', stayType: 'riverside guesthouse', transferIn: null, dayTrips: ['Bang Krachao green lung by bike'] },
          { name: 'Kanchanaburi', region: 'Kanchanaburi', lat: 14.0228, lng: 99.5328, weight: 3, why: 'River rafts, Erawan falls, wartime history.', stayType: 'floating raft house', transferIn: T('car', 2.5), dayTrips: ['Erawan falls'] },
          { name: 'Khao Yai', region: 'Nakhon Ratchasima', lat: 14.4390, lng: 101.3720, weight: 3, why: 'Gibbons, hornbills, waterfalls, vineyards.', stayType: 'farm stay near the park', transferIn: T('car', 4), dayTrips: ['Khao Yai night safari'] },
        ],
      },
    ],
  },

  'sri lanka': {
    name: 'Sri Lanka',
    aliases: ['sri lanka', 'srilanka', 'ceylon'],
    routes: [
      {
        id: 'lk-hills-coast',
        name: 'Hill country to the south coast',
        summary: 'Kandy, the famous train into the tea hills of Ella, then the south coast.',
        kidFriendly: false,
        bases: [
          { name: 'Kandy', region: 'Central Province', lat: 7.2906, lng: 80.6337, weight: 2, why: 'Temple of the Tooth, botanical gardens.', stayType: 'hillside guesthouse', transferIn: null, dayTrips: ['Peradeniya gardens'] },
          { name: 'Ella', region: 'Uva Province', lat: 6.8667, lng: 81.0466, weight: 3, why: 'Little Adam’s Peak, Nine Arch bridge, tea walks.', stayType: 'tea-estate homestay', transferIn: T('train', 7, 'Scenic train — book observation seats; 4 h by car instead'), dayTrips: ['Lipton’s Seat'] },
          { name: 'Mirissa', region: 'Southern Province', lat: 5.9483, lng: 80.4716, weight: 3, why: 'Quiet beaches, whale season Nov–Apr.', stayType: 'beach villa', transferIn: T('car', 4), dayTrips: ['Galle fort'] },
        ],
      },
      {
        id: 'lk-cultural-easy',
        name: 'Cultural triangle, short hops',
        summary: 'Rock fortresses and village life around Sigiriya, then Kandy — no long journeys.',
        kidFriendly: true,
        bases: [
          { name: 'Negombo', region: 'Western Province', lat: 7.2008, lng: 79.8737, weight: 1, why: 'Easy first night near the airport, lagoon.', stayType: 'lagoon guesthouse', transferIn: null, dayTrips: [] },
          { name: 'Sigiriya', region: 'Central Province', lat: 7.9570, lng: 80.7603, weight: 3, why: 'Pidurangala at sunrise, cave temples, elephants at Minneriya.', stayType: 'jungle eco-lodge', transferIn: T('car', 3.5), dayTrips: ['Dambulla caves', 'Minneriya safari'] },
          { name: 'Kandy', region: 'Central Province', lat: 7.2906, lng: 80.6337, weight: 3, why: 'Lake walks, spice gardens on the way.', stayType: 'hillside guesthouse', transferIn: T('car', 2.5), dayTrips: ['Knuckles range walk'] },
        ],
      },
      {
        id: 'lk-south-slow',
        name: 'South coast, unhurried',
        summary: 'Galle fort and then quiet beaches near Tangalle.',
        kidFriendly: true,
        bases: [
          { name: 'Galle', region: 'Southern Province', lat: 6.0329, lng: 80.2168, weight: 4, why: 'Fort ramparts at sunset, cafés, cinnamon island.', stayType: 'villa inside the fort', transferIn: null, dayTrips: ['Koggala lake'] },
          { name: 'Tangalle', region: 'Southern Province', lat: 6.0240, lng: 80.7941, weight: 4, why: 'Empty beaches, Mulkirigala rock temple.', stayType: 'beach cabana', transferIn: T('car', 1.5), dayTrips: ['Udawalawe safari'] },
        ],
      },
    ],
  },

  indonesia: {
    name: 'Indonesia',
    aliases: ['indonesia'],
    routes: [
      {
        id: 'id-bali-east',
        name: 'Bali, the quiet east',
        summary: 'Ubud’s rice fields, the Sidemen valley, and snorkelling off Amed.',
        kidFriendly: true,
        bases: [
          { name: 'Ubud', region: 'Bali', lat: -8.5069, lng: 115.2625, weight: 4, why: 'Rice-field walks, Campuhan ridge, craft villages.', stayType: 'villa in the rice fields outside town', transferIn: null, dayTrips: ['Tirta Empul', 'Sayan ridge walk'] },
          { name: 'Sidemen', region: 'Bali', lat: -8.4802, lng: 115.4419, weight: 3, why: 'Terraced valley with views of Mt Agung, weaving villages.', stayType: 'valley homestay', transferIn: T('car', 1.5), dayTrips: ['Tirta Gangga'] },
          { name: 'Amed', region: 'Bali', lat: -8.3364, lng: 115.6544, weight: 3, why: 'Black-sand fishing villages, reef snorkelling from the beach.', stayType: 'beach bungalow', transferIn: T('car', 1.5), dayTrips: ['Tulamben wreck'] },
        ],
      },
      {
        id: 'id-bali-gili',
        name: 'Ubud and the Gili islands',
        summary: 'Rice terraces, then car-free island time on Gili Air.',
        kidFriendly: false,
        bases: [
          { name: 'Ubud', region: 'Bali', lat: -8.5069, lng: 115.2625, weight: 5, why: 'Rice-field walks, temples, cooking classes.', stayType: 'villa in the rice fields', transferIn: null, dayTrips: ['Tegallalang early'] },
          { name: 'Gili Air', region: 'Lombok', lat: -8.3570, lng: 116.0820, weight: 4, why: 'No cars, turtles on the reef, sunset swings.', stayType: 'beach bungalow', transferIn: T('ferry', 4, 'Car to Padang Bai + fast boat; can be rough'), dayTrips: ['Snorkel tour of the three Gilis'] },
        ],
      },
      {
        id: 'id-java-bali',
        name: 'Temples of Java, then Bali',
        summary: 'Borobudur at dawn from Yogyakarta, then Ubud.',
        kidFriendly: true,
        bases: [
          { name: 'Yogyakarta', region: 'Special Region of Yogyakarta', lat: -7.7956, lng: 110.3695, weight: 4, why: 'Borobudur and Prambanan, batik workshops, village cycling.', stayType: 'joglo guesthouse', transferIn: null, dayTrips: ['Borobudur sunrise', 'Prambanan'] },
          { name: 'Ubud', region: 'Bali', lat: -8.5069, lng: 115.2625, weight: 4, why: 'Rice fields, craft villages, slow mornings.', stayType: 'villa in the rice fields', transferIn: T('flight', 3, '1 h 15 flight to Denpasar + 1.5 h car'), dayTrips: ['Sidemen valley'] },
        ],
      },
    ],
  },

  nepal: {
    name: 'Nepal',
    aliases: ['nepal'],
    routes: [
      {
        id: 'np-classic',
        name: 'Kathmandu, Pokhara and Bandipur',
        summary: 'Valley temples, lakeside Pokhara with Himalayan views, and the car-free hill town of Bandipur.',
        kidFriendly: true,
        bases: [
          { name: 'Kathmandu (Patan)', region: 'Bagmati', lat: 27.6727, lng: 85.3240, weight: 2, why: 'Patan Durbar Square, courtyards, quieter than Thamel.', stayType: 'heritage guesthouse in Patan', transferIn: null, dayTrips: ['Bhaktapur', 'Boudhanath at dusk'] },
          { name: 'Pokhara', region: 'Gandaki', lat: 28.2096, lng: 83.9856, weight: 4, why: 'Phewa lake, Sarangkot sunrise, short hikes.', stayType: 'lakeside guesthouse away from the main strip', transferIn: T('flight', 1, '25 min flight; the bus takes 7 h'), dayTrips: ['Australian Camp hike', 'World Peace Pagoda'] },
          { name: 'Bandipur', region: 'Gandaki', lat: 27.9365, lng: 84.4097, weight: 2, why: 'Newari hill town, ridge walks, mountain views.', stayType: 'old merchant house inn', transferIn: T('car', 2.5), dayTrips: ['Siddha cave'] },
        ],
      },
      {
        id: 'np-valley-slow',
        name: 'Kathmandu valley, slowly',
        summary: 'No flights or long drives: Patan, medieval Bhaktapur and a sunrise from Nagarkot.',
        kidFriendly: true,
        bases: [
          { name: 'Kathmandu (Patan)', region: 'Bagmati', lat: 27.6727, lng: 85.3240, weight: 3, why: 'Courtyards, metalwork studios, museum.', stayType: 'heritage guesthouse', transferIn: null, dayTrips: ['Swayambhunath'] },
          { name: 'Bhaktapur', region: 'Bagmati', lat: 27.6710, lng: 85.4298, weight: 2, why: 'Pottery square, juju dhau, evening rituals.', stayType: 'Newari house guesthouse', transferIn: T('car', 0.75), dayTrips: ['Changu Narayan walk'] },
          { name: 'Nagarkot', region: 'Bagmati', lat: 27.7172, lng: 85.5200, weight: 2, why: 'Himalayan sunrise, pine-forest trails.', stayType: 'ridge lodge', transferIn: T('car', 1), dayTrips: ['Nagarkot to Dhulikhel walk'] },
        ],
      },
      {
        id: 'np-chitwan-pokhara',
        name: 'Jungle and lakes',
        summary: 'Kathmandu, then rhinos in Chitwan and lakeside Pokhara.',
        kidFriendly: false, // Chitwan → Pokhara is ~5 h by road
        bases: [
          { name: 'Kathmandu (Patan)', region: 'Bagmati', lat: 27.6727, lng: 85.3240, weight: 2, why: 'Easy arrival, old Patan.', stayType: 'heritage guesthouse', transferIn: null, dayTrips: ['Bhaktapur'] },
          { name: 'Chitwan', region: 'Bagmati', lat: 27.5291, lng: 84.3542, weight: 3, why: 'Canoe and jungle walks, Tharu villages.', stayType: 'eco-lodge on the park edge', transferIn: T('flight', 1.5, '25 min flight to Bharatpur + transfer; 5–6 h by road'), dayTrips: ['Canoe on the Rapti'] },
          { name: 'Pokhara', region: 'Gandaki', lat: 28.2096, lng: 83.9856, weight: 3, why: 'Lake, paragliding, short hikes.', stayType: 'lakeside guesthouse', transferIn: T('car', 5), dayTrips: ['Begnas lake'] },
        ],
      },
    ],
  },

  italy: {
    name: 'Italy',
    aliases: ['italy', 'italia'],
    routes: [
      {
        id: 'it-puglia',
        name: 'Puglia, town to town',
        summary: 'Sea-cliff Polignano, white Ostuni among olive groves, baroque Lecce — all within an hour of each other.',
        kidFriendly: true,
        bases: [
          { name: 'Polignano a Mare', region: 'Puglia', lat: 40.9952, lng: 17.2190, weight: 3, why: 'Cliffs and coves, 40 minutes from Bari airport.', stayType: 'apartment in the old town', transferIn: null, dayTrips: ['Alberobello trulli', 'Monopoli'] },
          { name: 'Ostuni', region: 'Puglia', lat: 40.7290, lng: 17.5776, weight: 3, why: 'Masserie, olive groves, Valle d’Itria towns.', stayType: 'masseria (farm stay)', transferIn: T('car', 1), dayTrips: ['Cisternino', 'Locorotondo'] },
          { name: 'Lecce', region: 'Puglia', lat: 40.3515, lng: 18.1750, weight: 3, why: 'Baroque centre, Salento beaches.', stayType: 'palazzo B&B', transferIn: T('car', 1), dayTrips: ['Otranto', 'Gallipoli'] },
        ],
      },
      {
        id: 'it-tuscany',
        name: 'Tuscany beyond Florence',
        summary: 'Florence, then cypress hills in Val d’Orcia and walled Lucca.',
        kidFriendly: true,
        bases: [
          { name: 'Florence', region: 'Tuscany', lat: 43.7696, lng: 11.2558, weight: 2, why: 'Oltrarno workshops, early Uffizi.', stayType: 'small B&B in Oltrarno', transferIn: null, dayTrips: ['Fiesole'] },
          { name: 'Pienza', region: 'Tuscany', lat: 43.0766, lng: 11.6786, weight: 4, why: 'Val d’Orcia drives, pecorino, hot springs at Bagno Vignoni.', stayType: 'agriturismo', transferIn: T('car', 2), dayTrips: ['Montepulciano', 'Bagno Vignoni'] },
          { name: 'Lucca', region: 'Tuscany', lat: 43.8429, lng: 10.5027, weight: 3, why: 'Cycle the walls, Garfagnana villages.', stayType: 'B&B inside the walls', transferIn: T('car', 2.5), dayTrips: ['Barga', 'Pietrasanta'] },
        ],
      },
      {
        id: 'it-dolomites',
        name: 'Dolomites',
        summary: 'Alpine meadows and huts from Val Gardena and Cortina.',
        kidFriendly: true,
        bases: [
          { name: 'Bolzano', region: 'South Tyrol', lat: 46.4983, lng: 11.3548, weight: 2, why: 'Arcaded old town, Ötzi museum, Renon plateau.', stayType: 'small hotel in the old town', transferIn: null, dayTrips: ['Renon earth pyramids'] },
          { name: 'Ortisei', region: 'South Tyrol', lat: 46.5747, lng: 11.6714, weight: 4, why: 'Seceda and Alpe di Siusi walks, woodcarving village.', stayType: 'family-run alpine guesthouse', transferIn: T('car', 1), dayTrips: ['Alpe di Siusi', 'Seceda'] },
          { name: 'Cortina d’Ampezzo', region: 'Veneto', lat: 46.5405, lng: 12.1357, weight: 3, why: 'Tre Cime loop, Lago di Sorapis.', stayType: 'mountain chalet', transferIn: T('car', 2, 'Over the Sella or Gardena pass'), dayTrips: ['Tre Cime di Lavaredo', 'Lago di Braies'] },
        ],
      },
    ],
  },

  portugal: {
    name: 'Portugal',
    aliases: ['portugal'],
    routes: [
      {
        id: 'pt-alentejo',
        name: 'Lisbon and the Alentejo',
        summary: 'Lisbon’s hills, Roman Évora, then the wild Alentejo coast.',
        kidFriendly: true,
        bases: [
          { name: 'Lisbon', region: 'Lisbon', lat: 38.7223, lng: -9.1393, weight: 3, why: 'Alfama mornings, trams, viewpoints.', stayType: 'apartment in Graça or Alfama', transferIn: null, dayTrips: ['Sintra (early)', 'Cascais coast'] },
          { name: 'Évora', region: 'Alentejo', lat: 38.5714, lng: -7.9135, weight: 2, why: 'Roman temple, cork forests, wine estates.', stayType: 'quinta outside town', transferIn: T('car', 1.5), dayTrips: ['Monsaraz', 'Almendres cromlech'] },
          { name: 'Vila Nova de Milfontes', region: 'Alentejo', lat: 37.7253, lng: -8.7830, weight: 3, why: 'Rota Vicentina clifftop walks, river beaches.', stayType: 'small guesthouse', transferIn: T('car', 2), dayTrips: ['Fishermen’s Trail', 'Zambujeira do Mar'] },
        ],
      },
      {
        id: 'pt-north',
        name: 'Porto, the Douro and the Minho',
        summary: 'Porto, terraced vineyards in the Douro valley, and green Ponte de Lima.',
        kidFriendly: true,
        bases: [
          { name: 'Porto', region: 'Norte', lat: 41.1579, lng: -8.6291, weight: 3, why: 'Ribeira, tiled churches, Foz by the sea.', stayType: 'guesthouse in Miragaia', transferIn: null, dayTrips: ['Guimarães'] },
          { name: 'Pinhão', region: 'Douro', lat: 41.1907, lng: -7.5465, weight: 3, why: 'Vineyard walks, river boats, quinta lunches.', stayType: 'wine quinta', transferIn: T('train', 2.5, 'Scenic Douro line from São Bento'), dayTrips: ['Casal de Loivos viewpoint'] },
          { name: 'Ponte de Lima', region: 'Minho', lat: 41.7673, lng: -8.5839, weight: 2, why: 'Roman bridge, Ecovia riverside cycling.', stayType: 'manor house (solar)', transferIn: T('car', 2.5), dayTrips: ['Peneda-Gerês national park'] },
        ],
      },
      {
        id: 'pt-coast',
        name: 'Lisbon to the Algarve, the quiet way',
        summary: 'Lisbon, the rice fields and dunes of Comporta, then the cliffs around Lagos.',
        kidFriendly: true,
        bases: [
          { name: 'Lisbon', region: 'Lisbon', lat: 38.7223, lng: -9.1393, weight: 2, why: 'Neighbourhood walks, pastéis, river light.', stayType: 'apartment in Graça', transferIn: null, dayTrips: ['Sintra'] },
          { name: 'Comporta', region: 'Alentejo', lat: 38.3807, lng: -8.7836, weight: 3, why: 'Wild beaches, storks, rice paddies.', stayType: 'cabana-style guesthouse', transferIn: T('car', 1.5), dayTrips: ['Carrasqueira stilt pier'] },
          { name: 'Lagos', region: 'Algarve', lat: 37.1028, lng: -8.6730, weight: 4, why: 'Ponta da Piedade by kayak, west-coast surf beaches.', stayType: 'guesthouse in the old town', transferIn: T('car', 2.5), dayTrips: ['Sagres', 'Seven Hanging Valleys trail'] },
        ],
      },
    ],
  },

  'new zealand': {
    name: 'New Zealand',
    aliases: ['new zealand', 'aotearoa', 'nz'],
    routes: [
      {
        id: 'nz-south-lakes',
        name: 'South Island lakes',
        summary: 'Dark-sky Tekapo, Wanaka’s lake walks, Queenstown’s mountains — no drive over 3 hours.',
        kidFriendly: true,
        bases: [
          { name: 'Christchurch', region: 'Canterbury', lat: -43.5321, lng: 172.6362, weight: 1, why: 'Easy arrival, botanic gardens.', stayType: 'B&B near Hagley Park', transferIn: null, dayTrips: ['Akaroa'] },
          { name: 'Lake Tekapo', region: 'Canterbury', lat: -44.0047, lng: 170.4770, weight: 2, why: 'Stargazing, lupins (Nov–Dec), Mt John walk.', stayType: 'lakeside cottage', transferIn: T('car', 3), dayTrips: ['Aoraki/Mt Cook Hooker Valley'] },
          { name: 'Wanaka', region: 'Otago', lat: -44.7032, lng: 169.1321, weight: 3, why: 'Roys Peak, lake cycling, Rob Roy glacier.', stayType: 'farm-stay cottage', transferIn: T('car', 3), dayTrips: ['Rob Roy glacier track'] },
          { name: 'Queenstown', region: 'Otago', lat: -45.0312, lng: 168.6626, weight: 3, why: 'Glenorchy road, Arrowtown, lake cruise.', stayType: 'Arrowtown cottage (quieter)', transferIn: T('car', 1), dayTrips: ['Glenorchy', 'Milford Sound (long day)'] },
        ],
      },
      {
        id: 'nz-north',
        name: 'North Island: coast and geothermal',
        summary: 'Coromandel beaches, Rotorua’s Māori culture and hot pools, Lake Taupō.',
        kidFriendly: true,
        bases: [
          { name: 'Auckland', region: 'Auckland', lat: -36.8485, lng: 174.7633, weight: 2, why: 'Waiheke ferry, west-coast beaches.', stayType: 'villa B&B in Ponsonby', transferIn: null, dayTrips: ['Waiheke island', 'Piha'] },
          { name: 'Hahei', region: 'Coromandel', lat: -36.8417, lng: 175.8000, weight: 3, why: 'Cathedral Cove, Hot Water Beach at low tide.', stayType: 'beach house', transferIn: T('car', 2.5), dayTrips: ['Cathedral Cove kayak'] },
          { name: 'Rotorua', region: 'Bay of Plenty', lat: -38.1368, lng: 176.2497, weight: 3, why: 'Redwoods, geothermal valleys, Māori hāngī.', stayType: 'lakeside lodge', transferIn: T('car', 3), dayTrips: ['Waimangu volcanic valley'] },
          { name: 'Taupō', region: 'Waikato', lat: -38.6857, lng: 176.0702, weight: 2, why: 'Huka falls, lake swims, Tongariro crossing (fit walkers).', stayType: 'lakefront cottage', transferIn: T('car', 1), dayTrips: ['Tongariro Alpine Crossing'] },
        ],
      },
      {
        id: 'nz-top-south',
        name: 'Top of the South',
        summary: 'Nelson’s sunshine, golden bays of Abel Tasman, and whales off Kaikōura.',
        kidFriendly: true,
        bases: [
          { name: 'Nelson', region: 'Nelson', lat: -41.2706, lng: 173.2840, weight: 2, why: 'Craft studios, Saturday market, beaches.', stayType: 'garden B&B', transferIn: null, dayTrips: ['Mapua wharf'] },
          { name: 'Marahau', region: 'Tasman', lat: -41.0067, lng: 173.0067, weight: 3, why: 'Abel Tasman coast track by water taxi and kayak.', stayType: 'eco-lodge at the park entrance', transferIn: T('car', 1), dayTrips: ['Abel Tasman water taxi + walk'] },
          { name: 'Kaikōura', region: 'Canterbury', lat: -42.4008, lng: 173.6811, weight: 3, why: 'Whales, seals, peninsula walkway.', stayType: 'coastal cottage', transferIn: T('car', 4.5), dayTrips: ['Peninsula walkway'] },
        ],
      },
    ],
  },
};

const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * The curated country for a destination the traveller chose, or null.
 * Only a country-level choice matches ("Vietnam", "Vietnam, Asia"); a city
 * ("Hanoi, Vietnam") is left to Claude, which may build the route around it.
 */
function findCountry(destination) {
  const first = norm(String(destination || '').split(',')[0]);
  if (!first) return null;
  for (const [key, c] of Object.entries(COUNTRIES)) {
    if (c.aliases.includes(first)) return { key, ...c };
  }
  return null;
}

/** The longest transfer of a route, in hours (0 for a single base). */
const longestTransfer = (bases) => Math.max(0, ...bases.map(b => b.transferIn?.hours || 0));

/**
 * Slow travel: how many stops a trip of this length can hold without rushing.
 * ≤4 days → 1 stop; then roughly one stop per 2.5 days (5 → 2, 7 → 3, 10 → 4).
 */
const maxStops = (days) => (days <= 4 ? 1 : Math.ceil(days / 2.5));

/**
 * Split `days` across a route's bases by weight (largest remainder, ≥1 each). When the
 * trip can't hold every stop, the route is cut short from the END — so each kept stop's
 * transfer still describes the journey from the stop before it.
 * @returns {object[]} bases with `days`
 */
function fitDays(bases, days) {
  const keep = bases.slice(0, Math.max(1, maxStops(days)));
  const total = keep.reduce((a, b) => a + b.weight, 0);
  const raw = keep.map(b => Math.max(1, (b.weight / total) * days));
  const out = raw.map(Math.floor);
  let left = days - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) out[order[k][1]]++;
  while (out.reduce((a, b) => a + b, 0) > days) {
    const i = out.indexOf(Math.max(...out));
    out[i]--;
  }
  return keep.map(({ weight, ...b }, i) => ({ ...b, days: out[i] }));
}

const COMFORT_HOURS = { short: 2.5, medium: 4.5, long: Infinity };

/**
 * Curated route options for a trip, best fits first.
 * @param {object} args { destination, days, prefs: { kids: number[], transferComfort, overnightOk } }
 * @returns {null | { country: string, options: object[] }} null when the country isn't curated
 */
function curatedOptions({ destination, days, prefs = {} }) {
  const country = findCountry(destination);
  if (!country) return null;
  const withKids = Array.isArray(prefs.kids) && prefs.kids.length > 0;
  const limit = COMFORT_HOURS[prefs.transferComfort] ?? COMFORT_HOURS.medium;

  const seen = new Set();
  const options = [];
  for (const r of country.routes) {
    const bases = fitDays(r.bases.map(b => ({
      ...b,
      country: country.name,
      dayTrips: (b.dayTrips || []).map(name => ({ name })),
    })), days);
    // Judge the route on the stops actually kept for this trip length.
    const key = bases.map(b => b.name).join('>');
    if (seen.has(key)) continue; // a short trip can cut two routes down to the same stops
    seen.add(key);
    const longest = longestTransfer(bases);
    const kidOk = r.kidFriendly || bases.length < r.bases.length && longest <= COMFORT_HOURS.short;
    const reasons = [];
    if (withKids && !kidOk) reasons.push('has a long or rough transfer for kids');
    if (longest > limit) reasons.push(`longest transfer is ~${longest} h`);
    const shortened = bases.length < r.bases.length;
    options.push({
      id: r.id,
      name: r.name,
      summary: shortened
        ? `${r.summary} (Shortened for ${days} days — the full route also visits ${r.bases.slice(bases.length).map(b => b.name).filter((n, i, a) => a.indexOf(n) === i).join(', ')}.)`
        : r.summary,
      source: 'curated',
      kidFriendly: kidOk,
      longestTransferHours: longest,
      fitsConstraints: reasons.length === 0,
      caution: reasons.length ? `Heads-up: ${reasons.join('; ')}.` : null,
      bases,
    });
  }
  options.sort((a, b) => (b.fitsConstraints - a.fitsConstraints) || (a.longestTransferHours - b.longestTransferHours));
  return { country: country.name, options };
}

/** All curated countries, for the destination chips. */
const CURATED_COUNTRIES = Object.values(COUNTRIES).map(c => c.name);

module.exports = { COUNTRIES, CURATED_COUNTRIES, findCountry, fitDays, maxStops, longestTransfer, curatedOptions };
