import { Router } from "express";
import multer from "multer";
import { crudRoutes } from "./crud.routes";
import { abastecimentosController } from "../controllers/abastecimentos.controller";
import { abastecimentoBody } from "../validators/schemas";
import {
  interpretarDocumentoAbastecimento,
  interpretarTextoPdfAbastecimento,
} from "../services/abastecimento-documento.service";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: 10 * 1024 * 1024,
  },
});

export const abastecimentosRoutes = Router();

abastecimentosRoutes.post("/interpretar-texto-pdf", async (req, res, next) => {
  try {
    const texto = String(req.body?.texto ?? "");
    res.json(await interpretarTextoPdfAbastecimento(texto));
  } catch (error) {
    next(error);
  }
});

abastecimentosRoutes.post(
  "/interpretar-documento",
  upload.single("arquivo"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({
          message: "Selecione um XML ou PDF de nota fiscal.",
        });
        return;
      }

      const result = await interpretarDocumentoAbastecimento(req.file);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

abastecimentosRoutes.use(
  crudRoutes(abastecimentosController, abastecimentoBody),
);
