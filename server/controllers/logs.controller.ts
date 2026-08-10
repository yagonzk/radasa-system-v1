import type { Request, Response } from "express";
import { logsService } from "../services/logs.service.js";
export const logsController = { list: async (_req: Request, res: Response) => res.json(await logsService.list()) };
