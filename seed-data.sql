-- Create admin user (password: admin123)
-- Password hash for 'admin123' with bcrypt
INSERT INTO users (email, password_hash, role)
VALUES ('admin@example.com', '$2b$10$iWW/L/saq4vuAwuCZJ3MUuRJGjqn1Pgo011zMDYUAMOjW1iDwzu42', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Create test service zone (circular)
INSERT INTO service_zones (name, type, center_lat, center_lng, radius_meters, active)
VALUES ('Main Parking Lot', 'circle', 40.7128, -74.0060, 500, true)
ON CONFLICT DO NOTHING
RETURNING id;

-- Get the zone ID (you'll need to replace this with actual ID after first insert)
DO $$
DECLARE
  zone_id_var uuid;
BEGIN
  SELECT id INTO zone_id_var FROM service_zones WHERE name = 'Main Parking Lot' LIMIT 1;
  
  -- Create menu items
  INSERT INTO menu_items (name, description, price, ready_now, available, preparation_time, zone_id)
  VALUES 
    ('Chicken Wrap', 'Grilled chicken with fresh vegetables', 8.99, true, true, 3, zone_id_var),
    ('Spicy Wrap', 'Spicy chicken with jalapeños', 9.99, true, true, 3, zone_id_var),
    ('Combo Meal', 'Wrap + Fries + Drink', 12.99, false, true, 10, zone_id_var),
    ('Veggie Wrap', 'Fresh vegetables with hummus', 7.99, false, true, 8, zone_id_var)
  ON CONFLICT DO NOTHING;
END $$;
