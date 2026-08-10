ALTER TABLE "ciots"
ADD COLUMN "valorMercadoria" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "cnpjsCargaFracionada" TEXT NOT NULL DEFAULT '';

CREATE TABLE "ciot_ctes" (
  "id" TEXT NOT NULL,
  "ciotId" TEXT NOT NULL,
  "chave" TEXT NOT NULL,
  "numero" TEXT NOT NULL,
  "serie" TEXT NOT NULL DEFAULT '',
  "emitenteCnpj" TEXT NOT NULL DEFAULT '',
  "emitenteNome" TEXT NOT NULL DEFAULT '',
  "remetenteCnpj" TEXT NOT NULL DEFAULT '',
  "remetenteNome" TEXT NOT NULL DEFAULT '',
  "destinatarioCnpj" TEXT NOT NULL DEFAULT '',
  "destinatarioNome" TEXT NOT NULL DEFAULT '',
  "tomadorCnpj" TEXT NOT NULL DEFAULT '',
  "tomadorNome" TEXT NOT NULL DEFAULT '',
  "origemCidade" TEXT NOT NULL DEFAULT '',
  "origemUf" TEXT NOT NULL DEFAULT '',
  "destinoCidade" TEXT NOT NULL DEFAULT '',
  "destinoUf" TEXT NOT NULL DEFAULT '',
  "produto" TEXT NOT NULL DEFAULT '',
  "ncm" TEXT NOT NULL DEFAULT '',
  "pesoKg" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "valorMercadoria" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "valorFrete" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "xmlUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ciot_ctes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ciot_ctes_ciotId_chave_key"
ON "ciot_ctes"("ciotId", "chave");

CREATE INDEX "ciot_ctes_ciotId_idx" ON "ciot_ctes"("ciotId");
CREATE INDEX "ciot_ctes_chave_idx" ON "ciot_ctes"("chave");

ALTER TABLE "ciot_ctes"
ADD CONSTRAINT "ciot_ctes_ciotId_fkey"
FOREIGN KEY ("ciotId") REFERENCES "ciots"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
