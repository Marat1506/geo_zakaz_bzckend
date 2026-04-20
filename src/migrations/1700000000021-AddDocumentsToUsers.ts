import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDocumentsToUsers1700000000021 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "passport_main_url" varchar,
        ADD COLUMN IF NOT EXISTS "passport_registration_url" varchar,
        ADD COLUMN IF NOT EXISTS "selfie_url" varchar
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "passport_main_url",
        DROP COLUMN IF EXISTS "passport_registration_url",
        DROP COLUMN IF EXISTS "selfie_url"
    `);
  }
}
