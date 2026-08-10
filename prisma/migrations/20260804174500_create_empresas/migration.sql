CREATE TABLE "empresas" (
    "id" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT DEFAULT '',
    "cnpj" TEXT NOT NULL,
    "inscricaoEstadual" TEXT DEFAULT '',
    "rntrc" TEXT DEFAULT '',
    "antt" TEXT DEFAULT '',
    "email" TEXT DEFAULT '',
    "telefone" TEXT DEFAULT '',
    "cep" TEXT DEFAULT '',
    "logradouro" TEXT DEFAULT '',
    "numero" TEXT DEFAULT '',
    "complemento" TEXT DEFAULT '',
    "bairro" TEXT DEFAULT '',
    "cidade" TEXT DEFAULT '',
    "uf" TEXT DEFAULT '',
    "certificadoArquivo" TEXT DEFAULT '',
    "certificadoSenha" TEXT DEFAULT '',
    "certificadoValidade" TIMESTAMP(3),
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "empresaPadrao" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "empresas_cnpj_key" ON "empresas"("cnpj");
CREATE INDEX "empresas_cnpj_idx" ON "empresas"("cnpj");
CREATE INDEX "empresas_empresaPadrao_idx" ON "empresas"("empresaPadrao");
