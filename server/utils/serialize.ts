import type { Prisma } from "@prisma/client";
import { formatDateOnly } from "./date";

export const number = (value: Prisma.Decimal | number) => Number(value);
export const created = (value: Date) => value.toISOString();
export const dateOnly = formatDateOnly;

export function tipoToDb(value: string) {
  if (value === "Bonificação - Lebrinha") return "BONIFICACAO_LEBRINHA" as const;
  if (value === "Acertar c/ Lebrinha") return "ACERTAR_LEBRINHA" as const;
  return "RECEBER_CLIENTE" as const;
}

export function tipoFromDb(value: string) {
  if (value === "BONIFICACAO_LEBRINHA") return "Bonificação - Lebrinha" as const;
  if (value === "ACERTAR_LEBRINHA") return "Acertar c/ Lebrinha" as const;
  return "Receber c/ Cliente" as const;
}
