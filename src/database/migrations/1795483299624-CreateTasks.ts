import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTasks1795483299624 implements MigrationInterface {
  name = 'CreateTasks1795483299624';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "tasks" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "job_id" uuid, "title" text NOT NULL, "notes" text, "due_on" date, "done_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "tasks_pkey" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "tasks_job_id_idx" ON "tasks"  ("job_id") `);
    await queryRunner.query(`CREATE INDEX "tasks_user_id_idx" ON "tasks"  ("user_id") `);
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    // Deleting a job keeps its tasks, unlinked (decision 033).
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "tasks_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "tasks_job_id_fkey"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "tasks_user_id_fkey"`);
    await queryRunner.query(`DROP INDEX "public"."tasks_user_id_idx"`);
    await queryRunner.query(`DROP INDEX "public"."tasks_job_id_idx"`);
    await queryRunner.query(`DROP TABLE "tasks"`);
  }
}
