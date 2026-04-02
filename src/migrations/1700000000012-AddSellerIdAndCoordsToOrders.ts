import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSellerIdAndCoordsToOrders1700000000012
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add seller_id column if not exists
    const sellerIdExists = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = 'seller_id'
    `);
    if (!sellerIdExists.length) {
      await queryRunner.query(`
        ALTER TABLE "orders"
          ADD COLUMN "seller_id" UUID REFERENCES "users"("id")
      `);
    }

    // Add customer_lat column if not exists
    const customerLatExists = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = 'customer_lat'
    `);
    if (!customerLatExists.length) {
      await queryRunner.query(`
        ALTER TABLE "orders" ADD COLUMN "customer_lat" DECIMAL(10,7)
      `);
    }

    // Add customer_lng column if not exists
    const customerLngExists = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = 'customer_lng'
    `);
    if (!customerLngExists.length) {
      await queryRunner.query(`
        ALTER TABLE "orders" ADD COLUMN "customer_lng" DECIMAL(10,7)
      `);
    }

    // Create index if not exists
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_orders_seller_id" ON "orders"("seller_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_orders_seller_id"`);
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "seller_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "customer_lat"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "customer_lng"`,
    );
  }
}
