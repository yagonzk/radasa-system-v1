ALTER TABLE "manifesto_produtos"
  ADD COLUMN "clienteId" TEXT,
  ADD COLUMN "romaneio" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "notaFiscal" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "serieNf" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "instrucaoCobranca" TEXT NOT NULL DEFAULT '';

UPDATE "manifesto_produtos" AS mp
SET "clienteId" = m."clienteId"
FROM "manifestos" AS m
WHERE mp."manifestoId" = m."id";

CREATE INDEX "manifesto_produtos_clienteId_idx" ON "manifesto_produtos"("clienteId");
ALTER TABLE "manifesto_produtos"
  ADD CONSTRAINT "manifesto_produtos_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
