import { prisma } from "../lib/prisma";
import { AppError } from "../utils/app-error";
import { parseDateOnly } from "../utils/date";
import { created, dateOnly, number } from "../utils/serialize";

const include = { produtos: true } as const;

const serialize = (item: any) => ({
  ...item,
  valorDesconto: number(item.valorDesconto),
  valorTotal: number(item.valorTotal),
  hodometro: number(item.hodometro),
  chaveNfe: item.chaveNfe ?? null,
  numeroNfe: item.numeroNfe ?? "",
  serieNfe: item.serieNfe ?? "",
  emitenteCnpj: item.emitenteCnpj ?? "",
  emitenteRazaoSocial: item.emitenteRazaoSocial ?? "",
  emitenteNomeFantasia: item.emitenteNomeFantasia ?? "",
  emitenteInscricaoEstadual: item.emitenteInscricaoEstadual ?? "",
  emitenteEndereco: item.emitenteEndereco ?? "",
  emitenteCidade: item.emitenteCidade ?? "",
  emitenteUf: item.emitenteUf ?? "",
  destinatarioCnpjCpf: item.destinatarioCnpjCpf ?? "",
  destinatarioRazaoSocial: item.destinatarioRazaoSocial ?? "",
  destinatarioEndereco: item.destinatarioEndereco ?? "",
  destinatarioCidade: item.destinatarioCidade ?? "",
  destinatarioUf: item.destinatarioUf ?? "",
  naturezaOperacao: item.naturezaOperacao ?? "",
  placaXml: item.placaXml ?? "",
  hodometroOrigem: item.hodometroOrigem ?? "",
  valorProdutos: number(item.valorProdutos),
  valorFrete: number(item.valorFrete),
  valorSeguro: number(item.valorSeguro),
  valorOutros: number(item.valorOutros),
  valorIcms: number(item.valorIcms),
  valorPis: number(item.valorPis),
  valorCofins: number(item.valorCofins),
  informacoesComplementares: item.informacoesComplementares ?? "",
  dataEmissao: dateOnly(item.dataEmissao),
  createdAt: created(item.createdAt),
  produtos: (item.produtos ?? []).map((produto: any) => ({
    produtoId: produto.produtoId,
    quantidadeLitros: number(produto.quantidadeLitros),
    valorUnitario: number(produto.valorUnitario),
    valorTotal: number(produto.valorTotal),
  })),
});

async function ensureReferences(clienteId: string, veiculoId: string, produtoIds: string[]) {
  const [cliente, veiculo, produtos] = await Promise.all([
    prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true } }),
    prisma.veiculo.findUnique({ where: { id: veiculoId }, select: { id: true } }),
    prisma.produto.findMany({ where: { id: { in: produtoIds } }, select: { id: true } }),
  ]);
  if (!cliente) throw new AppError(404, "Cliente não encontrado.");
  if (!veiculo) throw new AppError(404, "Veículo não encontrado.");
  if (produtos.length !== new Set(produtoIds).size) throw new AppError(404, "Um ou mais produtos não foram encontrados.");
}

function buildProducts(produtos: any[]) {
  return produtos.map((produto) => {
    const quantidadeLitros = Number(produto.quantidadeLitros);
    const valorUnitario = Number(produto.valorUnitario);
    return {
      produtoId: produto.produtoId,
      quantidadeLitros,
      valorUnitario,
      valorTotal: Number((quantidadeLitros * valorUnitario).toFixed(2)),
    };
  });
}

function buildHeader(input: any, produtos: ReturnType<typeof buildProducts>) {
  const valorDesconto = Number(input.valorDesconto ?? 0);
  const valorBruto = produtos.reduce((sum, produto) => sum + produto.valorTotal, 0);
  if (valorDesconto > valorBruto) {
    throw new AppError(400, "O valor do desconto não pode ser maior que o valor bruto.");
  }
  return {
    clienteId: input.clienteId,
    veiculoId: input.veiculoId,
    chaveNfe: input.chaveNfe || null,
    numeroNfe: input.numeroNfe || "",
    serieNfe: input.serieNfe || "",
    emitenteCnpj: input.emitenteCnpj || "",
    emitenteRazaoSocial: input.emitenteRazaoSocial || "",
    emitenteNomeFantasia: input.emitenteNomeFantasia || "",
    emitenteInscricaoEstadual: input.emitenteInscricaoEstadual || "",
    emitenteEndereco: input.emitenteEndereco || "",
    emitenteCidade: input.emitenteCidade || "",
    emitenteUf: input.emitenteUf || "",
    destinatarioCnpjCpf: input.destinatarioCnpjCpf || "",
    destinatarioRazaoSocial: input.destinatarioRazaoSocial || "",
    destinatarioEndereco: input.destinatarioEndereco || "",
    destinatarioCidade: input.destinatarioCidade || "",
    destinatarioUf: input.destinatarioUf || "",
    naturezaOperacao: input.naturezaOperacao || "",
    placaXml: input.placaXml || "",
    hodometroOrigem: input.hodometroOrigem || "",
    valorProdutos: input.valorProdutos || 0,
    valorFrete: input.valorFrete || 0,
    valorSeguro: input.valorSeguro || 0,
    valorOutros: input.valorOutros || 0,
    valorIcms: input.valorIcms || 0,
    valorPis: input.valorPis || 0,
    valorCofins: input.valorCofins || 0,
    informacoesComplementares: input.informacoesComplementares || "",
    dataEmissao: parseDateOnly(input.dataEmissao),
    valorDesconto,
    valorTotal: Number((valorBruto - valorDesconto).toFixed(2)),
    hodometro: Number(input.hodometro),
    pdfUrl: input.pdfUrl || null,
    xmlUrl: input.xmlUrl || null,
    ...(input.createdAt ? { createdAt: new Date(input.createdAt) } : {}),
  };
}


export type PoliticaDuplicidadeAbastecimento = "IGNORAR" | "ATUALIZAR";

export interface AbastecimentoImportacaoItem {
  clienteId: string;
  veiculoId: string;
  chaveNfe: string;
  numeroNfe?: string;
  serieNfe?: string;
  emitenteCnpj?: string;
  emitenteRazaoSocial?: string;
  emitenteNomeFantasia?: string;
  emitenteInscricaoEstadual?: string;
  emitenteEndereco?: string;
  emitenteCidade?: string;
  emitenteUf?: string;
  destinatarioCnpjCpf?: string;
  destinatarioRazaoSocial?: string;
  destinatarioEndereco?: string;
  destinatarioCidade?: string;
  destinatarioUf?: string;
  naturezaOperacao?: string;
  placaXml?: string;
  hodometroOrigem?: string;
  valorProdutos?: number;
  valorFrete?: number;
  valorSeguro?: number;
  valorOutros?: number;
  valorIcms?: number;
  valorPis?: number;
  valorCofins?: number;
  informacoesComplementares?: string;
  dataEmissao: string;
  valorDesconto?: number;
  hodometro: number;
  xmlUrl?: string | null;
  produtos: Array<{
    produtoId: string;
    quantidadeLitros: number;
    valorUnitario: number;
  }>;
}

async function importarItem(
  tx: any,
  input: AbastecimentoImportacaoItem,
  politica: PoliticaDuplicidadeAbastecimento,
) {
  const chaveNfe = String(input.chaveNfe ?? "").replace(/\D/g, "");

  if (chaveNfe.length !== 44) {
    throw new AppError(400, "A chave da NF-e deve possuir 44 dígitos.");
  }

  const produtos = buildProducts(input.produtos);
  await ensureReferences(
    input.clienteId,
    input.veiculoId,
    produtos.map((produto) => produto.produtoId),
  );

  const existing = await tx.abastecimento.findUnique({
    where: { chaveNfe },
    include,
  });

  if (existing && politica === "IGNORAR") {
    return {
      acao: "IGNORADO" as const,
      item: serialize(existing),
    };
  }

  const data = {
    ...buildHeader(
      {
        ...input,
        chaveNfe,
      },
      produtos,
    ),
    chaveNfe,
    numeroNfe: input.numeroNfe || "",
    serieNfe: input.serieNfe || "",
    emitenteCnpj: String(input.emitenteCnpj ?? "").replace(/\D/g, ""),
    emitenteRazaoSocial: input.emitenteRazaoSocial || "",
  };

  if (existing) {
    await tx.abastecimentoProduto.deleteMany({
      where: { abastecimentoId: existing.id },
    });

    const updatedItem = await tx.abastecimento.update({
      where: { id: existing.id },
      data: {
        ...data,
        produtos: { create: produtos },
      },
      include,
    });

    return {
      acao: "ATUALIZADO" as const,
      item: serialize(updatedItem),
    };
  }

  const createdItem = await tx.abastecimento.create({
    data: {
      ...data,
      produtos: { create: produtos },
    },
    include,
  });

  return {
    acao: "CRIADO" as const,
    item: serialize(createdItem),
  };
}

export const abastecimentosService = {
  async list() {
    return (await prisma.abastecimento.findMany({
      include,
      orderBy: [{ dataEmissao: "desc" }, { createdAt: "desc" }, { hodometro: "desc" }],
    })).map(serialize);
  },

  async get(id: string) {
    const item = await prisma.abastecimento.findUnique({ where: { id }, include });
    if (!item) throw new AppError(404, "Abastecimento não encontrado.");
    return serialize(item);
  },

  async create(input: any) {
    const produtos = buildProducts(input.produtos);
    await ensureReferences(input.clienteId, input.veiculoId, produtos.map((p) => p.produtoId));
    return serialize(await prisma.abastecimento.create({
      data: {
        ...buildHeader(input, produtos),
        produtos: { create: produtos },
      },
      include,
    }));
  },

  async update(id: string, input: any) {
    const current = await prisma.abastecimento.findUnique({ where: { id }, include });
    if (!current) throw new AppError(404, "Abastecimento não encontrado.");
    const merged = {
      clienteId: input.clienteId ?? current.clienteId,
      veiculoId: input.veiculoId ?? current.veiculoId,
      dataEmissao: input.dataEmissao ?? dateOnly(current.dataEmissao),
      chaveNfe: input.chaveNfe === undefined ? current.chaveNfe : input.chaveNfe,
      numeroNfe: input.numeroNfe ?? current.numeroNfe,
      serieNfe: input.serieNfe ?? current.serieNfe,
      emitenteCnpj: input.emitenteCnpj ?? current.emitenteCnpj,
      emitenteRazaoSocial:
        input.emitenteRazaoSocial ?? current.emitenteRazaoSocial,
      emitenteNomeFantasia:
        input.emitenteNomeFantasia ?? current.emitenteNomeFantasia,
      emitenteInscricaoEstadual:
        input.emitenteInscricaoEstadual ?? current.emitenteInscricaoEstadual,
      emitenteEndereco: input.emitenteEndereco ?? current.emitenteEndereco,
      emitenteCidade: input.emitenteCidade ?? current.emitenteCidade,
      emitenteUf: input.emitenteUf ?? current.emitenteUf,
      destinatarioCnpjCpf:
        input.destinatarioCnpjCpf ?? current.destinatarioCnpjCpf,
      destinatarioRazaoSocial:
        input.destinatarioRazaoSocial ?? current.destinatarioRazaoSocial,
      destinatarioEndereco:
        input.destinatarioEndereco ?? current.destinatarioEndereco,
      destinatarioCidade:
        input.destinatarioCidade ?? current.destinatarioCidade,
      destinatarioUf: input.destinatarioUf ?? current.destinatarioUf,
      naturezaOperacao: input.naturezaOperacao ?? current.naturezaOperacao,
      placaXml: input.placaXml ?? current.placaXml,
      hodometroOrigem: input.hodometroOrigem ?? current.hodometroOrigem,
      valorProdutos: input.valorProdutos ?? number(current.valorProdutos),
      valorFrete: input.valorFrete ?? number(current.valorFrete),
      valorSeguro: input.valorSeguro ?? number(current.valorSeguro),
      valorOutros: input.valorOutros ?? number(current.valorOutros),
      valorIcms: input.valorIcms ?? number(current.valorIcms),
      valorPis: input.valorPis ?? number(current.valorPis),
      valorCofins: input.valorCofins ?? number(current.valorCofins),
      informacoesComplementares:
        input.informacoesComplementares ?? current.informacoesComplementares,
      produtos: input.produtos ?? current.produtos.map((p) => ({
        produtoId: p.produtoId,
        quantidadeLitros: number(p.quantidadeLitros),
        valorUnitario: number(p.valorUnitario),
      })),
      valorDesconto: input.valorDesconto ?? number(current.valorDesconto),
      hodometro: input.hodometro ?? number(current.hodometro),
      pdfUrl: input.pdfUrl === undefined ? current.pdfUrl : input.pdfUrl,
      xmlUrl: input.xmlUrl === undefined ? current.xmlUrl : input.xmlUrl,
    };
    const produtos = buildProducts(merged.produtos);
    await ensureReferences(merged.clienteId, merged.veiculoId, produtos.map((p) => p.produtoId));
    return serialize(await prisma.$transaction(async (tx) => {
      await tx.abastecimentoProduto.deleteMany({ where: { abastecimentoId: id } });
      return tx.abastecimento.update({
        where: { id },
        data: {
          ...buildHeader(merged, produtos),
          produtos: { create: produtos },
        },
        include,
      });
    }));
  },

  async importBatch(
    inputs: AbastecimentoImportacaoItem[],
    politica: PoliticaDuplicidadeAbastecimento,
  ) {
    if (!inputs.length) {
      throw new AppError(400, "Nenhum abastecimento foi enviado para importação.");
    }

    if (inputs.length > 1000) {
      throw new AppError(400, "Importe no máximo 1000 abastecimentos por lote.");
    }

    const repeatedInBatch = new Set<string>();
    const seen = new Set<string>();

    for (const input of inputs) {
      const key = String(input.chaveNfe ?? "").replace(/\D/g, "");
      if (seen.has(key)) repeatedInBatch.add(key);
      seen.add(key);
    }

    if (repeatedInBatch.size) {
      throw new AppError(
        400,
        `Existem chaves repetidas no lote: ${Array.from(repeatedInBatch)
          .slice(0, 5)
          .join(", ")}.`,
      );
    }

    const resultados: Array<{
      indice: number;
      chaveNfe: string;
      acao: "CRIADO" | "ATUALIZADO" | "IGNORADO" | "ERRO";
      item?: unknown;
      erro?: string;
    }> = [];

    for (let index = 0; index < inputs.length; index += 1) {
      const input = inputs[index];

      try {
        const result = await prisma.$transaction((tx) =>
          importarItem(tx, input, politica),
        );

        resultados.push({
          indice: index,
          chaveNfe: String(input.chaveNfe ?? "").replace(/\D/g, ""),
          acao: result.acao,
          item: result.item,
        });
      } catch (error) {
        resultados.push({
          indice: index,
          chaveNfe: String(input.chaveNfe ?? "").replace(/\D/g, ""),
          acao: "ERRO",
          erro:
            error instanceof Error
              ? error.message
              : "Não foi possível importar o abastecimento.",
        });
      }
    }

    return {
      resultados,
      resumo: {
        total: resultados.length,
        criados: resultados.filter((item) => item.acao === "CRIADO").length,
        atualizados: resultados.filter((item) => item.acao === "ATUALIZADO")
          .length,
        ignorados: resultados.filter((item) => item.acao === "IGNORADO").length,
        erros: resultados.filter((item) => item.acao === "ERRO").length,
      },
    };
  },

  async remove(id: string) {
    await prisma.abastecimento.delete({ where: { id } });
  },
};
