BEGIN;

CREATE SEQUENCE IF NOT EXISTS "ciots_idSequencial_seq";

ALTER TABLE "ciots"
  ADD COLUMN IF NOT EXISTS "idSequencial" INTEGER;

ALTER TABLE "ciots"
  ALTER COLUMN "idSequencial"
  SET DEFAULT nextval('"ciots_idSequencial_seq"'::regclass);

WITH base AS (
  SELECT COALESCE(MAX("idSequencial"), 0) AS maximo
  FROM "ciots"
),
pendentes AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY id) AS ordem
  FROM "ciots"
  WHERE "idSequencial" IS NULL
)
UPDATE "ciots" AS c
SET "idSequencial" = base.maximo + pendentes.ordem
FROM base, pendentes
WHERE c.id = pendentes.id;

DO $$
DECLARE
  maior INTEGER;
BEGIN
  SELECT MAX("idSequencial") INTO maior FROM "ciots";

  IF maior IS NULL THEN
    PERFORM setval('"ciots_idSequencial_seq"'::regclass, 1, false);
  ELSE
    PERFORM setval('"ciots_idSequencial_seq"'::regclass, maior, true);
  END IF;
END
$$;

ALTER SEQUENCE "ciots_idSequencial_seq"
  OWNED BY "ciots"."idSequencial";

ALTER TABLE "ciots"
  ALTER COLUMN "idSequencial" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ciots_idSequencial_key"
  ON "ciots" ("idSequencial");

COMMIT;
