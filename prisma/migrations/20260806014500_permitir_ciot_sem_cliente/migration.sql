BEGIN;

-- O novo fluxo do CIOT usa empresa/contratante/contratado e não depende
-- obrigatoriamente de um registro da tabela clientes.
ALTER TABLE "ciots"
  ALTER COLUMN "clienteId" DROP NOT NULL;

-- Alinha a chave estrangeira ao schema Prisma (Cliente? com onDelete: SetNull).
ALTER TABLE "ciots"
  DROP CONSTRAINT IF EXISTS "ciots_clienteId_fkey";

ALTER TABLE "ciots"
  ADD CONSTRAINT "ciots_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "clientes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
