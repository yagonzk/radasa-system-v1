-- Retorna o estoque para as três categorias oficiais e adiciona a NF em PDF.
CREATE TYPE "CategoriaEstoque_fixed" AS ENUM ('PISCINA', 'PECA', 'FERRAMENTA');

ALTER TABLE "produtos"
  ALTER COLUMN "categoriaEstoque" DROP DEFAULT,
  ALTER COLUMN "categoriaEstoque" TYPE "CategoriaEstoque_fixed"
  USING CASE
    WHEN lower(trim("categoriaEstoque"::text)) IN ('piscina', 'produtos de piscina', 'produto de piscina') THEN 'PISCINA'::"CategoriaEstoque_fixed"
    WHEN lower(trim("categoriaEstoque"::text)) IN ('peca', 'peça', 'pecas', 'peças') THEN 'PECA'::"CategoriaEstoque_fixed"
    WHEN lower(trim("categoriaEstoque"::text)) IN ('ferramenta', 'ferramentas') THEN 'FERRAMENTA'::"CategoriaEstoque_fixed"
    ELSE 'PISCINA'::"CategoriaEstoque_fixed"
  END,
  ALTER COLUMN "categoriaEstoque" SET DEFAULT 'PISCINA';

DROP TYPE IF EXISTS "CategoriaEstoque";
ALTER TYPE "CategoriaEstoque_fixed" RENAME TO "CategoriaEstoque";

ALTER TABLE "estoque_movimentacoes"
  ADD COLUMN "pdfUrl" TEXT,
  ADD COLUMN "pdfName" TEXT;
