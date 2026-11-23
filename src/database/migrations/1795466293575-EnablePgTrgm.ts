import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enables PostgreSQL's pg_trgm extension, which measures how similar two texts are by their trigrams, for duplicate
 * detection (decision 031). Extensions are schema changes, so they go through migrations (decision 004), never
 * through TypeORM's installExtensions.
 */
export class EnablePgTrgm1795466293575 implements MigrationInterface {
  name = 'EnablePgTrgm1795466293575';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP EXTENSION IF EXISTS "pg_trgm"`);
  }
}
