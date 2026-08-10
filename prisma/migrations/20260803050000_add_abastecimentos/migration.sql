CREATE TABLE "abastecimentos" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "veiculoId" TEXT NOT NULL,
    "dataEmissao" DATE NOT NULL,
    "produto" TEXT NOT NULL,
    "quantidadeLitros" DECIMAL(14,3) NOT NULL,
    "valorUnitario" DECIMAL(14,4) NOT NULL,
    "valorTotal" DECIMAL(14,2) NOT NULL,
    "hodometro" DECIMAL(14,1) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "abastecimentos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "abastecimentos_clienteId_idx" ON "abastecimentos"("clienteId");
CREATE INDEX "abastecimentos_veiculoId_idx" ON "abastecimentos"("veiculoId");
CREATE INDEX "abastecimentos_dataEmissao_idx" ON "abastecimentos"("dataEmissao");
CREATE INDEX "abastecimentos_produto_idx" ON "abastecimentos"("produto");
ALTER TABLE "abastecimentos" ADD CONSTRAINT "abastecimentos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "abastecimentos" ADD CONSTRAINT "abastecimentos_veiculoId_fkey" FOREIGN KEY ("veiculoId") REFERENCES "veiculos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
