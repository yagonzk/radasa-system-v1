BEGIN;

CREATE SEQUENCE IF NOT EXISTS "ciots_idSequencial_seq";

ALTER TABLE "ciots" ADD COLUMN IF NOT EXISTS "idSequencial" INTEGER;
ALTER TABLE "ciots" ADD COLUMN IF NOT EXISTS "empresaId" TEXT;
ALTER TABLE "ciots" ADD COLUMN IF NOT EXISTS "contratanteRazaoSocial" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ciots" ADD COLUMN IF NOT EXISTS "contratanteNomeFantasia" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ciots" ADD COLUMN IF NOT EXISTS "contratanteCnpj" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ciots" ADD COLUMN IF NOT EXISTS "contratadoRazaoSocial" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ciots" ADD COLUMN IF NOT EXISTS "contratadoNomeFantasia" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ciots" ADD COLUMN IF NOT EXISTS "contratadoCnpj" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ciots" ADD COLUMN IF NOT EXISTS "contratadoInscricaoEstadual" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ciots" ADD COLUMN IF NOT EXISTS "contratadoEndereco" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ciots" ADD COLUMN IF NOT EXISTS "contratadoCidade" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ciots" ADD COLUMN IF NOT EXISTS "contratadoUf" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ciots" ADD COLUMN IF NOT EXISTS "valorMercadoria" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "ciots" ADD COLUMN IF NOT EXISTS "cnpjsCargaFracionada" TEXT NOT NULL DEFAULT '';

ALTER TABLE "ciots" ALTER COLUMN "idSequencial" SET DEFAULT nextval('"ciots_idSequencial_seq"'::regclass);
WITH base AS (SELECT COALESCE(MAX("idSequencial"),0) AS maior FROM "ciots"),
pendentes AS (SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt", id) AS ordem FROM "ciots" WHERE "idSequencial" IS NULL)
UPDATE "ciots" c SET "idSequencial" = base.maior + pendentes.ordem FROM base, pendentes WHERE c.id = pendentes.id;
SELECT setval('"ciots_idSequencial_seq"'::regclass, GREATEST(COALESCE((SELECT MAX("idSequencial") FROM "ciots"),1),1), EXISTS(SELECT 1 FROM "ciots"));
ALTER TABLE "ciots" ALTER COLUMN "idSequencial" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "ciots_idSequencial_key" ON "ciots"("idSequencial");
CREATE INDEX IF NOT EXISTS "ciots_empresaId_idx" ON "ciots"("empresaId");

ALTER TABLE "ciot_ctes" ADD COLUMN IF NOT EXISTS "emitenteNomeFantasia" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ciot_ctes" ADD COLUMN IF NOT EXISTS "emitenteInscricaoEstadual" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ciot_ctes" ADD COLUMN IF NOT EXISTS "emitenteEndereco" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ciot_ctes" ADD COLUMN IF NOT EXISTS "emitenteCidade" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ciot_ctes" ADD COLUMN IF NOT EXISTS "emitenteUf" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ciot_ctes" ADD COLUMN IF NOT EXISTS "valorPedagio" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "ciot_ctes" ADD COLUMN IF NOT EXISTS "arquivoNome" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ciot_ctes" ADD COLUMN IF NOT EXISTS "dataEmissao" DATE;

COMMIT;
