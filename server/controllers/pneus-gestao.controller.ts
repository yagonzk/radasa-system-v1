import type { Request, Response } from "express";
import { pneusGestaoService } from "../services/pneus-gestao.service";
export const pneusGestaoController={ alerts:async(_req:Request,res:Response)=>res.json(await pneusGestaoService.alerts()), reports:async(req:Request,res:Response)=>res.json(await pneusGestaoService.reports(String(req.query.from??"" )||undefined,String(req.query.to??"")||undefined)) };
