import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRolesAndBlockedToUsers1700000000010
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Columns are now handled in InitialSchema or are already correct
    // This migration is kept for history but made robust
    
    // Add is_blocked column if not exists
    const isBlockedExists = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'is_blocked'
    `);
    if (!isBlockedExists.length) {
      await queryRunner.query(`
        ALTER TABLE "users" ADD COLUMN "is_blocked" BOOLEAN NOT NULL DEFAULT false
      `);
    }

    // Add token_version column if not exists
    const tokenVersionExists = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'token_version'
    `);
    if (!tokenVersionExists.length) {
      await queryRunner.query(`
        ALTER TABLE "users" ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0
      `);
    }

    // Add name column if not exists
    const nameExists = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'name'
    `);
    if (!nameExists.length) {
      await queryRunner.query(`
        ALTER TABLE "users" ADD COLUMN "name" VARCHAR(100)
      `);
    }

    // Add phone column if not exists
    const phoneExists = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'phone'
    `);
    if (!phoneExists.length) {
      await queryRunner.query(`
        ALTER TABLE "users" ADD COLUMN "phone" VARCHAR(20)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove added columns (enum values cannot be removed in PostgreSQL)
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "is_blocked"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "token_version"`,
    );
    // Note: name and phone may have existed before this migration, skip dropping them
  }
}
