import { Router } from "express";
import { crudRoutes } from "./crud.routes";
import { manifestosController } from "../controllers/manifestos.controller";
import { manifestosService } from "../services/manifestos.service";
import { manifestoBody } from "../validators/schemas";
import {
  interpretarTextoManifestoPdf,
  sugerirVinculosManifestoPdf,
  sugerirVinculosManifestosPdf,
} from "../services/manifesto-pdf.service";

export const manifestosRoutes = Router();


function montarPendencias(documento: ReturnType<typeof interpretarTextoManifestoPdf>) {
  const pendencias: string[] = [];
  if (!documento.dataEmissao) pendencias.push("data do romaneio");
  if (!documento.produtos.length) pendencias.push("itens do romaneio");
  if (documento.produtos.some((item) => !item.clienteCodigo || !item.clienteNome)) {
    pendencias.push("cliente de um ou mais itens");
  }
  return pendencias;
}






manifestosRoutes.post(
  "/interpretar-textos-pdf",
  async (req, res, next) => {
    try {
      const textos = Array.isArray(req.body?.textos)
        ? req.body.textos.map((item: unknown) => String(item ?? ""))
        : [];
      if (!textos.length || textos.some((texto: string) => !texto.trim())) {
        res.status(400).json({ message: "Envie ao menos um texto de PDF válido." });
        return;
      }
      if (textos.length > 50) {
        res.status(400).json({ message: "Envie no máximo 50 romaneios por lote." });
        return;
      }

      const documentos = textos.map((texto: string) => interpretarTextoManifestoPdf(texto));
      const sugestoes = await sugerirVinculosManifestosPdf(documentos);
      const resultados = documentos.map((documento, index) => {
        const pendencias: string[] = [];
        if (!documento.dataEmissao) pendencias.push("data do romaneio");
        if (!documento.produtos.length) pendencias.push("itens do romaneio");
        if (documento.produtos.some((item) => !item.clienteCodigo || !item.clienteNome)) {
          pendencias.push("cliente de um ou mais itens");
        }
        return { documento, sugestoes: sugestoes[index], pendencias };
      });

      res.json({ resultados });
    } catch (error) {
      next(error);
    }
  },
);

manifestosRoutes.post(
  "/importar-lote",
  async (req, res, next) => {
    try {
      const parsed = manifestoBody.array().max(20).safeParse(req.body?.items);
      if (!parsed.success) {
        res.status(400).json({
          message: "Há dados inválidos no lote de romaneios.",
          errors: parsed.error.flatten(),
        });
        return;
      }
      res.status(201).json(await manifestosService.createMany(parsed.data));
    } catch (error) {
      next(error);
    }
  },
);

manifestosRoutes.post(
  "/interpretar-texto-pdf",
  async (req, res, next) => {
    try {
      const texto = String(req.body?.texto ?? "");
      if (!texto.trim()) {
        res.status(400).json({ message: "Não foi possível extrair o texto do PDF." });
        return;
      }

      const documento = interpretarTextoManifestoPdf(texto);
      const sugestoes = await sugerirVinculosManifestoPdf(documento);
      const pendencias: string[] = [];

      if (!documento.dataEmissao) pendencias.push("data do romaneio");
      if (!documento.produtos.length) pendencias.push("itens do romaneio");
      if (documento.produtos.some((item) => !item.clienteCodigo || !item.clienteNome)) {
        pendencias.push("cliente de um ou mais itens");
      }

      res.json({ documento, sugestoes, pendencias });
    } catch (error) {
      next(error);
    }
  },
);

manifestosRoutes.patch(
  "/:id/produtos/:produtoId/pagamento",
  async (req, res, next) => {
    try {
      if (typeof req.body?.pago !== "boolean") {
        res.status(400).json({ message: "Informe se o item foi pago." });
        return;
      }
      res.json(
        await manifestosService.updatePagamentoCliente(
          req.params.id,
          req.params.produtoId,
          req.body.pago,
        ),
      );
    } catch (error) {
      next(error);
    }
  },
);

manifestosRoutes.use(crudRoutes(manifestosController, manifestoBody));
