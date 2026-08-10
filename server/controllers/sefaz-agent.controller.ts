import type { Request, Response } from "express";
import { sefazService } from "../services/sefaz.service";

export const sefazAgentController = {
  status: async (_req: Request, res: Response) => {
    res.json({ status: "ok", ready: true });
  },

  importXml: async (req: Request, res: Response) => {
    const result = await sefazService.importXmlFromAgent(
      req.body.cnpj,
      req.body.fileName,
      req.body.xmlBase64,
    );
    res.status(result.status === "imported" ? 201 : 200).json(result);
  },
};
