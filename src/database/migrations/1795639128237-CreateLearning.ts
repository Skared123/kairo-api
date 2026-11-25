import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLearning1795639128237 implements MigrationInterface {
  name = 'CreateLearning1795639128237';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."learning_item_kind" AS ENUM('video', 'course', 'article', 'book', 'project', 'other')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."learning_item_status" AS ENUM('to_start', 'in_progress', 'done', 'dropped')`,
    );
    await queryRunner.query(
      `CREATE TABLE "learning_items" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "title" text NOT NULL, "kind" "public"."learning_item_kind" NOT NULL, "url" text, "status" "public"."learning_item_status" NOT NULL DEFAULT 'to_start', "finished_at" TIMESTAMP WITH TIME ZONE, "is_focus" boolean NOT NULL DEFAULT false, "notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "learning_items_pkey" PRIMARY KEY ("id"))`,
    );
    // At most one focus per user (decision 042).
    await queryRunner.query(
      `CREATE UNIQUE INDEX "learning_items_one_focus_per_user" ON "learning_items"  ("user_id") WHERE "is_focus"`,
    );
    await queryRunner.query(`CREATE INDEX "learning_items_user_id_idx" ON "learning_items"  ("user_id") `);
    await queryRunner.query(
      `CREATE TABLE "skills" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "name" text NOT NULL, "key" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "skills_pkey" PRIMARY KEY ("id"))`,
    );
    // A skill once per user, compared by its key (decision 040).
    await queryRunner.query(`CREATE UNIQUE INDEX "skills_user_id_key_key" ON "skills"  ("user_id", "key") `);
    await queryRunner.query(
      `CREATE TABLE "learning_item_skills" ("item_id" uuid NOT NULL, "skill_id" uuid NOT NULL, CONSTRAINT "learning_item_skills_pkey" PRIMARY KEY ("item_id", "skill_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "learning_item_skills_skill_id_idx" ON "learning_item_skills"  ("skill_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "learning_items" ADD CONSTRAINT "learning_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "skills" ADD CONSTRAINT "skills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "learning_item_skills" ADD CONSTRAINT "learning_item_skills_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "learning_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "learning_item_skills" ADD CONSTRAINT "learning_item_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "learning_item_skills" DROP CONSTRAINT "learning_item_skills_skill_id_fkey"`);
    await queryRunner.query(`ALTER TABLE "learning_item_skills" DROP CONSTRAINT "learning_item_skills_item_id_fkey"`);
    await queryRunner.query(`ALTER TABLE "skills" DROP CONSTRAINT "skills_user_id_fkey"`);
    await queryRunner.query(`ALTER TABLE "learning_items" DROP CONSTRAINT "learning_items_user_id_fkey"`);
    await queryRunner.query(`DROP INDEX "public"."learning_item_skills_skill_id_idx"`);
    await queryRunner.query(`DROP TABLE "learning_item_skills"`);
    await queryRunner.query(`DROP INDEX "public"."skills_user_id_key_key"`);
    await queryRunner.query(`DROP TABLE "skills"`);
    await queryRunner.query(`DROP INDEX "public"."learning_items_user_id_idx"`);
    await queryRunner.query(`DROP INDEX "public"."learning_items_one_focus_per_user"`);
    await queryRunner.query(`DROP TABLE "learning_items"`);
    await queryRunner.query(`DROP TYPE "public"."learning_item_status"`);
    await queryRunner.query(`DROP TYPE "public"."learning_item_kind"`);
  }
}
