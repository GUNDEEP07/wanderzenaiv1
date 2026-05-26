-- Populate Foursquare Categories Table
-- Run: psql -h <DB_HOST> -U wanderzen_admin -d wanderzenai -f migrations/populate_foursquare_categories.sql

-- Clear existing categories
DELETE FROM foursquare_categories;

-- Insert top-level categories
INSERT INTO foursquare_categories (id, name, label, parent_id) VALUES
('13000', 'food', 'Food', NULL),
('13001', 'restaurant', 'Restaurant', '13000'),
('13002', 'cafe', 'Cafe', '13000'),
('13003', 'coffee', 'Coffee Shop', '13000'),
('13004', 'bakery', 'Bakery', '13000'),
('13005', 'bar', 'Bar', '13000'),
('13006', 'nightlife', 'Nightlife Spot', NULL),
('13007', 'arts', 'Arts & Entertainment', NULL),
('13008', 'museum', 'Museum', '13007'),
('13009', 'gallery', 'Art Gallery', '13007'),
('13010', 'theater', 'Theater', '13007'),
('13011', 'cinema', 'Movie Theater', '13007'),
('13012', 'music', 'Music Venue', '13007'),
('13013', 'outdoors', 'Outdoors & Recreation', NULL),
('13014', 'park', 'Park', '13013'),
('13015', 'hiking', 'Hiking Trail', '13013'),
('13016', 'viewpoint', 'Viewpoint', '13013'),
('13017', 'beach', 'Beach', '13013'),
('13018', 'market', 'Market', '13000'),
('13019', 'shopping', 'Shopping', NULL),
('13020', 'temple', 'Temple', '13007'),
('13021', 'shrine', 'Shrine', '13007'),
('13022', 'historic', 'Historic Site', '13007'),
('13023', 'monument', 'Monument', '13007'),
('13024', 'accommodation', 'Accommodation', NULL),
('13025', 'hotel', 'Hotel', '13024'),
('13026', 'hostel', 'Hostel', '13024'),
('13027', 'guesthouse', 'Guesthouse', '13024'),
('13028', 'travel', 'Travel & Transport', NULL),
('13029', 'airport', 'Airport', '13028'),
('13030', 'train', 'Train Station', '13028'),
('13031', 'bus', 'Bus Station', '13028'),
('13032', 'professional', 'Professional & Public Services', NULL),
('13033', 'library', 'Library', '13032'),
('13034', 'university', 'University', '13032'),
('13035', 'school', 'School', '13032'),
('13036', 'hospital', 'Hospital', '13032'),
('13037', 'pharmacy', 'Pharmacy', '13032'),
('13038', 'wellness', 'Wellness', NULL),
('13039', 'spa', 'Spa', '13038'),
('13040', 'yoga', 'Yoga Studio', '13038'),
('13041', 'sports', 'Sports', '13013'),
('13042', 'gym', 'Gym', '13038'),
('13043', 'pool', 'Swimming Pool', '13013'),
('13044', 'playground', 'Playground', '13013'),
('13045', 'garden', 'Garden', '13013'),
('13046', 'botanical', 'Botanical Garden', '13013'),
('13047', 'zoo', 'Zoo', '13013'),
('13048', 'aquarium', 'Aquarium', '13007'),
('13049', 'amusement', 'Amusement Park', '13013'),
('13050', 'landmark', 'Landmark', '13007'),
('13051', 'bridge', 'Bridge', '13023'),
('13052', 'fountain', 'Fountain', '13013'),
('13053', 'sculpture', 'Sculpture', '13007'),
('13054', 'street', 'Street', NULL),
('13055', 'square', 'Plaza', NULL),
('13056', 'religious', 'Religious Site', '13007'),
('13057', 'church', 'Church', '13056'),
('13058', 'mosque', 'Mosque', '13056'),
('13059', 'synagogue', 'Synagogue', '13056'),
('13060', 'buddhist', 'Buddhist Temple', '13056'),
('13061', 'hindu', 'Hindu Temple', '13056');

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_foursquare_categories_name ON foursquare_categories(name);
CREATE INDEX IF NOT EXISTS idx_foursquare_categories_parent ON foursquare_categories(parent_id);

COMMIT;
