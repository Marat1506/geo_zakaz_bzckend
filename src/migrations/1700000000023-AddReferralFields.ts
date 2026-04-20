import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddReferralFields1700000000023 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add slug for referral URLs
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'slug',
        type: 'varchar',
        length: '100',
        isNullable: true,
        isUnique: true,
        comment: 'Unique slug for referral URLs (e.g., /ref/seller-slug)',
      }),
    );

    // Add referral code
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'referral_code',
        type: 'varchar',
        length: '50',
        isNullable: true,
        isUnique: true,
        comment: 'Unique referral code for tracking',
      }),
    );

    // Add referral stats
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'referral_visits',
        type: 'int',
        default: 0,
        comment: 'Number of visits via referral link',
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'referral_orders',
        type: 'int',
        default: 0,
        comment: 'Number of orders via referral link',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'referral_orders');
    await queryRunner.dropColumn('users', 'referral_visits');
    await queryRunner.dropColumn('users', 'referral_code');
    await queryRunner.dropColumn('users', 'slug');
  }
}
