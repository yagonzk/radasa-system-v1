ALTER TABLE "abastecimentos"
ADD COLUMN "chaveNfe" TEXT,
ADD COLUMN "numeroNfe" TEXT NOT NULL DEFAULT '',
ADD COLUMN "serieNfe" TEXT NOT NULL DEFAULT '',
ADD COLUMN "emitenteCnpj" TEXT NOT NULL DEFAULT '',
ADD COLUMN "emitenteRazaoSocial" TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX "abastecimentos_chaveNfe_key"
ON "abastecimentos"("chaveNfe");

CREATE INDEX "abastecimentos_emitenteCnpj_idx"
ON "abastecimentos"("emitenteCnpj");
