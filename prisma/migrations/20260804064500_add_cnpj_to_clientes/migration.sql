ALTER TABLE "clientes"
ADD COLUMN "cnpj" TEXT NOT NULL DEFAULT '';

CREATE INDEX "clientes_cnpj_idx" ON "clientes"("cnpj");
