-- Adiciona PDF à nota de abastecimento
ALTER TABLE "abastecimentos" ADD COLUMN "pdfUrl" TEXT;

-- Garante que produtos antigos possam ser vinculados ao cadastro central de produtos
INSERT INTO "produtos" ("id", "nome", "codigoInterno", "createdAt", "updatedAt")
SELECT
  'legacy-' || md5(legacy."nomeNormalizado"),
  legacy."nome",
  'ABAST-' || upper(substr(md5(legacy."nomeNormalizado"), 1, 8)),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT lower(trim(a."produto")) AS "nomeNormalizado", min(trim(a."produto")) AS "nome"
  FROM "abastecimentos" a
  GROUP BY lower(trim(a."produto"))
) legacy
WHERE NOT EXISTS (
  SELECT 1 FROM "produtos" p WHERE lower(trim(p."nome")) = legacy."nomeNormalizado"
);

CREATE TABLE "abastecimento_produtos" (
  "id" TEXT NOT NULL,
  "abastecimentoId" TEXT NOT NULL,
  "produtoId" TEXT NOT NULL,
  "quantidadeLitros" DECIMAL(14,3) NOT NULL,
  "valorUnitario" DECIMAL(14,4) NOT NULL,
  "valorTotal" DECIMAL(14,2) NOT NULL,
  CONSTRAINT "abastecimento_produtos_pkey" PRIMARY KEY ("id")
);

INSERT INTO "abastecimento_produtos" (
  "id", "abastecimentoId", "produtoId", "quantidadeLitros", "valorUnitario", "valorTotal"
)
SELECT
  'legacy-item-' || md5(a."id"),
  a."id",
  (
    SELECT p."id" FROM "produtos" p
    WHERE lower(trim(p."nome")) = lower(trim(a."produto"))
    ORDER BY p."createdAt" ASC
    LIMIT 1
  ),
  a."quantidadeLitros",
  a."valorUnitario",
  ROUND((a."quantidadeLitros" * a."valorUnitario")::numeric, 2)
FROM "abastecimentos" a;

CREATE INDEX "abastecimento_produtos_abastecimentoId_idx" ON "abastecimento_produtos"("abastecimentoId");
CREATE INDEX "abastecimento_produtos_produtoId_idx" ON "abastecimento_produtos"("produtoId");

ALTER TABLE "abastecimento_produtos"
  ADD CONSTRAINT "abastecimento_produtos_abastecimentoId_fkey"
  FOREIGN KEY ("abastecimentoId") REFERENCES "abastecimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "abastecimento_produtos"
  ADD CONSTRAINT "abastecimento_produtos_produtoId_fkey"
  FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX IF EXISTS "abastecimentos_produto_idx";
ALTER TABLE "abastecimentos"
  DROP COLUMN "produto",
  DROP COLUMN "quantidadeLitros",
  DROP COLUMN "valorUnitario";
