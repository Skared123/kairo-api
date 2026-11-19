import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSessions1795126958155 implements MigrationInterface {
  name = 'CreateSessions1795126958155';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "sessions" ("id" text NOT NULL, "user_id" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "last_active_at" TIMESTAMP WITH TIME ZONE NOT NULL, "mfa" text, "metadata" jsonb, CONSTRAINT "sessions_mfa_valid" CHECK ("mfa" IN ('pending', 'verified')), CONSTRAINT "sessions_pkey" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "sessions_expires_at_idx" ON "sessions"  ("expires_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "sessions_user_id_idx" ON "sessions"  ("user_id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."sessions_user_id_idx"`);
    await queryRunner.query(`DROP INDEX "public"."sessions_expires_at_idx"`);
    await queryRunner.query(`DROP TABLE "sessions"`);
  }
}
