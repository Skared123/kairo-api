import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateContactInteractions1795563569456 implements MigrationInterface {
  name = 'CreateContactInteractions1795563569456';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."contact_interaction_channel" AS ENUM('email', 'linkedin', 'call', 'meeting', 'other')`,
    );
    await queryRunner.query(
      `CREATE TABLE "contact_interactions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "contact_id" uuid NOT NULL, "occurred_on" date NOT NULL, "channel" "public"."contact_interaction_channel" NOT NULL, "note" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "contact_interactions_pkey" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "contact_interactions_contact_id_occurred_on_idx" ON "contact_interactions"  ("contact_id", "occurred_on") `,
    );
    await queryRunner.query(
      `ALTER TABLE "contact_interactions" ADD CONSTRAINT "contact_interactions_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "contact_interactions" DROP CONSTRAINT "contact_interactions_contact_id_fkey"`,
    );
    await queryRunner.query(`DROP INDEX "public"."contact_interactions_contact_id_occurred_on_idx"`);
    await queryRunner.query(`DROP TABLE "contact_interactions"`);
    await queryRunner.query(`DROP TYPE "public"."contact_interaction_channel"`);
  }
}
