-- Adiciona a subcategoria do veículo sem afetar cadastros existentes.
CREATE TYPE "SubcategoriaVeiculo" AS ENUM ('CAMINHAO', 'CARRO', 'MOTO');

ALTER TABLE "veiculos"
ADD COLUMN "subcategoria" "SubcategoriaVeiculo";

CREATE INDEX "veiculos_subcategoria_idx" ON "veiculos"("subcategoria");
