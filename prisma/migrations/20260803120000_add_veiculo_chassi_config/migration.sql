ALTER TABLE "veiculos"
  ADD COLUMN "quantidadePneus" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN "quantidadeEstepes" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "veiculos"
  ADD CONSTRAINT "veiculos_quantidade_pneus_check" CHECK ("quantidadePneus" BETWEEN 4 AND 16),
  ADD CONSTRAINT "veiculos_quantidade_estepes_check" CHECK ("quantidadeEstepes" BETWEEN 0 AND 3);
