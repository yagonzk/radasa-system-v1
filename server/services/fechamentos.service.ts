import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";
import { parseDateOnly } from "../utils/date.js";
import { created, dateOnly, number } from "../utils/serialize.js";

const include = { viagens: { select: { localId: true, quantidade: true } } } as const;
const serialize = (item: any) => ({
  id: item.id, motoristaId: item.motoristaId, dataInicio: dateOnly(item.dataInicio), dataFim: dateOnly(item.dataFim),
  viagens: item.viagens.map((v: any) => ({ localId: v.localId, quantidade: v.quantidade })),
  valorTotal: number(item.valorTotal), createdAt: created(item.createdAt),
});
const nested = (input: any) =>
  input.viagens.map((v: any) => ({
    localId: v.localId,
    quantidade: v.quantidade,
  }));

async function calcularValorTotal(viagens: Array<{ localId: string; quantidade: number }>) {
  const localIds = Array.from(new Set(viagens.map((viagem) => viagem.localId)));
  const locais = await prisma.local.findMany({
    where: { id: { in: localIds } },
    select: { id: true, valorComissao: true },
  });

  if (locais.length !== localIds.length) {
    throw new AppError(400, "Um ou mais locais selecionados não foram encontrados.");
  }

  const valoresPorLocal = new Map(
    locais.map((local) => [local.id, number(local.valorComissao)])
  );

  return viagens.reduce((total, viagem) => {
    const valorComissao = valoresPorLocal.get(viagem.localId) ?? 0;
    return total + valorComissao * viagem.quantidade;
  }, 0);
}

async function ensureMotoristaDisponivel(motoristaId: string, fechamentoId?: string) {
  const motorista = await prisma.motorista.findUnique({
    where: { id: motoristaId },
    select: { status: true },
  });
  if (!motorista) throw new AppError(404, "Motorista não encontrado.");
  if (motorista.status === "ATIVO") return;

  if (fechamentoId) {
    const atual = await prisma.fechamento.findUnique({
      where: { id: fechamentoId },
      select: { motoristaId: true },
    });
    if (atual?.motoristaId === motoristaId) return;
  }

  throw new AppError(409, "Motorista demitido não pode ser selecionado em um novo fechamento.");
}

export const fechamentosService = {
  async list() { return (await prisma.fechamento.findMany({ include, orderBy: { createdAt: "desc" } })).map(serialize); },
  async get(id: string) { const item = await prisma.fechamento.findUnique({ where: { id }, include }); if (!item) throw new AppError(404, "Fechamento não encontrado."); return serialize(item); },
  async create(input: any) {
    await ensureMotoristaDisponivel(input.motoristaId);
    const valorTotal = await calcularValorTotal(input.viagens);
    const item = await prisma.fechamento.create({
      include,
      data: {
        id: input.id,
        motoristaId: input.motoristaId,
        dataInicio: parseDateOnly(input.dataInicio),
        dataFim: parseDateOnly(input.dataFim),
        valorTotal,
        createdAt: input.createdAt ? new Date(input.createdAt) : undefined,
        viagens: { create: nested(input) },
      },
    });
    return serialize(item);
  },
  async update(id: string, input: any) {
    await ensureMotoristaDisponivel(input.motoristaId, id);
    const valorTotal = await calcularValorTotal(input.viagens);
    const item = await prisma.$transaction(async (tx) => {
      await tx.fechamentoViagem.deleteMany({ where: { fechamentoId: id } });
      return tx.fechamento.update({
        where: { id },
        include,
        data: {
          motoristaId: input.motoristaId,
          dataInicio: parseDateOnly(input.dataInicio),
          dataFim: parseDateOnly(input.dataFim),
          valorTotal,
          viagens: { create: nested(input) },
        },
      });
    });
    return serialize(item);
  },
  async remove(id: string) { await prisma.fechamento.delete({ where: { id } }); },
};
