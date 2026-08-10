CREATE TABLE IF NOT EXISTS "pedagios" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "rodovia" TEXT NOT NULL DEFAULT '',
  "km" TEXT NOT NULL DEFAULT '',
  "cidade" TEXT NOT NULL DEFAULT '',
  "uf" TEXT NOT NULL DEFAULT '',
  "concessionaria" TEXT NOT NULL DEFAULT '',
  "latitude" DECIMAL(10,7) NOT NULL,
  "longitude" DECIMAL(10,7) NOT NULL,
  "raioKm" DECIMAL(6,2) NOT NULL DEFAULT 1.5,
  "valorPorEixo" DECIMAL(12,2) NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "fonte" TEXT NOT NULL DEFAULT 'MANUAL',
  "observacoes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pedagios_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "pedagios_ativo_idx" ON "pedagios"("ativo");
CREATE INDEX IF NOT EXISTS "pedagios_uf_idx" ON "pedagios"("uf");
CREATE INDEX IF NOT EXISTS "pedagios_rodovia_idx" ON "pedagios"("rodovia");
