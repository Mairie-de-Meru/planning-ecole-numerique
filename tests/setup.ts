import "dotenv/config";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/valises_test";
process.env.AUTH_SECRET ??= "test-secret-test-secret-test-secret";
delete process.env.SMTP_HOST;
