import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateJobContacts1795563276600 implements MigrationInterface {
  name = 'CreateJobContacts1795563276600';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "job_contacts" ("job_id" uuid NOT NULL, "contact_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "job_contacts_pkey" PRIMARY KEY ("job_id", "contact_id"))`,
    );
    // The primary key serves lookups by job; this one serves lookups by contact.
    await queryRunner.query(`CREATE INDEX "job_contacts_contact_id_idx" ON "job_contacts"  ("contact_id") `);
    // Deleting either end removes the link only (decision 036).
    await queryRunner.query(
      `ALTER TABLE "job_contacts" ADD CONSTRAINT "job_contacts_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "job_contacts" ADD CONSTRAINT "job_contacts_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "job_contacts" DROP CONSTRAINT "job_contacts_contact_id_fkey"`);
    await queryRunner.query(`ALTER TABLE "job_contacts" DROP CONSTRAINT "job_contacts_job_id_fkey"`);
    await queryRunner.query(`DROP INDEX "public"."job_contacts_contact_id_idx"`);
    await queryRunner.query(`DROP TABLE "job_contacts"`);
  }
}
