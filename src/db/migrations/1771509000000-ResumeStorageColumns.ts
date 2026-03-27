import { MigrationInterface, QueryRunner } from 'typeorm';

/*
  Migration: ResumeStorageColumns

  Replaces the old `file_url` column with proper storage metadata columns:
  - storage_key       — internal path in the Supabase Storage bucket.
  - original_filename — original name of the uploaded file.
  - mime_type         — MIME type (application/pdf, etc.).
  - file_size_bytes   — size of the file in bytes.

  This migration assumes a fresh database with no existing resume data.
*/
export class ResumeStorageColumns1771509000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    /* Drop old file_url column */
    const hasFileUrl = await queryRunner.hasColumn('resumes', 'file_url');
    if (hasFileUrl) {
      await queryRunner.query(
        `ALTER TABLE "resumes" DROP COLUMN "file_url"`,
      );
    }

    /* Add storage_key TEXT NOT NULL */
    const hasStorageKey = await queryRunner.hasColumn('resumes', 'storage_key');
    if (!hasStorageKey) {
      await queryRunner.query(
        `ALTER TABLE "resumes" ADD COLUMN "storage_key" text NOT NULL DEFAULT ''`,
      );
      /* Remove the default after column is created (clean schema) */
      await queryRunner.query(
        `ALTER TABLE "resumes" ALTER COLUMN "storage_key" DROP DEFAULT`,
      );
    }

    /* Add original_filename VARCHAR(255) NOT NULL */
    const hasOrigFilename = await queryRunner.hasColumn('resumes', 'original_filename');
    if (!hasOrigFilename) {
      await queryRunner.query(
        `ALTER TABLE "resumes" ADD COLUMN "original_filename" varchar(255) NOT NULL DEFAULT ''`,
      );
      await queryRunner.query(
        `ALTER TABLE "resumes" ALTER COLUMN "original_filename" DROP DEFAULT`,
      );
    }

    /* Add mime_type VARCHAR(100) NOT NULL */
    const hasMimeType = await queryRunner.hasColumn('resumes', 'mime_type');
    if (!hasMimeType) {
      await queryRunner.query(
        `ALTER TABLE "resumes" ADD COLUMN "mime_type" varchar(100) NOT NULL DEFAULT ''`,
      );
      await queryRunner.query(
        `ALTER TABLE "resumes" ALTER COLUMN "mime_type" DROP DEFAULT`,
      );
    }

    /* Add file_size_bytes INTEGER NOT NULL */
    const hasFileSize = await queryRunner.hasColumn('resumes', 'file_size_bytes');
    if (!hasFileSize) {
      await queryRunner.query(
        `ALTER TABLE "resumes" ADD COLUMN "file_size_bytes" integer NOT NULL DEFAULT 0`,
      );
      await queryRunner.query(
        `ALTER TABLE "resumes" ALTER COLUMN "file_size_bytes" DROP DEFAULT`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    /* Remove new columns */
    await queryRunner.query(
      `ALTER TABLE "resumes" DROP COLUMN IF EXISTS "file_size_bytes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resumes" DROP COLUMN IF EXISTS "mime_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resumes" DROP COLUMN IF EXISTS "original_filename"`,
    );
    await queryRunner.query(
      `ALTER TABLE "resumes" DROP COLUMN IF EXISTS "storage_key"`,
    );

    /* Restore original file_url column */
    await queryRunner.query(
      `ALTER TABLE "resumes" ADD COLUMN "file_url" text NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "resumes" ALTER COLUMN "file_url" DROP DEFAULT`,
    );
  }
}
