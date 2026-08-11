-- ============================================================
-- RADASA - COMPATIBILIDADE DO BANCO ANTIGO COM O CÓDIGO ATUAL
-- V13 - 2026-08-11
--
-- Este script é ADITIVO: não contém DELETE, TRUNCATE ou DROP TABLE.
-- Ele preserva os cadastros existentes e cria/ajusta apenas os campos
-- usados pelo código atual em login, clientes, produtos e romaneios.
-- ============================================================

-- ------------------------------------------------------------
-- 1. ENUMS UTILIZADOS PELO SISTEMA
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER', 'GERENTE', 'BORRACHARIA', 'MANUTENCAO', 'VISUALIZACAO');
  END IF;
END $$;

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ADMIN';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'USER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'GERENTE';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'BORRACHARIA';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MANUTENCAO';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'VISUALIZACAO';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoManifesto') THEN
    CREATE TYPE "TipoManifesto" AS ENUM ('BONIFICACAO_LEBRINHA', 'ACERTAR_LEBRINHA', 'RECEBER_CLIENTE');
  END IF;
END $$;

ALTER TYPE "TipoManifesto" ADD VALUE IF NOT EXISTS 'BONIFICACAO_LEBRINHA';
ALTER TYPE "TipoManifesto" ADD VALUE IF NOT EXISTS 'ACERTAR_LEBRINHA';
ALTER TYPE "TipoManifesto" ADD VALUE IF NOT EXISTS 'RECEBER_CLIENTE';

-- ------------------------------------------------------------
-- 2. USERS - LOGIN / PERFIL
-- ------------------------------------------------------------
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "username" TEXT,
  ADD COLUMN IF NOT EXISTS "telefone" TEXT,
  ADD COLUMN IF NOT EXISTS "cpf" TEXT,
  ADD COLUMN IF NOT EXISTS "fotoPerfil" TEXT;

UPDATE "users"
SET "telefone" = ''
WHERE "telefone" IS NULL;

UPDATE "users"
SET "username" =
  COALESCE(
    NULLIF(
      LOWER(
        REGEXP_REPLACE(
          SPLIT_PART(COALESCE("email", ''), '@', 1),
          '[^a-zA-Z0-9._-]',
          '',
          'g'
        )
      ),
      ''
    ),
    'usuario'
  ) || '_' || REGEXP_REPLACE("id", '[^a-zA-Z0-9]', '', 'g')
WHERE "username" IS NULL OR TRIM("username") = '';

-- Resolve usernames duplicados antes de criar o índice único.
WITH duplicados AS (
  SELECT
    "id",
    "username",
    ROW_NUMBER() OVER (PARTITION BY LOWER("username") ORDER BY "id") AS rn
  FROM "users"
  WHERE "username" IS NOT NULL AND TRIM("username") <> ''
)
UPDATE "users" u
SET "username" = u."username" || '_' || REGEXP_REPLACE(u."id", '[^a-zA-Z0-9]', '', 'g')
FROM duplicados d
WHERE u."id" = d."id" AND d.rn > 1;

ALTER TABLE "users" ALTER COLUMN "telefone" SET DEFAULT '';
ALTER TABLE "users" ALTER COLUMN "telefone" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "users_cpf_key" ON "users"("cpf");

-- Só aplica o default se o valor já existe no enum (os ALTER TYPE acima
-- são autocommitados normalmente pelo SQL Editor do Neon).
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'VISUALIZACAO';

-- ------------------------------------------------------------
-- 3. CLIENTES
-- ------------------------------------------------------------
ALTER TABLE "clientes"
  ADD COLUMN IF NOT EXISTS "razaoSocial" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "cnpj" TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS "clientes_nomeFantasia_idx" ON "clientes"("nomeFantasia");
CREATE INDEX IF NOT EXISTS "clientes_codigoInterno_idx" ON "clientes"("codigoInterno");
CREATE INDEX IF NOT EXISTS "clientes_cnpj_idx" ON "clientes"("cnpj");

-- ------------------------------------------------------------
-- 4. PRODUTOS
-- ------------------------------------------------------------
ALTER TABLE "produtos"
  ADD COLUMN IF NOT EXISTS "categoriaEstoque" TEXT;

-- Se a coluna veio de uma versão antiga como ENUM, converte para TEXT.
ALTER TABLE "produtos" ALTER COLUMN "categoriaEstoque" DROP DEFAULT;
ALTER TABLE "produtos"
  ALTER COLUMN "categoriaEstoque" TYPE TEXT
  USING "categoriaEstoque"::TEXT;

UPDATE "produtos"
SET "categoriaEstoque" = CASE
  WHEN "categoriaEstoque" IS NULL OR TRIM("categoriaEstoque") = '' THEN 'Produtos de piscina'
  WHEN UPPER(TRIM("categoriaEstoque")) = 'PISCINA' THEN 'Produtos de piscina'
  WHEN UPPER(TRIM("categoriaEstoque")) = 'PECA' THEN 'Peças'
  WHEN UPPER(TRIM("categoriaEstoque")) = 'FERRAMENTA' THEN 'Ferramentas'
  ELSE "categoriaEstoque"
END;

ALTER TABLE "produtos" ALTER COLUMN "categoriaEstoque" SET DEFAULT 'Produtos de piscina';
ALTER TABLE "produtos" ALTER COLUMN "categoriaEstoque" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "produtos_nome_idx" ON "produtos"("nome");
CREATE INDEX IF NOT EXISTS "produtos_codigoInterno_idx" ON "produtos"("codigoInterno");

-- ------------------------------------------------------------
-- 5. MANIFESTOS / ROMANEIOS - CABEÇALHO
-- ------------------------------------------------------------
ALTER TABLE "manifestos"
  ADD COLUMN IF NOT EXISTS "transportadoraCodigo" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "transportadoraNome" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "veiculoCodigo" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "placaVeiculo" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "modeloVeiculo" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "romaneios" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "notasFiscais" TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS "manifestos_clienteId_idx" ON "manifestos"("clienteId");
CREATE INDEX IF NOT EXISTS "manifestos_dataManifesto_idx" ON "manifestos"("dataManifesto");

-- ------------------------------------------------------------
-- 6. ITENS DOS ROMANEIOS
-- ------------------------------------------------------------
ALTER TABLE "manifesto_produtos"
  ADD COLUMN IF NOT EXISTS "clienteId" TEXT,
  ADD COLUMN IF NOT EXISTS "romaneio" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "notaFiscal" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "serieNf" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "instrucaoCobranca" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "pagoCliente" BOOLEAN;

-- O schema inicial já possuía tipoManifesto. Se o banco restaurado for ainda
-- mais antigo, garante a coluna sem afetar os registros existentes.
ALTER TABLE "manifesto_produtos"
  ADD COLUMN IF NOT EXISTS "tipoManifesto" "TipoManifesto";

-- Preenche clienteId dos itens antigos usando o cliente do manifesto pai.
UPDATE "manifesto_produtos" mp
SET "clienteId" = m."clienteId"
FROM "manifestos" m
WHERE mp."manifestoId" = m."id"
  AND mp."clienteId" IS NULL;

CREATE INDEX IF NOT EXISTS "manifesto_produtos_manifestoId_idx" ON "manifesto_produtos"("manifestoId");
CREATE INDEX IF NOT EXISTS "manifesto_produtos_produtoId_idx" ON "manifesto_produtos"("produtoId");
CREATE INDEX IF NOT EXISTS "manifesto_produtos_clienteId_idx" ON "manifesto_produtos"("clienteId");

-- Adiciona a FK de cliente por item somente se ainda não existir.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'manifesto_produtos_clienteId_fkey'
  ) THEN
    ALTER TABLE "manifesto_produtos"
      ADD CONSTRAINT "manifesto_produtos_clienteId_fkey"
      FOREIGN KEY ("clienteId") REFERENCES "clientes"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 7. DIAGNÓSTICO FINAL - DEVE RETORNAR ZERO LINHAS
-- ------------------------------------------------------------
WITH esperado(tabela, coluna) AS (
  VALUES
    ('users','username'), ('users','telefone'), ('users','cpf'), ('users','fotoPerfil'),
    ('clientes','razaoSocial'), ('clientes','cnpj'),
    ('produtos','categoriaEstoque'),
    ('manifestos','transportadoraCodigo'), ('manifestos','transportadoraNome'),
    ('manifestos','veiculoCodigo'), ('manifestos','placaVeiculo'),
    ('manifestos','modeloVeiculo'), ('manifestos','romaneios'), ('manifestos','notasFiscais'),
    ('manifesto_produtos','clienteId'), ('manifesto_produtos','romaneio'),
    ('manifesto_produtos','notaFiscal'), ('manifesto_produtos','serieNf'),
    ('manifesto_produtos','instrucaoCobranca'), ('manifesto_produtos','tipoManifesto'),
    ('manifesto_produtos','pagoCliente')
)
SELECT e.tabela, e.coluna AS coluna_faltando
FROM esperado e
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = e.tabela
 AND c.column_name = e.coluna
WHERE c.column_name IS NULL
ORDER BY e.tabela, e.coluna;

-- Contagens para confirmar que os dados antigos continuam presentes.
SELECT
  (SELECT COUNT(*) FROM "users") AS usuarios,
  (SELECT COUNT(*) FROM "clientes") AS clientes,
  (SELECT COUNT(*) FROM "produtos") AS produtos,
  (SELECT COUNT(*) FROM "manifestos") AS manifestos,
  (SELECT COUNT(*) FROM "manifesto_produtos") AS itens_manifestos;
