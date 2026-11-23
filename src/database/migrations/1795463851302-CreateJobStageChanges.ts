import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateJobStageChanges1795463851302 implements MigrationInterface {
  name = 'CreateJobStageChanges1795463851302';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "job_stage_changes" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "job_id" uuid NOT NULL, "from_status" "public"."job_status", "to_status" "public"."job_status" NOT NULL, "changed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "job_stage_changes_pkey" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "job_stage_changes_job_id_idx" ON "job_stage_changes"  ("job_id") `);
    await queryRunner.query(
      `ALTER TABLE "job_stage_changes" ADD CONSTRAINT "job_stage_changes_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    // Jobs saved before this migration get their first entry, as new ones do when they are created (decision 028).
    await queryRunner.query(
      `INSERT INTO "job_stage_changes" ("job_id", "from_status", "to_status", "changed_at") SELECT "id", NULL, "status", "created_at" FROM "jobs"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "job_stage_changes" DROP CONSTRAINT "job_stage_changes_job_id_fkey"`);
    await queryRunner.query(`DROP INDEX "public"."job_stage_changes_job_id_idx"`);
    await queryRunner.query(`DROP TABLE "job_stage_changes"`);
  }
}
