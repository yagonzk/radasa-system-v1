import type { Request, Response } from "express";
import { pneusOperacoesService } from "../services/pneus-operacoes.service";

export const pneusOperacoesController = {
  async listInstallations(_req: Request, res: Response) { res.json(await pneusOperacoesService.listInstallations()); },
  async install(req: Request, res: Response) { res.status(201).json(await pneusOperacoesService.install(req.params.id, req.body)); },
  async retire(req: Request, res: Response) { res.json(await pneusOperacoesService.retire(req.params.id, req.body)); },
  async listRotations(_req: Request, res: Response) { res.json(await pneusOperacoesService.listRotations()); },
  async rotate(req: Request, res: Response) { res.status(201).json(await pneusOperacoesService.rotate(req.body)); },
};
