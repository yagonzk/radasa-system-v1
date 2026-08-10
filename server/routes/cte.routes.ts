import { Router } from "express";
import multer from "multer";
import { interpretarCteXml } from "../services/cte-documento.service";
import { completarDadosAnttCte } from "../services/cte-antt-auto.service";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 1,
  },
});

export const cteRoutes = Router();

cteRoutes.post(
  "/interpretar",
  upload.array("arquivos", 1),
  async (req, res, next) => {
    try {
      const files = (req.files ?? []) as Express.Multer.File[];
      const file = files[0];

      if (!file) {
        res.status(400).json({ message: "Selecione um arquivo XML de CT-e." });
        return;
      }

      const lowerName = file.originalname.toLowerCase();
      const isXml = lowerName.endsWith(".xml") || file.mimetype.includes("xml");

      if (!isXml) {
        res.status(415).json({
          message: "Apenas arquivos XML do CT-e são suportados.",
        });
        return;
      }

      let result;
      try {
        result = interpretarCteXml(file.buffer.toString("utf8"));
      } catch (error) {
        res.status(422).json({
          message:
            error instanceof Error
              ? error.message
              : "Não foi possível interpretar o XML do CT-e.",
        });
        return;
      }

      if (!result.chave) {
        res.status(422).json({
          message: "Não foi possível identificar a chave do CT-e no XML.",
        });
        return;
      }

      const cte = {
        ...result,
        fileName: file.originalname,
        xmlUrl: `data:${file.mimetype || "application/xml"};base64,${file.buffer.toString("base64")}`,
      };

      res.json({
        ctes: [cte],
        erros: [],
        resumo: {
          quantidade: 1,
          tipoOperacao: "LOTACAO",
          pesoKg: cte.pesoKg,
          valorMercadoria: cte.valorMercadoria,
          valorFrete: cte.valorFrete,
          valorPedagio: cte.valorPedagio,
          cnpjs: cte.destinatarioCnpj ? [cte.destinatarioCnpj] : [],
          contratadoPrincipal: {
            cnpj: cte.destinatarioCnpj,
            razaoSocial: cte.destinatarioNome,
            nomeFantasia: cte.destinatarioNomeFantasia,
            inscricaoEstadual: cte.destinatarioInscricaoEstadual,
            endereco: cte.destinatarioEndereco,
            cidade: cte.destinatarioCidade,
            uf: cte.destinatarioUf,
            valorMercadoria: cte.valorMercadoria,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  },
);


cteRoutes.post("/complementar-antt", async (req, res, next) => {
  try {
    const result = await completarDadosAnttCte(req.body ?? {});
    res.json(result);
  } catch (error) {
    next(error);
  }
});
