ALTER TYPE "TipoEventoPneu" ADD VALUE IF NOT EXISTS 'INSTALACAO';
ALTER TYPE "TipoEventoPneu" ADD VALUE IF NOT EXISTS 'RETIRADA';
ALTER TYPE "TipoEventoPneu" ADD VALUE IF NOT EXISTS 'RODIZIO';

CREATE TABLE "pneu_instalacoes" (
  "id" TEXT NOT NULL,
  "pneuId" TEXT NOT NULL,
  "veiculoId" TEXT NOT NULL,
  "carretaId" TEXT,
  "eixo" TEXT NOT NULL,
  "posicao" TEXT NOT NULL,
  "dataInstalacao" DATE NOT NULL,
  "kmInstalacao" DECIMAL(14,1) NOT NULL,
  "responsavel" TEXT NOT NULL,
  "dataRetirada" DATE,
  "kmRetirada" DECIMAL(14,1),
  "motivoRetirada" TEXT,
  "statusDestino" "StatusPneu",
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pneu_instalacoes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pneu_rodizios" (
  "id" TEXT NOT NULL,
  "veiculoId" TEXT NOT NULL,
  "carretaId" TEXT,
  "data" DATE NOT NULL,
  "quilometragem" DECIMAL(14,1) NOT NULL,
  "responsavel" TEXT NOT NULL,
  "motivo" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pneu_rodizios_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pneu_rodizio_movimentos" (
  "id" TEXT NOT NULL,
  "rodizioId" TEXT NOT NULL,
  "pneuId" TEXT NOT NULL,
  "eixoOrigem" TEXT NOT NULL,
  "posicaoOrigem" TEXT NOT NULL,
  "eixoDestino" TEXT NOT NULL,
  "posicaoDestino" TEXT NOT NULL,
  CONSTRAINT "pneu_rodizio_movimentos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pneu_instalacoes_pneuId_ativo_idx" ON "pneu_instalacoes"("pneuId", "ativo");
CREATE INDEX "pneu_instalacoes_veiculoId_ativo_idx" ON "pneu_instalacoes"("veiculoId", "ativo");
CREATE INDEX "pneu_instalacoes_carretaId_ativo_idx" ON "pneu_instalacoes"("carretaId", "ativo");
CREATE INDEX "pneu_instalacoes_eixo_posicao_idx" ON "pneu_instalacoes"("eixo", "posicao");
CREATE INDEX "pneu_rodizios_veiculoId_data_idx" ON "pneu_rodizios"("veiculoId", "data");
CREATE INDEX "pneu_rodizios_carretaId_data_idx" ON "pneu_rodizios"("carretaId", "data");
CREATE INDEX "pneu_rodizio_movimentos_rodizioId_idx" ON "pneu_rodizio_movimentos"("rodizioId");
CREATE INDEX "pneu_rodizio_movimentos_pneuId_idx" ON "pneu_rodizio_movimentos"("pneuId");

ALTER TABLE "pneu_instalacoes" ADD CONSTRAINT "pneu_instalacoes_pneuId_fkey" FOREIGN KEY ("pneuId") REFERENCES "pneus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pneu_instalacoes" ADD CONSTRAINT "pneu_instalacoes_veiculoId_fkey" FOREIGN KEY ("veiculoId") REFERENCES "veiculos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pneu_instalacoes" ADD CONSTRAINT "pneu_instalacoes_carretaId_fkey" FOREIGN KEY ("carretaId") REFERENCES "veiculos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pneu_rodizios" ADD CONSTRAINT "pneu_rodizios_veiculoId_fkey" FOREIGN KEY ("veiculoId") REFERENCES "veiculos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pneu_rodizios" ADD CONSTRAINT "pneu_rodizios_carretaId_fkey" FOREIGN KEY ("carretaId") REFERENCES "veiculos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pneu_rodizio_movimentos" ADD CONSTRAINT "pneu_rodizio_movimentos_rodizioId_fkey" FOREIGN KEY ("rodizioId") REFERENCES "pneu_rodizios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pneu_rodizio_movimentos" ADD CONSTRAINT "pneu_rodizio_movimentos_pneuId_fkey" FOREIGN KEY ("pneuId") REFERENCES "pneus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
