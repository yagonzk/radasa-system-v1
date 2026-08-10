import { AppError } from "./app-error";

export function parseDateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(400, "Data inválida. Utilize AAAA-MM-DD.");
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new AppError(400, "Data inválida.");
  return date;
}

export function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}
