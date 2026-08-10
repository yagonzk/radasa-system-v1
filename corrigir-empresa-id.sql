ALTER TABLE "ciots"
ADD COLUMN IF NOT EXISTS "empresaId" TEXT;

CREATE INDEX IF NOT EXISTS "ciots_empresaId_idx"
ON "ciots" ("empresaId");
