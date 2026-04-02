import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeMenuItemZoneIdRequired1700000000013
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if zone_id column exists and is nullable
    const columnInfo = await queryRunner.query(`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'menu_items' AND column_name = 'zone_id'
    `);

    if (columnInfo.length && columnInfo[0].is_nullable === 'YES') {
      // Fill NULL zone_ids with the first available service zone
      await queryRunner.query(`
        UPDATE "menu_items"
          SET "zone_id" = (SELECT "id" FROM "service_zones" LIMIT 1)
          WHERE "zone_id" IS NULL
      `);

      // Set NOT NULL constraint
      await queryRunner.query(`
        ALTER TABLE "menu_items" ALTER COLUMN "zone_id" SET NOT NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert zone_id back to nullable
    const columnInfo = await queryRunner.query(`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'menu_items' AND column_name = 'zone_id'
    `);

    if (columnInfo.length && columnInfo[0].is_nullable === 'NO') {
      await queryRunner.query(`
        ALTER TABLE "menu_items" ALTER COLUMN "zone_id" DROP NOT NULL
      `);
    }
  }
}
