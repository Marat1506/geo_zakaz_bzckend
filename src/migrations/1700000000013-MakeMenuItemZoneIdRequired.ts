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
      // Do not auto-assign to an arbitrary zone; fail fast for manual correction.
      const [{ count: nullCount }] = await queryRunner.query(`
        SELECT COUNT(*)::int AS count
        FROM "menu_items"
        WHERE "zone_id" IS NULL
      `);

      if (Number(nullCount) > 0) {
        throw new Error(
          'Migration blocked: menu_items has rows with NULL zone_id. ' +
            'Please assign each menu item to a valid service zone before applying NOT NULL.',
        );
      }

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
