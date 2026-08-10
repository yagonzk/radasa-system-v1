CREATE TYPE "StatusPneu" AS ENUM ('ESTOQUE', 'INSTALADO', 'MANUTENCAO', 'RECAPAGEM', 'DESCARTADO');
CREATE TYPE "TipoPneu" AS ENUM ('DIRECIONAL', 'TRACAO', 'LIVRE');
CREATE TYPE "CondicaoPneu" AS ENUM ('NOVO', 'USADO', 'RECAPADO', 'AGUARDANDO_RECAPAGEM');
CREATE TYPE "TipoEventoPneu" AS ENUM ('COMPRA', 'ALTERACAO', 'STATUS', 'FOTO');

CREATE TABLE "pneus" (
  "id" TEXT NOT NULL,
  "numeroFogo" TEXT NOT NULL,
  "codigoBarras" TEXT,
  "qrCode" TEXT,
  "marca" TEXT NOT NULL,
  "modelo" TEXT NOT NULL,
  "medida" TEXT NOT NULL,
  "dot" TEXT NOT NULL,
  "numeroSerie" TEXT,
  "tipo" "TipoPneu" NOT NULL,
  "valorCompra" DECIMAL(14,2) NOT NULL,
  "fornecedor" TEXT NOT NULL,
  "dataCompra" DATE NOT NULL,
  "maxRecapagens" INTEGER NOT NULL DEFAULT 0,
  "recapagensRealizadas" INTEGER NOT NULL DEFAULT 0,
  "status" "StatusPneu" NOT NULL DEFAULT 'ESTOQUE',
  "condicao" "CondicaoPneu" NOT NULL DEFAULT 'NOVO',
  "sulcoInicial" DECIMAL(6,2),
  "sulcoAtual" DECIMAL(6,2),
  "kmAtual" DECIMAL(14,1) NOT NULL DEFAULT 0,
  "proximoRodizioKm" DECIMAL(14,1),
  "observacoes" TEXT,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pneus_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pneus_numeroFogo_key" ON "pneus"("numeroFogo");
CREATE INDEX "pneus_status_idx" ON "pneus"("status");
CREATE INDEX "pneus_condicao_idx" ON "pneus"("condicao");
CREATE INDEX "pneus_marca_idx" ON "pneus"("marca");
CREATE INDEX "pneus_dataCompra_idx" ON "pneus"("dataCompra");

CREATE TABLE "pneu_fotos" (
  "id" TEXT NOT NULL,
  "pneuId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "legenda" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pneu_fotos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pneu_fotos_pneuId_idx" ON "pneu_fotos"("pneuId");
ALTER TABLE "pneu_fotos" ADD CONSTRAINT "pneu_fotos_pneuId_fkey" FOREIGN KEY ("pneuId") REFERENCES "pneus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "pneu_eventos" (
  "id" TEXT NOT NULL,
  "pneuId" TEXT NOT NULL,
  "tipo" "TipoEventoPneu" NOT NULL,
  "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "quilometragem" DECIMAL(14,1),
  "responsavel" TEXT,
  "observacoes" TEXT,
  "dados" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pneu_eventos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pneu_eventos_pneuId_idx" ON "pneu_eventos"("pneuId");
CREATE INDEX "pneu_eventos_data_idx" ON "pneu_eventos"("data");
ALTER TABLE "pneu_eventos" ADD CONSTRAINT "pneu_eventos_pneuId_fkey" FOREIGN KEY ("pneuId") REFERENCES "pneus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
