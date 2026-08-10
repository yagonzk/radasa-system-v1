import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/app-error";
import { parseDateOnly } from "../utils/date";
import { created, dateOnly, number, tipoFromDb, tipoToDb } from "../utils/serialize";

const include = { produtos: { orderBy: { id: "asc" as const } } } as const;

type ManifestoDedupeInput = {
  clienteId?: unknown;
  dataManifesto?: unknown;
  placaVeiculo?: unknown;
  romaneios?: unknown;
  notasFiscais?: unknown;
  produtos?: Array<{
    produtoId?: unknown;
    clienteId?: unknown;
    romaneio?: unknown;
    notaFiscal?: unknown;
    serieNf?: unknown;
    quantidade?: unknown;
    valorTotal?: unknown;
  }>;
};

function normalizeKeyPart(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function formatPlate(value: unknown) {
  const normalized = normalizeKeyPart(value).slice(0, 7);
  if (!normalized) return "";
  if (normalized.length <= 3) return normalized;
  return `${normalized.slice(0, 3)}-${normalized.slice(3)}`;
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, "pt-BR", { numeric: true }),
  );
}

function dateKey(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value ?? "").slice(0, 10);
}

export function buildManifestoDedupeKey(input: ManifestoDedupeInput) {
  const produtos = Array.isArray(input.produtos) ? input.produtos : [];
  const romaneios = uniqueSorted(
    [input.romaneios, ...produtos.map((produto) => produto.romaneio)]
      .flatMap((value) => String(value ?? "").toUpperCase().match(/[A-Z0-9]+/g) ?? [])
      .map(normalizeKeyPart),
  );

  if (romaneios.length) {
    return `ROMANEIOS:${romaneios.join("|")}`;
  }

  const notasDosItens = produtos.map((produto) => {
    const nota = normalizeKeyPart(produto.notaFiscal);
    const serie = normalizeKeyPart(produto.serieNf);
    return nota ? `${nota}/${serie}` : "";
  });
  const notasDoCabecalho = String(input.notasFiscais ?? "")
    .split(/[,;\n]+/)
    .map(normalizeKeyPart);
  const notas = uniqueSorted([...notasDosItens, ...notasDoCabecalho]);
  const data = dateKey(input.dataManifesto);
  const placa = normalizeKeyPart(input.placaVeiculo);

  if (notas.length) {
    return `NOTAS:${data}|${placa}|${notas.join("|")}`;
  }

  const itens = produtos.map((produto) => [
    normalizeKeyPart(produto.produtoId),
    normalizeKeyPart(produto.clienteId),
    String(Number(produto.quantidade ?? 0)),
    String(Number(produto.valorTotal ?? 0)),
  ].join(":"));

  return [
    "CONTEUDO",
    data,
    placa,
    normalizeKeyPart(input.clienteId),
    uniqueSorted(itens).join("|"),
  ].join(":");
}

async function assertManifestoIsUnique(
  tx: any,
  input: ManifestoDedupeInput,
  excludeId?: string,
) {
  const dedupeKey = buildManifestoDedupeKey(input);

  // A transação Serializable que envolve esta leitura impede duas gravações
  // concorrentes com a mesma chave lógica.
  const existing = await tx.manifesto.findMany({
    where: excludeId ? { id: { not: excludeId } } : undefined,
    select: {
      id: true,
      clienteId: true,
      dataManifesto: true,
      placaVeiculo: true,
      romaneios: true,
      notasFiscais: true,
      produtos: {
        select: {
          produtoId: true,
          clienteId: true,
          romaneio: true,
          notaFiscal: true,
          serieNf: true,
          quantidade: true,
          valorTotal: true,
        },
      },
    },
  });

  const duplicate = existing.find(
    (item: ManifestoDedupeInput) => buildManifestoDedupeKey(item) === dedupeKey,
  ) as { id?: string } | undefined;

  if (duplicate?.id) {
    throw new AppError(409, "Este romaneio já foi cadastrado.", {
      duplicateId: duplicate.id,
    });
  }
}

async function serializableTransaction<T>(work: (tx: any) => Promise<T>) {
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 15_000,
      });
    } catch (error) {
      const code = (error as { code?: unknown })?.code;

      if (code === "P2034" && attempt < maxRetries) {
        continue;
      }

      if (code === "P2034") {
        throw new AppError(
          409,
          "O romaneio está sendo cadastrado simultaneamente. Tente novamente.",
        );
      }

      throw error;
    }
  }

  throw new AppError(409, "Não foi possível concluir o cadastro do romaneio.");
}

const serialize = (item: any) => ({
  id: item.id,
  clienteId: item.clienteId,
  dataManifesto: dateOnly(item.dataManifesto),
  tipoManifesto: tipoFromDb(item.tipoManifesto),
  pdfUrl: item.pdfUrl ?? undefined,
  pdfStored: item.pdfStored ?? Boolean(item.pdfUrl),
  transportadoraCodigo: item.transportadoraCodigo ?? "",
  transportadoraNome: item.transportadoraNome ?? "",
  veiculoCodigo: item.veiculoCodigo ?? "",
  placaVeiculo: item.placaVeiculo ?? "",
  modeloVeiculo: item.modeloVeiculo ?? "",
  romaneios: item.romaneios ?? "",
  notasFiscais: item.notasFiscais ?? "",
  produtos: item.produtos.map((produto: any) => ({
    id: produto.id,
    produtoId: produto.produtoId,
    clienteId: produto.clienteId ?? item.clienteId,
    romaneio: produto.romaneio ?? "",
    notaFiscal: produto.notaFiscal ?? "",
    serieNf: produto.serieNf ?? "",
    instrucaoCobranca: produto.instrucaoCobranca ?? "",
    quantidade: number(produto.quantidade),
    valorUnitario: number(produto.valorUnitario),
    valorTotal: number(produto.valorTotal),
    tipoManifesto: produto.tipoManifesto
      ? tipoFromDb(produto.tipoManifesto)
      : tipoFromDb(item.tipoManifesto),
    pagoCliente: produto.pagoCliente ?? null,
  })),
  createdAt: created(item.createdAt),
});

const nested = (items: any[], fallbackClientId: string) => {
  const batch = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return items.map((produto, index) => ({
    // O prefixo ordinal no ID preserva a ordem do PDF sem exigir coluna/migration nova.
    id: produto.id || `rmi_${String(index + 1).padStart(6, "0")}_${batch}_${Math.random().toString(36).slice(2, 10)}`,
    produtoId: produto.produtoId,
    clienteId: produto.clienteId || fallbackClientId,
    romaneio: produto.romaneio || "",
    notaFiscal: produto.notaFiscal || "",
    serieNf: produto.serieNf || "",
    instrucaoCobranca: produto.instrucaoCobranca || "",
    quantidade: Number(produto.quantidade),
    valorUnitario: Number(produto.valorUnitario),
    valorTotal: Number(produto.valorTotal),
    tipoManifesto: produto.tipoManifesto
      ? tipoToDb(produto.tipoManifesto)
      : undefined,
    pagoCliente: produto.pagoCliente ?? null,
  }));
};

export const manifestosService = {
  async list() {
    // A listagem não transporta os PDFs em base64. Em lotes grandes isso
    // representava dezenas/centenas de MB baixados novamente após importar.
    const [items, withPdf] = await Promise.all([
      prisma.manifesto.findMany({
        include,
        omit: { pdfUrl: true },
        orderBy: [{ dataManifesto: "desc" }, { createdAt: "desc" }],
      }),
      prisma.manifesto.findMany({
        where: { pdfUrl: { not: null } },
        select: { id: true },
      }),
    ]);
    const pdfIds = new Set(withPdf.map((item) => item.id));
    return items.map((item) => serialize({ ...item, pdfStored: pdfIds.has(item.id) }));
  },

  async get(id: string) {
    const item = await prisma.manifesto.findUnique({ where: { id }, include });
    if (!item) throw new AppError(404, "Romaneio não encontrado.");
    return serialize(item);
  },

  async create(input: any) {
    const clienteId = input.clienteId || input.produtos?.[0]?.clienteId;
    if (!clienteId) throw new AppError(400, "Informe o cliente de pelo menos um item.");
    const item = await serializableTransaction(async (tx) => {
      await assertManifestoIsUnique(tx, { ...input, clienteId });
      return tx.manifesto.create({
        include,
        data: {
          id: input.id,
          clienteId,
          dataManifesto: parseDateOnly(input.dataManifesto),
          tipoManifesto: tipoToDb(input.tipoManifesto),
          pdfUrl: input.pdfUrl || null,
          transportadoraCodigo: input.transportadoraCodigo || "",
          transportadoraNome: input.transportadoraNome || "",
          veiculoCodigo: input.veiculoCodigo || "",
          placaVeiculo: formatPlate(input.placaVeiculo),
          modeloVeiculo: input.modeloVeiculo || "",
          romaneios: input.romaneios || "",
          notasFiscais: input.notasFiscais || "",
          createdAt: input.createdAt ? new Date(input.createdAt) : undefined,
          produtos: { create: nested(input.produtos, clienteId) },
        },
      });
    });
    return serialize(item);
  },

  async createMany(inputs: any[]) {
    if (!Array.isArray(inputs) || !inputs.length) return { imported: [], failed: [] };

    // Em romaneios importados do PDF a chave normalmente é o próprio número do
    // romaneio. Nesse caminho rápido não carregamos todos os itens históricos do
    // banco a cada lote. Só usamos a consulta completa no raro fallback sem número.
    const incomingKeys = inputs.map((input) => buildManifestoDedupeKey(input));
    const onlyRomaneioKeys = incomingKeys.every((key) => key.startsWith("ROMANEIOS:"));
    let knownKeys: Set<string>;

    if (onlyRomaneioKeys) {
      const existing = await prisma.manifesto.findMany({ select: { romaneios: true } });
      knownKeys = new Set(existing.map((item) => buildManifestoDedupeKey(item)));
    } else {
      const existing = await prisma.manifesto.findMany({
        select: {
          id: true,
          clienteId: true,
          dataManifesto: true,
          placaVeiculo: true,
          romaneios: true,
          notasFiscais: true,
          produtos: {
            select: {
              produtoId: true,
              clienteId: true,
              romaneio: true,
              notaFiscal: true,
              serieNf: true,
              quantidade: true,
              valorTotal: true,
            },
          },
        },
      });
      knownKeys = new Set(existing.map((item) => buildManifestoDedupeKey(item)));
    }
    const accepted: Array<{ index: number; input: any; clienteId: string; key: string }> = [];
    const failed: Array<{ index: number; message: string }> = [];

    inputs.forEach((input, index) => {
      const clienteId = input?.clienteId || input?.produtos?.[0]?.clienteId;
      if (!clienteId) {
        failed.push({ index, message: "Informe o cliente de pelo menos um item." });
        return;
      }
      const key = buildManifestoDedupeKey({ ...input, clienteId });
      if (knownKeys.has(key)) {
        failed.push({ index, message: "Este romaneio já foi cadastrado." });
        return;
      }
      knownKeys.add(key);
      accepted.push({ index, input, clienteId, key });
    });

    // A importação em massa não precisa devolver o PDF em base64 nem todos os
    // produtos recém-criados. Retornar só o ID evita baixar de volta dezenas de
    // megabytes que o navegador acabou de enviar.
    const imported: Array<{ index: number; id: string }> = [];
    let nextIndex = 0;
    const workerCount = Math.min(2, accepted.length);
    const workers = Array.from({ length: workerCount }, async () => {
      while (true) {
        const cursor = nextIndex++;
        if (cursor >= accepted.length) return;
        const entry = accepted[cursor];
        try {
          const item = await prisma.manifesto.create({
            select: { id: true },
            data: {
              id: entry.input.id,
              clienteId: entry.clienteId,
              dataManifesto: parseDateOnly(entry.input.dataManifesto),
              tipoManifesto: tipoToDb(entry.input.tipoManifesto),
              pdfUrl: entry.input.pdfUrl || null,
              transportadoraCodigo: entry.input.transportadoraCodigo || "",
              transportadoraNome: entry.input.transportadoraNome || "",
              veiculoCodigo: entry.input.veiculoCodigo || "",
              placaVeiculo: formatPlate(entry.input.placaVeiculo),
              modeloVeiculo: entry.input.modeloVeiculo || "",
              romaneios: entry.input.romaneios || "",
              notasFiscais: entry.input.notasFiscais || "",
              createdAt: entry.input.createdAt ? new Date(entry.input.createdAt) : undefined,
              produtos: { create: nested(entry.input.produtos, entry.clienteId) },
            },
          });
          imported.push({ index: entry.index, id: item.id });
        } catch (error: any) {
          failed.push({
            index: entry.index,
            message: error?.message || "Não foi possível cadastrar este romaneio.",
          });
        }
      }
    });

    await Promise.all(workers);
    imported.sort((a, b) => a.index - b.index);
    failed.sort((a, b) => a.index - b.index);
    return { imported, failed };
  },

  async update(id: string, input: any) {
    const current = await prisma.manifesto.findUnique({ where: { id } });
    if (!current) throw new AppError(404, "Romaneio não encontrado.");
    const clienteId = input.clienteId || input.produtos?.[0]?.clienteId || current.clienteId;
    const item = await serializableTransaction(async (tx) => {
      await assertManifestoIsUnique(tx, { ...input, clienteId }, id);
      await tx.manifestoProduto.deleteMany({ where: { manifestoId: id } });
      return tx.manifesto.update({
        where: { id },
        include,
        data: {
          clienteId,
          dataManifesto: parseDateOnly(input.dataManifesto),
          tipoManifesto: tipoToDb(input.tipoManifesto),
          pdfUrl: input.pdfUrl === undefined ? current.pdfUrl : (input.pdfUrl || null),
          transportadoraCodigo: input.transportadoraCodigo || "",
          transportadoraNome: input.transportadoraNome || "",
          veiculoCodigo: input.veiculoCodigo || "",
          placaVeiculo: formatPlate(input.placaVeiculo),
          modeloVeiculo: input.modeloVeiculo || "",
          romaneios: input.romaneios || "",
          notasFiscais: input.notasFiscais || "",
          produtos: { create: nested(input.produtos, clienteId) },
        },
      });
    });
    return serialize(item);
  },

  async remove(id: string) {
    await prisma.manifesto.delete({ where: { id } });
  },

  async updatePagamentoCliente(manifestoId: string, produtoId: string, pago: boolean) {
    const produto = await prisma.manifestoProduto.findFirst({
      where: { id: produtoId, manifestoId },
      include: { manifesto: true },
    });
    if (!produto) throw new AppError(404, "Item do romaneio não encontrado.");

    const tipo = produto.tipoManifesto
      ? tipoFromDb(produto.tipoManifesto)
      : tipoFromDb(produto.manifesto.tipoManifesto);
    if (tipo !== "Receber c/ Cliente") {
      throw new AppError(400, "Somente itens 'Receber c/ Cliente' possuem controle de pagamento.");
    }

    await prisma.manifestoProduto.update({
      where: { id: produtoId },
      data: { pagoCliente: pago },
    });
    return this.get(manifestoId);
  },
};
