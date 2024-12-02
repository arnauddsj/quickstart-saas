import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIndexes1723040678079 implements MigrationInterface {
    name = 'AddIndexes1723040678079'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add index for token lookups
        await queryRunner.query(`
            CREATE INDEX "idx_token_user_id" ON "token" ("user_id");
            CREATE INDEX "idx_token_expires_at" ON "token" ("expires_at");
        `);

        // Add index for user email lookups
        await queryRunner.query(`
            CREATE INDEX "idx_user_email" ON "user" ("email");
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "idx_token_user_id"`);
        await queryRunner.query(`DROP INDEX "idx_token_expires_at"`);
        await queryRunner.query(`DROP INDEX "idx_user_email"`);
    }
}