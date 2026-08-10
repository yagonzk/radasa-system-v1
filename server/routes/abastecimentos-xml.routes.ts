import { Router } from "express";
import { prisma } from "../lib/prisma";
import multer from "multer";
import {
  interpretarAbastecimentoXml,
  sugerirVinculosAbastecimento,
} from "../services/abastecimento-xml.service";
import {
  abastecimentosService,
  type PoliticaDuplicidadeAbastecimento,
} from "../services/abastecimentos.service";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 1000,
  },
});

export const abastecimentosXmlRoutes = Router();

abastecimentosXmlRoutes.post(
  "/interpretar",
  upload.array("arquivos", 1000),
  async (req, res, next) => {
    try {
      const files = (req.files ?? []) as Express.Multer.File[];
      const modoDuplicidade =
        String(req.body?.modoDuplicidade ?? "OCULTAR").toUpperCase() ===
        "SINCRONIZAR"
          ? "SINCRONIZAR"
          : "OCULTAR";

      if (!files.length) {
        res.status(400).json({
          message: "Selecione pelo menos um XML de nota de abastecimento.",
        });
        return;
      }

      const results: any[] = [];
      const keys = new Set<string>();
      let jaCadastrados = 0;

      for (const file of files) {
        try {
          if (!file.originalname.toLowerCase().endsWith(".xml")) {
            throw new Error("O arquivo não possui extensão .xml.");
          }

          const document = interpretarAbastecimentoXml(
            file.buffer.toString("utf8"),
          );

          if (!document.chaveNfe) {
            throw new Error("Não foi possível identificar a chave da NF-e.");
          }

          if (keys.has(document.chaveNfe)) {
            throw new Error("Esta NF-e está repetida no lote selecionado.");
          }

          keys.add(document.chaveNfe);

          const existente = await prisma.abastecimento.findUnique({
            where: { chaveNfe: document.chaveNfe },
            select: {
              id: true,
              clienteId: true,
              veiculoId: true,
              hodometro: true,
            },
          });

          if (existente) {
            jaCadastrados += 1;
            if (modoDuplicidade === "OCULTAR") continue;
          }

          const sugestoes = await sugerirVinculosAbastecimento(document);

          const missing: string[] = [];
          if (!sugestoes.cliente) missing.push("cliente/posto");
          if (!sugestoes.veiculo) missing.push("veículo");
          if (document.hodometro === null) missing.push("odômetro");
          if (sugestoes.produtos.some((item) => !item.cadastro)) {
            missing.push("produto");
          }

          results.push({
            fileName: file.originalname,
            status: missing.length ? "PENDENTE" : "COMPLETO",
            erros: [],
            pendencias: Array.from(new Set(missing)),
            documento: document,
            sugestoes,
            jaCadastrado: Boolean(existente),
            existente: existente
              ? {
                  id: existente.id,
                  clienteId: existente.clienteId,
                  veiculoId: existente.veiculoId,
                  hodometro: Number(existente.hodometro),
                }
              : null,
            xmlUrl: `data:${
              file.mimetype || "application/xml"
            };base64,${file.buffer.toString("base64")}`,
          });
        } catch (error) {
          results.push({
            fileName: file.originalname,
            status: "INVALIDO",
            erros: [
              error instanceof Error
                ? error.message
                : "Não foi possível interpretar o XML.",
            ],
            pendencias: [],
            documento: null,
            sugestoes: null,
            xmlUrl: null,
          });
        }
      }

      res.json({
        arquivos: results,
        resumo: {
          quantidade: results.length,
          completos: results.filter((item) => item.status === "COMPLETO")
            .length,
          pendentes: results.filter((item) => item.status === "PENDENTE")
            .length,
          invalidos: results.filter((item) => item.status === "INVALIDO")
            .length,
          jaCadastrados,
          litros: results.reduce(
            (sum: number, item: any) =>
              sum +
              (item.documento?.produtos ?? []).reduce(
                (
                  productSum: number,
                  product: { quantidade?: number | string | null },
                ) => productSum + Number(product.quantidade ?? 0),
                0,
              ),
            0,
          ),
          valor: results.reduce(
            (sum, item) => sum + Number(item.documento?.totais.nota || 0),
            0,
          ),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

abastecimentosXmlRoutes.post("/importar-lote", async (req, res, next) => {
  try {
    const politica = String(
      req.body?.politicaDuplicidade ?? "IGNORAR",
    ).toUpperCase() as PoliticaDuplicidadeAbastecimento;

    if (!["IGNORAR", "ATUALIZAR"].includes(politica)) {
      res.status(400).json({
        message: "politicaDuplicidade deve ser IGNORAR ou ATUALIZAR.",
      });
      return;
    }

    const itens = Array.isArray(req.body?.itens) ? req.body.itens : [];

    if (!itens.length) {
      res.status(400).json({
        message: "Nenhum abastecimento foi enviado para importação.",
      });
      return;
    }

    const invalidos = itens
      .map((item: any, index: number) => ({
        index,
        clienteId: String(item?.clienteId ?? "").trim(),
        veiculoId: String(item?.veiculoId ?? "").trim(),
        chaveNfe: String(item?.chaveNfe ?? "").replace(/\D/g, ""),
        hodometro: Number(item?.hodometro),
        produtos: Array.isArray(item?.produtos) ? item.produtos : [],
      }))
      .filter(
        (item: any) =>
          !item.clienteId ||
          !item.veiculoId ||
          item.chaveNfe.length !== 44 ||
          !Number.isFinite(item.hodometro) ||
          item.hodometro <= 0 ||
          !item.produtos.length ||
          item.produtos.some(
            (produto: any) =>
              !produto?.produtoId ||
              !Number.isFinite(Number(produto?.quantidadeLitros)) ||
              Number(produto?.quantidadeLitros) <= 0 ||
              !Number.isFinite(Number(produto?.valorUnitario)) ||
              Number(produto?.valorUnitario) < 0,
          ),
      );

    if (invalidos.length) {
      res.status(400).json({
        message: `${invalidos.length} item(ns) possuem dados obrigatórios inválidos.`,
        indices: invalidos.map((item: any) => item.index),
      });
      return;
    }

    const resultado = await abastecimentosService.importBatch(
      itens,
      politica,
    );

    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
});

