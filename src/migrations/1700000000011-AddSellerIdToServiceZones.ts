import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSellerIdToServiceZones1700000000011
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add seller_id column if not exists
    const sellerIdExists = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'service_zones' AND column_name = 'seller_id'
    `);
    if (!sellerIdExists.length) {
      await queryRunner.query(`
        ALTER TABLE "service_zones"
          ADD COLUMN "seller_id" UUID REFERENCES "users"("id") ON DELETE SET NULL
      `);
    }

    // Create index if not exists
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_service_zones_seller_id"
        ON "service_zones"("seller_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_service_zones_seller_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_zones" DROP COLUMN IF EXISTS "seller_id"`,
    );
  }
}
