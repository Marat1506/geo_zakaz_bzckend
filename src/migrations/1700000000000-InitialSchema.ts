import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable extensions
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis;`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    // Create enums
    await queryRunner.query(`
      CREATE TYPE "public"."user_role" AS ENUM('admin', 'superadmin', 'seller', 'customer');
    `);

    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "email" varchar NOT NULL UNIQUE,
        "password_hash" varchar NOT NULL,
        "role" "public"."user_role" NOT NULL DEFAULT 'customer',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // Create service_zones table
    await queryRunner.query(`
      CREATE TABLE "service_zones" (
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
    `);

    // Create menu_items table
    await queryRunner.query(`
      CREATE TABLE "menu_items" (
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
    `);

    // Create orders table
    await queryRunner.query(`
      CREATE TABLE "orders" (
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
    `);

    // Create order_items table
    await queryRunner.query(`
      CREATE TABLE "order_items" (
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
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX "idx_orders_order_number" ON "orders"("order_number");
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_orders_status" ON "orders"("status");
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_orders_created_at" ON "orders"("created_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "order_items";`);
    await queryRunner.query(`DROP TABLE "orders";`);
    await queryRunner.query(`DROP TABLE "menu_items";`);
    await queryRunner.query(`DROP TABLE "service_zones";`);
    await queryRunner.query(`DROP TABLE "users";`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS postgis;`);
  }
}
