import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateJobs1795463418270 implements MigrationInterface {
  name = 'CreateJobs1795463418270';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."job_source" AS ENUM('linkedin', 'referral', 'company_site', 'job_board', 'recruiter', 'other')`,
    );
    await queryRunner.query(`CREATE TYPE "public"."job_work_mode" AS ENUM('remote', 'hybrid', 'onsite')`);
    await queryRunner.query(`CREATE TYPE "public"."job_contract_type" AS ENUM('employee', 'contractor')`);
    await queryRunner.query(`CREATE TYPE "public"."salary_period" AS ENUM('month', 'year')`);
    await queryRunner.query(
      `CREATE TYPE "public"."job_status" AS ENUM('to_review', 'to_apply', 'applied', 'interviewing', 'offer', 'accepted', 'rejected', 'discarded')`,
    );
    await queryRunner.query(
      `CREATE TABLE "jobs" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "company" text NOT NULL, "title" text NOT NULL, "url" text, "source" "public"."job_source", "work_mode" "public"."job_work_mode", "location" text, "time_zone_notes" text, "contract_type" "public"."job_contract_type", "salary_min" integer, "salary_max" integer, "salary_currency" character(3), "salary_period" "public"."salary_period", "description" text, "notes" text, "status" "public"."job_status" NOT NULL DEFAULT 'to_review', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "jobs_salary_complete" CHECK (("salary_min" IS NULL AND "salary_max" IS NULL) OR ("salary_currency" IS NOT NULL AND "salary_period" IS NOT NULL)), CONSTRAINT "jobs_salary_currency_format" CHECK ("salary_currency" ~ '^[A-Z]{3}$'), CONSTRAINT "jobs_salary_range" CHECK ("salary_min" IS NULL OR "salary_max" IS NULL OR "salary_min" <= "salary_max"), CONSTRAINT "jobs_pkey" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "jobs_user_id_idx" ON "jobs"  ("user_id") `);
    await queryRunner.query(
      `ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "jobs" DROP CONSTRAINT "jobs_user_id_fkey"`);
    await queryRunner.query(`DROP INDEX "public"."jobs_user_id_idx"`);
    await queryRunner.query(`DROP TABLE "jobs"`);
    await queryRunner.query(`DROP TYPE "public"."job_status"`);
    await queryRunner.query(`DROP TYPE "public"."salary_period"`);
    await queryRunner.query(`DROP TYPE "public"."job_contract_type"`);
    await queryRunner.query(`DROP TYPE "public"."job_work_mode"`);
    await queryRunner.query(`DROP TYPE "public"."job_source"`);
  }
}
