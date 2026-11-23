import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTemporaryPasswordExpiry1795459196648 implements MigrationInterface {
  name = 'AddTemporaryPasswordExpiry1795459196648';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "temporary_password_expires_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "temporary_password_expires_at"`,
    );
  }
}
