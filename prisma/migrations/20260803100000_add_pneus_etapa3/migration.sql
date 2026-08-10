-- Etapa 3 do módulo de pneus: manutenção e inspeções
ALTER TYPE "TipoEventoPneu" ADD VALUE IF NOT EXISTS 'SULCO';
ALTER TYPE "TipoEventoPneu" ADD VALUE IF NOT EXISTS 'CALIBRAGEM';
ALTER TYPE "TipoEventoPneu" ADD VALUE IF NOT EXISTS 'RECAPAGEM';
ALTER TYPE "TipoEventoPneu" ADD VALUE IF NOT EXISTS 'CONSERTO';
ALTER TYPE "TipoEventoPneu" ADD VALUE IF NOT EXISTS 'INSPECAO';

CREATE TABLE "pneu_medicoes_sulco" (
  "id" TEXT NOT NULL, "pneuId" TEXT NOT NULL, "data" DATE NOT NULL, "quilometragem" DECIMAL(14,1),
  "sulcoInterno" DECIMAL(6,2) NOT NULL, "sulcoCentral" DECIMAL(6,2) NOT NULL, "sulcoExterno" DECIMAL(6,2) NOT NULL,
  "mediaSulco" DECIMAL(6,2) NOT NULL, "percentualDesgaste" DECIMAL(6,2) NOT NULL, "vidaUtilRestante" DECIMAL(6,2) NOT NULL,
  "responsavel" TEXT NOT NULL, "observacoes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pneu_medicoes_sulco_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pneu_medicoes_sulco_pneuId_data_idx" ON "pneu_medicoes_sulco"("pneuId", "data");
ALTER TABLE "pneu_medicoes_sulco" ADD CONSTRAINT "pneu_medicoes_sulco_pneuId_fkey" FOREIGN KEY ("pneuId") REFERENCES "pneus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "pneu_calibragens" (
  "id" TEXT NOT NULL, "pneuId" TEXT NOT NULL, "data" DATE NOT NULL, "pressaoRecomendada" DECIMAL(8,2) NOT NULL,
  "pressaoEncontrada" DECIMAL(8,2) NOT NULL, "pressaoAjustada" DECIMAL(8,2) NOT NULL, "responsavel" TEXT NOT NULL,
  "observacoes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "pneu_calibragens_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pneu_calibragens_pneuId_data_idx" ON "pneu_calibragens"("pneuId", "data");
ALTER TABLE "pneu_calibragens" ADD CONSTRAINT "pneu_calibragens_pneuId_fkey" FOREIGN KEY ("pneuId") REFERENCES "pneus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "pneu_recapagens" (
  "id" TEXT NOT NULL, "pneuId" TEXT NOT NULL, "empresaRecapadora" TEXT NOT NULL, "dataEnvio" DATE NOT NULL, "dataRetorno" DATE,
  "valor" DECIMAL(14,2) NOT NULL, "garantiaMeses" INTEGER NOT NULL DEFAULT 0, "tipoRecapagem" TEXT NOT NULL,
  "numeroRecapagem" INTEGER NOT NULL, "observacoes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pneu_recapagens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pneu_recapagens_pneuId_numeroRecapagem_key" ON "pneu_recapagens"("pneuId", "numeroRecapagem");
CREATE INDEX "pneu_recapagens_pneuId_dataEnvio_idx" ON "pneu_recapagens"("pneuId", "dataEnvio");
ALTER TABLE "pneu_recapagens" ADD CONSTRAINT "pneu_recapagens_pneuId_fkey" FOREIGN KEY ("pneuId") REFERENCES "pneus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "pneu_consertos" (
  "id" TEXT NOT NULL, "pneuId" TEXT NOT NULL, "tipo" TEXT NOT NULL, "data" DATE NOT NULL, "valor" DECIMAL(14,2) NOT NULL,
  "responsavel" TEXT NOT NULL, "observacoes" TEXT, "fotosAntes" JSONB, "fotosDepois" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "pneu_consertos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pneu_consertos_pneuId_data_idx" ON "pneu_consertos"("pneuId", "data");
ALTER TABLE "pneu_consertos" ADD CONSTRAINT "pneu_consertos_pneuId_fkey" FOREIGN KEY ("pneuId") REFERENCES "pneus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "pneu_inspecoes" (
  "id" TEXT NOT NULL, "pneuId" TEXT NOT NULL, "data" DATE NOT NULL, "responsavel" TEXT NOT NULL,
  "pressaoOk" BOOLEAN NOT NULL, "sulcoOk" BOOLEAN NOT NULL, "cortes" BOOLEAN NOT NULL DEFAULT false,
  "bolhas" BOOLEAN NOT NULL DEFAULT false, "trincas" BOOLEAN NOT NULL DEFAULT false, "desgasteIrregular" BOOLEAN NOT NULL DEFAULT false,
  "lonaAparente" BOOLEAN NOT NULL DEFAULT false, "observacoes" TEXT, "fotos" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "pneu_inspecoes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pneu_inspecoes_pneuId_data_idx" ON "pneu_inspecoes"("pneuId", "data");
ALTER TABLE "pneu_inspecoes" ADD CONSTRAINT "pneu_inspecoes_pneuId_fkey" FOREIGN KEY ("pneuId") REFERENCES "pneus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
