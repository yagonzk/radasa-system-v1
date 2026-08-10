import { prisma } from "../lib/prisma";
import { parseDateOnly } from "../utils/date";
import { tipoToDb } from "../utils/serialize";

export const migrationService = {
  async importLegacy(data: any) {
    return prisma.$transaction(async tx => {
      for (const x of data.motoristas) await tx.motorista.upsert({ where: { id: x.id }, update: {}, create: { ...x, status: x.status ?? "ATIVO", createdAt: x.createdAt ? new Date(x.createdAt) : undefined } });
      for (const x of data.chapas) await tx.chapa.upsert({ where: { id: x.id }, update: {}, create: { ...x, createdAt: x.createdAt ? new Date(x.createdAt) : undefined } });
      for (const x of data.clientes) await tx.cliente.upsert({ where: { id: x.id }, update: {}, create: { ...x, createdAt: x.createdAt ? new Date(x.createdAt) : undefined } });
      for (const x of data.produtos) await tx.produto.upsert({ where: { id: x.id }, update: {}, create: { ...x, createdAt: x.createdAt ? new Date(x.createdAt) : undefined } });
      for (const x of data.locais) await tx.local.upsert({ where: { id: x.id }, update: {}, create: { ...x, createdAt: x.createdAt ? new Date(x.createdAt) : undefined } });
      for (const x of data.veiculos) await tx.veiculo.upsert({ where: { id: x.id }, update: {}, create: { ...x, modelo: x.modelo || null, createdAt: x.createdAt ? new Date(x.createdAt) : undefined } });
      for (const x of data.viagens) await tx.viagem.upsert({ where: { id: x.id }, update: {}, create: { ...x, dataManifesto: parseDateOnly(x.dataManifesto), createdAt: x.createdAt ? new Date(x.createdAt) : undefined } });
      for (const x of data.fechamentos) {
        const exists = await tx.fechamento.findUnique({ where: { id: x.id } });
        if (!exists) await tx.fechamento.create({ data: { id: x.id, motoristaId: x.motoristaId, dataInicio: parseDateOnly(x.dataInicio), dataFim: parseDateOnly(x.dataFim), valorTotal: x.valorTotal ?? 0, createdAt: x.createdAt ? new Date(x.createdAt) : undefined, viagens: { create: x.viagens } } });
      }
      for (const x of data.manifestos) {
        const exists = await tx.manifesto.findUnique({ where: { id: x.id } });
        if (!exists) await tx.manifesto.create({ data: { id: x.id, clienteId: x.clienteId, dataManifesto: parseDateOnly(x.dataManifesto), tipoManifesto: tipoToDb(x.tipoManifesto), pdfUrl: x.pdfUrl || null, createdAt: x.createdAt ? new Date(x.createdAt) : undefined, produtos: { create: x.produtos.map((p: any) => ({ ...p, tipoManifesto: p.tipoManifesto ? tipoToDb(p.tipoManifesto) : undefined })) } } });
      }
      return { imported: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, Array.isArray(value) ? value.length : 0])) };
    }, { timeout: 60_000 });
  },
};
