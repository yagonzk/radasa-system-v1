-- Add username support without losing existing users.
ALTER TABLE "users" ADD COLUMN "username" TEXT;

UPDATE "users"
SET "username" = LOWER(REGEXP_REPLACE(SPLIT_PART("email", '@', 1), '[^a-zA-Z0-9._-]', '', 'g')) || '_' || SUBSTRING("id", 1, 6)
WHERE "username" IS NULL;

ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
