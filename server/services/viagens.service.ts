import { prisma } from "../lib/prisma";
import { AppError } from "../utils/app-error";
import { parseDateOnly } from "../utils/date";
import { created, dateOnly, number } from "../utils/serialize";

const serialize = (item: any) => ({
  ...item,
  valorFrete: number(item.valorFrete), distanciaKm: number(item.distanciaKm),
  valorPedagio: number(item.valorPedagio), valorDiaria: number(item.valorDiaria),
  valorAbastecimento: number(item.valorAbastecimento), valorChapa: number(item.valorChapa),
  dataManifesto: dateOnly(item.dataManifesto), createdAt: created(item.createdAt),
});
const data = (input: any) => ({ ...input, dataManifesto: parseDateOnly(input.dataManifesto), createdAt: input.createdAt ? new Date(input.createdAt) : undefined });

async function ensureMotoristaDisponivel(motoristaId: string, viagemId?: string) {
  const motorista = await prisma.motorista.findUnique({
    where: { id: motoristaId },
    select: { status: true },
  });
  if (!motorista) throw new AppError(404, "Motorista não encontrado.");
  if (motorista.status === "ATIVO") return;

  if (viagemId) {
    const atual = await prisma.viagem.findUnique({
      where: { id: viagemId },
      select: { motoristaId: true },
    });
    if (atual?.motoristaId === motoristaId) return;
  }

  throw new AppError(409, "Motorista demitido não pode ser selecionado em uma nova viagem.");
}

export const viagensService = {
  async list() { return (await prisma.viagem.findMany({ orderBy: { createdAt: "desc" } })).map(serialize); },
  async get(id: string) { const item = await prisma.viagem.findUnique({ where: { id } }); if (!item) throw new AppError(404, "Viagem não encontrada."); return serialize(item); },
  async create(input: any) { await ensureMotoristaDisponivel(input.motoristaId); return serialize(await prisma.viagem.create({ data: data(input) })); },
  async update(id: string, input: any) { await ensureMotoristaDisponivel(input.motoristaId, id); const { createdAt, id: _id, ...rest } = data(input); return serialize(await prisma.viagem.update({ where: { id }, data: rest })); },
  async remove(id: string) { await prisma.viagem.delete({ where: { id } }); },
};
