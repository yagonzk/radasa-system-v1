-- Preserva a ordem original dos produtos exatamente como aparecem no romaneio PDF.
ALTER TABLE "manifesto_produtos" ADD COLUMN IF NOT EXISTS "ordemPdf" INTEGER NOT NULL DEFAULT 0;
