import { z } from "zod";

export const sefazAgentImportBody = z.object({
  cnpj: z.string().transform((value) => value.replace(/\D/g, "")).refine(
    (value) => value.length === 14,
    "CNPJ inválido.",
  ),
  fileName: z.string().trim().min(1).max(255),
  xmlBase64: z.string().min(20).max(8_000_000),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
});
