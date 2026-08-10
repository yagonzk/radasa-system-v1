import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";
import { created, dateOnly, number } from "../utils/serialize.js";

const serialize = (item: any) => ({
  ...item, quantidade: number(item.quantidade), valorUnitario: number(item.valorUnitario),
  valorTotal: number(item.valorTotal), data: dateOnly(item.data), pdfUrl: item.pdfUrl ?? null, pdfName: item.pdfName ?? null, createdAt: created(item.createdAt),
});

async function saldoProduto(produtoId: string, excludeId?: string) {
  const rows = await prisma.estoqueMovimentacao.findMany({ where: { produtoId, ...(excludeId ? { id: { not: excludeId } } : {}) } });
  return rows.reduce((total, row) => total + (row.tipo === "ENTRADA" ? number(row.quantidade) : -number(row.quantidade)), 0);
}

export const estoqueService = {
  async list() {
    return (await prisma.estoqueMovimentacao.findMany({ include: { produto: true }, orderBy: [{ data: "desc" }, { createdAt: "desc" }] })).map(serialize);
  },
  async resumo() {
    const [produtos, movimentos] = await Promise.all([prisma.produto.findMany({ orderBy: { nome: "asc" } }), prisma.estoqueMovimentacao.findMany()]);
    return produtos.map(produto => {
      const rows = movimentos.filter(row => row.produtoId === produto.id);
      const entradas = rows.filter(row => row.tipo === "ENTRADA").reduce((a,row)=>a+number(row.quantidade),0);
      const saidas = rows.filter(row => row.tipo === "SAIDA").reduce((a,row)=>a+number(row.quantidade),0);
      const valorSaidas = rows.filter(row => row.tipo === "SAIDA").reduce((a,row)=>a+number(row.valorTotal),0);
      return { produto, entradas, saidas, estoque: entradas-saidas, valorSaidas };
    });
  },
  async create(data: any) {
    const produto = await prisma.produto.findUnique({ where: { id: data.produtoId } });
    if (!produto) throw new AppError(404, "Produto não encontrado.");
    const quantidade = Number(data.quantidade); const valorUnitario = Number(data.valorUnitario || 0);
    if (data.tipo === "SAIDA") {
      const saldo = await saldoProduto(data.produtoId);
      if (quantidade > saldo) throw new AppError(409, `Estoque insuficiente. Disponível: ${saldo.toLocaleString("pt-BR")}.`);
    }
    const item = await prisma.estoqueMovimentacao.create({ data: { ...data, quantidade, valorUnitario, valorTotal: quantidade * valorUnitario, data: new Date(`${data.data}T12:00:00.000Z`) }, include: { produto: true } });
    return serialize(item);
  },
  async remove(id: string) {
    const item = await prisma.estoqueMovimentacao.findUnique({ where: { id } });
    if (!item) throw new AppError(404, "Movimentação não encontrada.");
    if (item.tipo === "ENTRADA") {
      const saldoSemEntrada = await saldoProduto(item.produtoId, id);
      if (saldoSemEntrada < 0) throw new AppError(409, "Esta entrada não pode ser removida porque deixaria o estoque negativo.");
    }
    await prisma.estoqueMovimentacao.delete({ where: { id } });
  },
};
