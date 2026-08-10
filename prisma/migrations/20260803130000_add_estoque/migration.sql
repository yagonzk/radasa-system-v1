CREATE TYPE "CategoriaEstoque" AS ENUM ('PISCINA', 'PECA', 'FERRAMENTA');
CREATE TYPE "TipoMovimentacaoEstoque" AS ENUM ('ENTRADA', 'SAIDA');

ALTER TABLE "produtos" ADD COLUMN "categoriaEstoque" "CategoriaEstoque" NOT NULL DEFAULT 'PISCINA';

CREATE TABLE "estoque_movimentacoes" (
  "id" TEXT NOT NULL,
  "produtoId" TEXT NOT NULL,
  "tipo" "TipoMovimentacaoEstoque" NOT NULL,
  "quantidade" DECIMAL(14,3) NOT NULL,
  "valorUnitario" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "valorTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "data" DATE NOT NULL,
  "observacoes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "estoque_movimentacoes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "estoque_movimentacoes_produtoId_idx" ON "estoque_movimentacoes"("produtoId");
CREATE INDEX "estoque_movimentacoes_tipo_idx" ON "estoque_movimentacoes"("tipo");
CREATE INDEX "estoque_movimentacoes_data_idx" ON "estoque_movimentacoes"("data");
ALTER TABLE "estoque_movimentacoes" ADD CONSTRAINT "estoque_movimentacoes_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
