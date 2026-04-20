import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSellerProfileFields1700000000022 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add seller profile fields to users table
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'shop_name',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'shop_description',
        type: 'text',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'shop_logo',
        type: 'varchar',
        length: '500',
        isNullable: true,
        comment: 'Path to shop logo image',
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'contact_phone',
        type: 'varchar',
        length: '50',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'contact_email',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'contact_address',
        type: 'text',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'contact_address');
    await queryRunner.dropColumn('users', 'contact_email');
    await queryRunner.dropColumn('users', 'contact_phone');
    await queryRunner.dropColumn('users', 'shop_logo');
    await queryRunner.dropColumn('users', 'shop_description');
    await queryRunner.dropColumn('users', 'shop_name');
  }
}
