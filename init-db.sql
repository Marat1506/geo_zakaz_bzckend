-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "email" varchar NOT NULL UNIQUE,
  "password_hash" varchar NOT NULL,
  "role" varchar NOT NULL DEFAULT 'customer',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Create service_zones table
CREATE TABLE IF NOT EXISTS "service_zones" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name" varchar(100) NOT NULL,
  "type" varchar NOT NULL,
  "center_lat" decimal(10,7),
  "center_lng" decimal(10,7),
  "radius_meters" integer,
  "polygon_coordinates" jsonb,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Create menu_items table
CREATE TABLE IF NOT EXISTS "menu_items" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name" varchar(100) NOT NULL,
  "description" text,
  "price" decimal(10,2) NOT NULL,
  "image_url" varchar,
  "ready_now" boolean NOT NULL DEFAULT false,
  "available" boolean NOT NULL DEFAULT true,
  "preparation_time" integer NOT NULL,
  "zone_id" uuid,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  FOREIGN KEY ("zone_id") REFERENCES "service_zones"("id") ON DELETE SET NULL
);

-- Create orders table
CREATE TABLE IF NOT EXISTS "orders" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "order_number" varchar NOT NULL UNIQUE,
  "customer_id" varchar,
  "total_amount" decimal(10,2) NOT NULL,
  "status" varchar NOT NULL DEFAULT 'preparing',
  "payment_method" varchar NOT NULL,
  "payment_intent_id" varchar,
  "car_plate_number" varchar NOT NULL,
  "car_color" varchar,
  "parking_spot" varchar,
  "car_photo_url" varchar NOT NULL,
  "estimated_time" integer NOT NULL,
  "zone_id" uuid NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  FOREIGN KEY ("zone_id") REFERENCES "service_zones"("id")
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS "order_items" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "order_id" uuid NOT NULL,
  "menu_item_id" uuid NOT NULL,
  "menu_item_name" varchar NOT NULL,
  "quantity" integer NOT NULL,
  "price" decimal(10,2) NOT NULL,
  "subtotal" decimal(10,2) NOT NULL,
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE,
  FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_orders_order_number" ON "orders"("order_number");
CREATE INDEX IF NOT EXISTS "idx_orders_status" ON "orders"("status");
CREATE INDEX IF NOT EXISTS "idx_orders_created_at" ON "orders"("created_at");
