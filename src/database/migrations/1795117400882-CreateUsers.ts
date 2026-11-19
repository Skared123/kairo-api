import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1795117400882 implements MigrationInterface {
  name = 'CreateUsers1795117400882';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."user_role" AS ENUM('admin', 'user')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "email" text NOT NULL, "name" text NOT NULL, "password_hash" text NOT NULL, "role" "public"."user_role" NOT NULL DEFAULT 'user', "must_change_password" boolean NOT NULL DEFAULT false, "deactivated_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "users_email_lowercase" CHECK ("email" = lower("email")), CONSTRAINT "users_pkey" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "users_email_key" ON "users"  ("email") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."users_email_key"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."user_role"`);
  }
}
