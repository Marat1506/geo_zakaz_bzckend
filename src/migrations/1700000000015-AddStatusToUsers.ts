import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStatusToUsers1700000000015 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create status enum if not exists
        await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'users_status_enum') THEN
          CREATE TYPE "public"."users_status_enum" AS ENUM('pending', 'approved', 'rejected');
        END IF;
      END
      $$;
    `);

        // Add status column if not exists
        const statusColumnExists = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'status'
    `);

        if (!statusColumnExists.length) {
            await queryRunner.query(`
        ALTER TABLE "users" ADD "status" "public"."users_status_enum" NOT NULL DEFAULT 'approved'
      `);
        }

        // Ensure all existing users (admins, customers) are approved
        await queryRunner.query(`
      UPDATE "users" SET "status" = 'approved' WHERE "status" IS NULL OR "status" = 'pending' AND "role" != 'seller'
    `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "status"`);
        // Note: pg_type 'users_status_enum' is not dropped to avoid errors if other tables use it
    }
}
