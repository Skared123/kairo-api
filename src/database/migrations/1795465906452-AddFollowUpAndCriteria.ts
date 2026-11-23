import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFollowUpAndCriteria1795465906452 implements MigrationInterface {
  name = 'AddFollowUpAndCriteria1795465906452';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "job_criteria" ("user_id" uuid NOT NULL, "min_salary" integer, "currency" character(3), "period" "public"."salary_period", "remote_only" boolean NOT NULL DEFAULT false, "contract_types" "public"."job_contract_type" array NOT NULL DEFAULT '{}', "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "job_criteria_salary_complete" CHECK (("min_salary" IS NULL AND "currency" IS NULL AND "period" IS NULL) OR ("min_salary" IS NOT NULL AND "currency" IS NOT NULL AND "period" IS NOT NULL)), CONSTRAINT "job_criteria_currency_format" CHECK ("currency" ~ '^[A-Z]{3}$'), CONSTRAINT "job_criteria_pkey" PRIMARY KEY ("user_id"))`,
    );
    await queryRunner.query(`ALTER TABLE "jobs" ADD "next_follow_up_on" date`);
    await queryRunner.query(`ALTER TABLE "jobs" ADD "next_follow_up_note" text`);
    await queryRunner.query(
      `CREATE INDEX "jobs_user_id_next_follow_up_on_idx" ON "jobs"  ("user_id", "next_follow_up_on") `,
    );
    await queryRunner.query(
      `ALTER TABLE "job_criteria" ADD CONSTRAINT "job_criteria_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "job_criteria" DROP CONSTRAINT "job_criteria_user_id_fkey"`);
    await queryRunner.query(`DROP INDEX "public"."jobs_user_id_next_follow_up_on_idx"`);
    await queryRunner.query(`ALTER TABLE "jobs" DROP COLUMN "next_follow_up_note"`);
    await queryRunner.query(`ALTER TABLE "jobs" DROP COLUMN "next_follow_up_on"`);
    await queryRunner.query(`DROP TABLE "job_criteria"`);
  }
}
