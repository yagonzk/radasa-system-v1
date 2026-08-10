CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');
CREATE TYPE "TipoManifesto" AS ENUM ('BONIFICACAO_LEBRINHA', 'ACERTAR_LEBRINHA', 'RECEBER_CLIENTE');

CREATE TABLE "users" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "email" TEXT NOT NULL, "passwordHash" TEXT NOT NULL, "role" "UserRole" NOT NULL DEFAULT 'USER', "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "motoristas" ("id" TEXT PRIMARY KEY, "nome" TEXT NOT NULL, "cpf" TEXT NOT NULL, "salarioBase" DECIMAL(14,2) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "motoristas_nome_idx" ON "motoristas"("nome");
CREATE TABLE "chapas" ("id" TEXT PRIMARY KEY, "nome" TEXT NOT NULL, "valorFixo" DECIMAL(14,2) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "chapas_nome_idx" ON "chapas"("nome");
CREATE TABLE "clientes" ("id" TEXT PRIMARY KEY, "nomeFantasia" TEXT NOT NULL, "codigoInterno" TEXT NOT NULL, "email" TEXT NOT NULL, "telefone" TEXT NOT NULL, "enderecoFiscal" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "clientes_nomeFantasia_idx" ON "clientes"("nomeFantasia"); CREATE INDEX "clientes_codigoInterno_idx" ON "clientes"("codigoInterno");
CREATE TABLE "produtos" ("id" TEXT PRIMARY KEY, "nome" TEXT NOT NULL, "codigoInterno" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "produtos_nome_idx" ON "produtos"("nome"); CREATE INDEX "produtos_codigoInterno_idx" ON "produtos"("codigoInterno");
CREATE TABLE "locais" ("id" TEXT PRIMARY KEY, "cidade" TEXT NOT NULL, "valorComissao" DECIMAL(14,2) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "locais_cidade_idx" ON "locais"("cidade");
CREATE TABLE "veiculos" ("id" TEXT PRIMARY KEY, "placa" TEXT NOT NULL, "modelo" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "veiculos_placa_idx" ON "veiculos"("placa");

CREATE TABLE "viagens" ("id" TEXT PRIMARY KEY, "placa" TEXT NOT NULL, "motoristaId" TEXT NOT NULL, "valorFrete" DECIMAL(14,2) NOT NULL, "dataManifesto" DATE NOT NULL, "cidadeEntrega" TEXT NOT NULL, "distanciaKm" DECIMAL(14,2) NOT NULL, "valorPedagio" DECIMAL(14,2) NOT NULL, "valorDiaria" DECIMAL(14,2) NOT NULL, "valorAbastecimento" DECIMAL(14,2) NOT NULL, "valorChapa" DECIMAL(14,2) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "viagens_motoristaId_idx" ON "viagens"("motoristaId"); CREATE INDEX "viagens_placa_idx" ON "viagens"("placa"); CREATE INDEX "viagens_dataManifesto_idx" ON "viagens"("dataManifesto");
ALTER TABLE "viagens" ADD CONSTRAINT "viagens_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "fechamentos" ("id" TEXT PRIMARY KEY, "motoristaId" TEXT NOT NULL, "dataInicio" DATE NOT NULL, "dataFim" DATE NOT NULL, "valorTotal" DECIMAL(14,2) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "fechamentos_motoristaId_idx" ON "fechamentos"("motoristaId"); CREATE INDEX "fechamentos_dataInicio_dataFim_idx" ON "fechamentos"("dataInicio", "dataFim");
ALTER TABLE "fechamentos" ADD CONSTRAINT "fechamentos_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "fechamento_viagens" ("id" TEXT PRIMARY KEY, "fechamentoId" TEXT NOT NULL, "localId" TEXT NOT NULL, "quantidade" INTEGER NOT NULL);
CREATE INDEX "fechamento_viagens_fechamentoId_idx" ON "fechamento_viagens"("fechamentoId"); CREATE INDEX "fechamento_viagens_localId_idx" ON "fechamento_viagens"("localId");
ALTER TABLE "fechamento_viagens" ADD CONSTRAINT "fechamento_viagens_fechamentoId_fkey" FOREIGN KEY ("fechamentoId") REFERENCES "fechamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fechamento_viagens" ADD CONSTRAINT "fechamento_viagens_localId_fkey" FOREIGN KEY ("localId") REFERENCES "locais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "manifestos" ("id" TEXT PRIMARY KEY, "clienteId" TEXT NOT NULL, "dataManifesto" DATE NOT NULL, "tipoManifesto" "TipoManifesto" NOT NULL, "pdfUrl" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "manifestos_clienteId_idx" ON "manifestos"("clienteId"); CREATE INDEX "manifestos_dataManifesto_idx" ON "manifestos"("dataManifesto");
ALTER TABLE "manifestos" ADD CONSTRAINT "manifestos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "manifesto_produtos" ("id" TEXT PRIMARY KEY, "manifestoId" TEXT NOT NULL, "produtoId" TEXT NOT NULL, "quantidade" DECIMAL(14,3) NOT NULL, "valorUnitario" DECIMAL(14,2) NOT NULL, "valorTotal" DECIMAL(14,2) NOT NULL, "tipoManifesto" "TipoManifesto");
CREATE INDEX "manifesto_produtos_manifestoId_idx" ON "manifesto_produtos"("manifestoId"); CREATE INDEX "manifesto_produtos_produtoId_idx" ON "manifesto_produtos"("produtoId");
ALTER TABLE "manifesto_produtos" ADD CONSTRAINT "manifesto_produtos_manifestoId_fkey" FOREIGN KEY ("manifestoId") REFERENCES "manifestos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "manifesto_produtos" ADD CONSTRAINT "manifesto_produtos_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
