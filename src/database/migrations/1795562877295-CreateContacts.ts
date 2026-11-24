import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateContacts1795562877295 implements MigrationInterface {
  name = 'CreateContacts1795562877295';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."contact_kind" AS ENUM('recruiter', 'hiring_manager', 'interviewer', 'referral', 'employee', 'other')`,
    );
    await queryRunner.query(
      `CREATE TABLE "contacts" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "name" text NOT NULL, "company" text, "role" text, "kind" "public"."contact_kind", "email" text, "phone" text, "linkedin_url" text, "notes" text, "next_follow_up_on" date, "next_follow_up_note" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "contacts_pkey" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "contacts_user_id_next_follow_up_on_idx" ON "contacts"  ("user_id", "next_follow_up_on") `,
    );
    await queryRunner.query(`CREATE INDEX "contacts_user_id_idx" ON "contacts"  ("user_id") `);
    await queryRunner.query(
      `ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "contacts" DROP CONSTRAINT "contacts_user_id_fkey"`);
    await queryRunner.query(`DROP INDEX "public"."contacts_user_id_idx"`);
    await queryRunner.query(`DROP INDEX "public"."contacts_user_id_next_follow_up_on_idx"`);
    await queryRunner.query(`DROP TABLE "contacts"`);
    await queryRunner.query(`DROP TYPE "public"."contact_kind"`);
  }
}
