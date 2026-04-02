import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixMissingColumns1700000000020 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Fix User Status
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'users_status_enum') THEN
          CREATE TYPE "public"."users_status_enum" AS ENUM('pending', 'approved', 'rejected');
        END IF;
      END
      $$;
    `);

    const userStatusExists = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'status'
    `);
    if (!userStatusExists.length) {
      await queryRunner.query(`
        ALTER TABLE "users" ADD "status" "public"."users_status_enum" NOT NULL DEFAULT 'approved'
      `);
    }

    // 2. Fix ServiceZone Seller ID
    const serviceZoneSellerIdExists = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'service_zones' AND column_name = 'seller_id'
    `);
    if (!serviceZoneSellerIdExists.length) {
      await queryRunner.query(`
        ALTER TABLE "service_zones" ADD "seller_id" uuid
      `);
      await queryRunner.query(`
        ALTER TABLE "service_zones" ADD CONSTRAINT "FK_service_zones_seller" 
        FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE SET NULL
      `);
    }

    // 3. Fix MenuItem Zone ID
    const menuItemZoneIdExists = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'menu_items' AND column_name = 'zone_id'
    `);
    if (!menuItemZoneIdExists.length) {
      await queryRunner.query(`
        ALTER TABLE "menu_items" ADD "zone_id" uuid
      `);
      await queryRunner.query(`
        ALTER TABLE "menu_items" ADD CONSTRAINT "FK_menu_items_zone" 
        FOREIGN KEY ("zone_id") REFERENCES "service_zones"("id") ON DELETE CASCADE
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // We don't drop columns in down to be safe, but we could drop constraints
  }
}
