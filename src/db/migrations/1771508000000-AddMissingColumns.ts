import { MigrationInterface, QueryRunner } from 'typeorm';

/*
  Manual migration — adds missing columns that entities expect
  but the database doesn't have yet.

  1. resumes.updated_at — BaseEntity has updated_at, but resumes table was created without it.
  2. application_comments.visible_to_candidate — new boolean column for comment visibility.
*/
export class AddMissingColumns1771508000000 implements MigrationInterface {
  name = 'AddMissingColumns1771508000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    /* Add updated_at to resumes if it doesn't exist */
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'resumes' AND column_name = 'updated_at'
        ) THEN
          ALTER TABLE "resumes" ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now();
        END IF;
      END $$;
    `);

    /* Add visible_to_candidate to application_comments if it doesn't exist */
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'application_comments' AND column_name = 'visible_to_candidate'
        ) THEN
          ALTER TABLE "application_comments" ADD COLUMN "visible_to_candidate" BOOLEAN NOT NULL DEFAULT false;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "resumes" DROP COLUMN IF EXISTS "updated_at"`);
    await queryRunner.query(`ALTER TABLE "application_comments" DROP COLUMN IF EXISTS "visible_to_candidate"`);
  }
}
