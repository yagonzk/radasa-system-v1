import type { Request, Response } from "express";
import { pneusManutencaoService } from "../services/pneus-manutencao.service";
export const pneusManutencaoController={
 get:async(req:Request,res:Response)=>res.json(await pneusManutencaoService.get(req.params.id)),
 addSulco:async(req:Request,res:Response)=>res.status(201).json(await pneusManutencaoService.addSulco(req.params.id,req.body)),
 addCalibragem:async(req:Request,res:Response)=>res.status(201).json(await pneusManutencaoService.addCalibragem(req.params.id,req.body)),
 addRecapagem:async(req:Request,res:Response)=>res.status(201).json(await pneusManutencaoService.addRecapagem(req.params.id,req.body)),
 addConserto:async(req:Request,res:Response)=>res.status(201).json(await pneusManutencaoService.addConserto(req.params.id,req.body)),
 addInspecao:async(req:Request,res:Response)=>res.status(201).json(await pneusManutencaoService.addInspecao(req.params.id,req.body)),
};
