import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class MakeOrderZoneIdNullable1700000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.changeColumn(
      'orders',
      'zone_id',
      new TableColumn({
        name: 'zone_id',
        type: 'uuid',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.changeColumn(
      'orders',
      'zone_id',
      new TableColumn({
        name: 'zone_id',
        type: 'uuid',
        isNullable: false,
      }),
    );
  }
}
