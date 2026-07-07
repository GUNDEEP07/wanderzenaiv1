-- Sample blog posts for WanderZenAI
-- Insert these posts to populate the blog with initial content

INSERT INTO blog_posts (
  user_id, author_email, title, description, content, location, country, category,
  thumbnail_url, status, published_at, created_at, updated_at
) VALUES
(
  '00000000-0000-0000-0000-000000000001',
  'wanderer@wanderzenai.com',
  'Lost in Kyoto''s Hidden Tea Houses',
  'Discover the quiet tea houses tucked away in Kyoto''s backstreets where locals spend their mornings.',
  'Kyoto taught me that the best travel experiences happen when you abandon the guidebook. I spent my mornings wandering the narrow streets behind Nanzenji Temple, where tourists rarely venture. Each morning started at 5:30 AM—not because I'm an early riser, but because that''s when the monks begin their rounds and the tea houses open their sliding doors.

There''s something magical about stepping into a century-old tea house when you''re the only customer. The owner, Yuki-san, would prepare matcha the way it''s meant to be made—slowly, ceremonially, without rushing. She''d tell stories about her grandmother who opened this same shop in 1952.

The cost? A few dollars for the best matcha I''ve ever tasted and a memory that''ll last forever. This is what slow travel means to me—not seeing more, but experiencing deeper.',
  'Kyoto, Japan',
  'Japan',
  'culture',
  'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=600&h=400&fit=crop&auto=format',
  'published',
  NOW() - INTERVAL '7 days',
  NOW() - INTERVAL '7 days',
  NOW() - INTERVAL '7 days'
),
(
  '00000000-0000-0000-0000-000000000002',
  'wanderer@wanderzenai.com',
  'Hiking the Faroe Islands: Empty Trails, Silent Cliffs',
  'Explore dramatic landscapes and discover why the Faroe Islands are a hidden gem for slow travelers.',
  'The Faroe Islands aren''t crowded. That alone should tell you everything you need to know. I arrived in late September when summer crowds had left but winter hadn''t arrived—perfect timing for mountain trails.

The hike from Gásadalur to Mykines took 4 hours and I didn''t encounter another soul. Just me, the wind, and cliffs that seemed to touch the clouds. The trail winds through valleys where sheep graze freely, past waterfalls that appear suddenly around corners, and through mist so thick you can barely see your hands.

What struck me most wasn''t the dramatic scenery (though it''s stunning), but the silence. Complete silence. No car sounds, no hotel noise, no other hikers chattering. Just the wind and your own thoughts. This is what you travel for—those moments where the world feels untouched.',
  'Gásadalur, Mykines',
  'Faroe Islands',
  'adventure',
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&h=400&fit=crop&auto=format',
  'published',
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '5 days'
),
(
  '00000000-0000-0000-0000-000000000001',
  'wanderer@wanderzenai.com',
  'Oaxaca on $25 a Day: Street Food Diaries',
  'How to eat like a local in Mexico''s most culinary-rich state without breaking the bank.',
  'I moved through Oaxaca''s markets like a kid in a candy store, but with more reasonable prices. In Mercado Benito Juárez, I discovered that the best meals never cost more than $2-3.

The first discovery: mole negro from Doña Rosa''s stall. A dark, complex sauce that she''d been perfecting for 30 years. I watched her add ingredients I couldn''t identify, each one stirred with the precision of someone who''s made the same dish thousands of times. A bowl of this with fresh tortillas? $1.50.

Then came the tlayudas—crispy, topped with beans, cheese, and whatever you want. The vendor would assemble it while you waited, each one a work of art. And the juices. Fresh orange juice squeezed by hand while you watched, the pulp falling into your cup. 50 cents.

My favorite discovery was eating where the locals eat. Not in tourist restaurants with English menus, but in the comedores—tiny, unmarked places where abuelitas cook food like you''re family. A full meal here costs $2-3 and tastes like it cost $30. This is food travel done right.',
  'Oaxaca City',
  'Mexico',
  'food',
  'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=600&h=400&fit=crop&auto=format',
  'published',
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '3 days'
),
(
  '00000000-0000-0000-0000-000000000003',
  'wanderer@wanderzenai.com',
  'Budget Travel Tips: Southeast Asia on a Shoestring',
  'Practical advice for traveling through Thailand, Vietnam, and Cambodia without overspending.',
  'I spent 4 weeks traveling through Southeast Asia on less than $1000. Here''s exactly how:

Accommodation: Skip the tourist hotels. Stay in guesthouses run by families in residential neighborhoods. You''ll pay $8-12 per night and wake up to real street life. Chiang Mai, Hanoi, and Siem Reap all have cheap options if you look beyond TripAdvisor.

Food: Eat where you see locals eating. If there''s a queue, there''s a reason. Street food in Thailand rarely costs more than 50 cents. A full meal at a local restaurant? $1.50 maximum.

Transport: Buy a local SIM card ($3-5) and use Grab (Southeast Asia''s Uber). It''s cheaper than taxis and negotiating tuk-tuks. Long distance buses between cities cost $5-8.

Activities: Skip the elephant tourism and overpriced tours. Walk around neighborhoods, hike to temples, explore markets. The best experiences cost nothing.

The secret isn''t finding deals—it''s traveling like a local, not like a tourist.',
  'Southeast Asia',
  'Multiple',
  'budget',
  'https://images.unsplash.com/photo-1552394007-fab6dca89f6d?w=600&h=400&fit=crop&auto=format',
  'published',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days'
),
(
  '00000000-0000-0000-0000-000000000002',
  'wanderer@wanderzenai.com',
  'Wellness Retreats in Bali: Beyond the Yoga Mats',
  'Finding genuine wellness experiences in Bali away from the Instagram-friendly tourist spots.',
  'Bali has become synonymous with wellness tourism, but most of it is performative. I spent time finding the real thing.

The retreat I found wasn''t advertised on Instagram. It was a small family compound in Ubud where a woman named Ketut taught traditional Balinese healing practices. No Instagram photos, no hashtags, just genuine work.

She explained that wellness in Bali isn''t about hot yoga classes and green smoothies. It''s about understanding your body''s energy, respecting the land, and moving slowly. We spent mornings in rice fields, afternoons learning about local herbs, and evenings meditating in temples.

The cost? $30 per day including meals. It was more transformative than any $5000 wellness retreat I''ve read about.

If you''re going to Bali for wellness, skip the resort spas and find a local guide who can connect you with real practitioners. That''s where the magic is.',
  'Ubud, Bali',
  'Indonesia',
  'wellness',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=400&fit=crop&auto=format',
  'published',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day'
);

-- Update user IDs to reflect that these are from the system
-- The UUIDs above are placeholders; update them to match actual user IDs in your system if needed
