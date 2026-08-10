ALTER TABLE "produtos"
  ALTER COLUMN "categoriaEstoque" DROP DEFAULT,
  ALTER COLUMN "categoriaEstoque" TYPE TEXT
  USING CASE "categoriaEstoque"::text
    WHEN 'PISCINA' THEN 'Produtos de piscina'
    WHEN 'PECA' THEN 'Peças'
    WHEN 'FERRAMENTA' THEN 'Ferramentas'
    ELSE "categoriaEstoque"::text
  END,
  ALTER COLUMN "categoriaEstoque" SET DEFAULT 'Produtos de piscina';

DROP TYPE IF EXISTS "CategoriaEstoque";
