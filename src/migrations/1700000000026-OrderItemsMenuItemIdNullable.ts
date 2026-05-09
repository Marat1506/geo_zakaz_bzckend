import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * order_items.menu_item_id was NOT NULL while zone deletion sets it to NULL
 * to keep historical line rows after menu_items are removed.
 */
export class OrderItemsMenuItemIdNullable1700000000026 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows = await queryRunner.query(`
      SELECT tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_schema = kcu.constraint_schema
        AND tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = 'public'
        AND tc.table_name = 'order_items'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'menu_item_id'
    `);

    const constraintName = rows[0]?.constraint_name as string | undefined;
    if (constraintName) {
      await queryRunner.query(
        `ALTER TABLE "order_items" DROP CONSTRAINT "${constraintName}"`,
      );
    }

    await queryRunner.query(`
      ALTER TABLE "order_items" ALTER COLUMN "menu_item_id" DROP NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "order_items"
      ADD CONSTRAINT "order_items_menu_item_id_fkey"
      FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "order_items_menu_item_id_fkey"
    `);

    await queryRunner.query(`
      DELETE FROM "order_items" WHERE "menu_item_id" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "order_items" ALTER COLUMN "menu_item_id" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "order_items"
      ADD CONSTRAINT "order_items_menu_item_id_fkey"
      FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id")
    `);
  }
}
