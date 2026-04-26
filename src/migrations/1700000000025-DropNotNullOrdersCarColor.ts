import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropNotNullOrdersCarColor1700000000025 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const columnInfo = await queryRunner.query(`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'orders'
        AND column_name = 'car_color'
    `);

    if (!columnInfo.length) {
      return;
    }

    if (columnInfo[0].is_nullable === 'NO') {
      await queryRunner.query(`
        ALTER TABLE "orders" ALTER COLUMN "car_color" DROP NOT NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const columnInfo = await queryRunner.query(`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'orders'
        AND column_name = 'car_color'
    `);

    if (!columnInfo.length) {
      return;
    }

    if (columnInfo[0].is_nullable === 'YES') {
      await queryRunner.query(`
        ALTER TABLE "orders" ALTER COLUMN "car_color" SET NOT NULL
      `);
    }
  }
}
