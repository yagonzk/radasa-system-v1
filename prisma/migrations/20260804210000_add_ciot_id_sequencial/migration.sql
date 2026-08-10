-- Adiciona um número interno sequencial para cada CIOT.
-- O identificador técnico em texto continua sendo usado nas relações.
ALTER TABLE "ciots" ADD COLUMN "idSequencial" SERIAL NOT NULL;

CREATE UNIQUE INDEX "ciots_idSequencial_key" ON "ciots"("idSequencial");
