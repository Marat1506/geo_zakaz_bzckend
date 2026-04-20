import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateReviewsTable1700000000024 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'reviews',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'menu_item_id',
            type: 'uuid',
            comment: 'ID of the menu item being reviewed',
          },
          {
            name: 'user_id',
            type: 'uuid',
            comment: 'ID of the user who wrote the review',
          },
          {
            name: 'order_id',
            type: 'uuid',
            isNullable: true,
            comment: 'ID of the order (optional, for verified purchases)',
          },
          {
            name: 'rating',
            type: 'int',
            comment: 'Rating from 1 to 5 stars',
          },
          {
            name: 'comment',
            type: 'text',
            isNullable: true,
            comment: 'Review text',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Foreign key to menu_items
    await queryRunner.createForeignKey(
      'reviews',
      new TableForeignKey({
        columnNames: ['menu_item_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'menu_items',
        onDelete: 'CASCADE',
      }),
    );

    // Foreign key to users
    await queryRunner.createForeignKey(
      'reviews',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    // Foreign key to orders (optional)
    await queryRunner.createForeignKey(
      'reviews',
      new TableForeignKey({
        columnNames: ['order_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'orders',
        onDelete: 'SET NULL',
      }),
    );

    // Add index for faster queries
    await queryRunner.query(
      `CREATE INDEX "IDX_reviews_menu_item_id" ON "reviews" ("menu_item_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reviews_user_id" ON "reviews" ("user_id")`,
    );

    // Add average_rating column to menu_items
    await queryRunner.query(
      `ALTER TABLE "menu_items" ADD COLUMN "average_rating" DECIMAL(3,2) DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "menu_items" ADD COLUMN "review_count" INT DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "menu_items" DROP COLUMN "review_count"`);
    await queryRunner.query(`ALTER TABLE "menu_items" DROP COLUMN "average_rating"`);
    await queryRunner.dropTable('reviews');
  }
}
