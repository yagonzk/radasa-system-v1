CREATE TYPE "StatusCiot" AS ENUM (
  'RASCUNHO',
  'PRONTO_ENVIO',
  'PROCESSANDO',
  'AUTORIZADO',
  'REJEITADO',
  'CANCELADO',
  'ENCERRADO'
);

CREATE TYPE "TipoOperacaoCiot" AS ENUM (
  'LOTACAO',
  'FRACIONADA',
  'TAC_AGREGADO'
);

CREATE TABLE "ciots" (
  "id" TEXT NOT NULL,
  "clienteId" TEXT NOT NULL,
  "motoristaId" TEXT NOT NULL,
  "veiculoId" TEXT NOT NULL,
  "tipoOperacao" "TipoOperacaoCiot" NOT NULL,
  "status" "StatusCiot" NOT NULL DEFAULT 'RASCUNHO',
  "rntrc" TEXT NOT NULL,
  "origemCidade" TEXT NOT NULL,
  "origemUf" TEXT NOT NULL,
  "destinoCidade" TEXT NOT NULL,
  "destinoUf" TEXT NOT NULL,
  "dataInicio" DATE NOT NULL,
  "dataFim" DATE,
  "naturezaCarga" TEXT NOT NULL,
  "pesoKg" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "valorFrete" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "valorPedagio" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "observacoes" TEXT,
  "numeroCiot" TEXT,
  "codigoVerificador" TEXT,
  "protocolo" TEXT,
  "mensagemRetorno" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ciots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ciots_clienteId_idx" ON "ciots"("clienteId");
CREATE INDEX "ciots_motoristaId_idx" ON "ciots"("motoristaId");
CREATE INDEX "ciots_veiculoId_idx" ON "ciots"("veiculoId");
CREATE INDEX "ciots_status_idx" ON "ciots"("status");
CREATE INDEX "ciots_dataInicio_idx" ON "ciots"("dataInicio");

ALTER TABLE "ciots"
ADD CONSTRAINT "ciots_clienteId_fkey"
FOREIGN KEY ("clienteId") REFERENCES "clientes"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ciots"
ADD CONSTRAINT "ciots_motoristaId_fkey"
FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ciots"
ADD CONSTRAINT "ciots_veiculoId_fkey"
FOREIGN KEY ("veiculoId") REFERENCES "veiculos"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
