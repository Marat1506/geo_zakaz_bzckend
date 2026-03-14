import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCategoryToMenuItem1700000000001
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'menu_items',
      new TableColumn({
        name: 'category',
        type: 'varchar',
        length: '50',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('menu_items', 'category');
  }
}
