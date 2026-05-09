import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { config } from 'dotenv';

config();

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'food_ordering',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: false,
});

async function seed() {
  await dataSource.initialize();

  console.log('Seeding database...');

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await dataSource.query(
    `
    INSERT INTO users (email, password_hash, role, email_verified_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (email) DO NOTHING
  `,
    ['admin@example.com', hashedPassword, 'admin'],
  );
  console.log('✓ Admin user created (email: admin@example.com, password: admin123)');

  // Create test service zone (circular)
  const zoneResult = await dataSource.query(
    `
    INSERT INTO service_zones (name, type, center_lat, center_lng, radius_meters, active)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
  `,
    ['Main Parking Lot', 'circle', 40.7128, -74.006, 500, true],
  );
  const zoneId = zoneResult[0].id;
  console.log('✓ Test service zone created');

  // Create menu items
  const menuItems = [
    {
      name: 'Chicken Wrap',
      description: 'Grilled chicken with fresh vegetables',
      price: 8.99,
      readyNow: true,
      preparationTime: 3,
    },
    {
      name: 'Spicy Wrap',
      description: 'Spicy chicken with jalapeños',
      price: 9.99,
      readyNow: true,
      preparationTime: 3,
    },
    {
      name: 'Combo Meal',
      description: 'Wrap + Fries + Drink',
      price: 12.99,
      readyNow: false,
      preparationTime: 10,
    },
    {
      name: 'Veggie Wrap',
      description: 'Fresh vegetables with hummus',
      price: 7.99,
      readyNow: false,
      preparationTime: 8,
    },
  ];

  for (const item of menuItems) {
    await dataSource.query(
      `
      INSERT INTO menu_items (name, description, price, ready_now, available, preparation_time, zone_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
      [
        item.name,
        item.description,
        item.price,
        item.readyNow,
        true,
        item.preparationTime,
        zoneId,
      ],
    );
  }
  console.log('✓ Menu items created');

  await dataSource.destroy();
  console.log('\nSeeding completed successfully!');
}

seed().catch((error) => {
  console.error('Error seeding database:', error);
  process.exit(1);
});
