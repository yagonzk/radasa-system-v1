import type { Request, Response } from "express";
import { estoqueService } from "../services/estoque.service.js";
export const estoqueController = {
  list: async (_req:Request,res:Response)=>res.json(await estoqueService.list()),
  resumo: async (_req:Request,res:Response)=>res.json(await estoqueService.resumo()),
  create: async (req:Request,res:Response)=>res.status(201).json(await estoqueService.create(req.body)),
  remove: async (req:Request,res:Response)=>{ await estoqueService.remove(req.params.id); res.status(204).send(); },
};
