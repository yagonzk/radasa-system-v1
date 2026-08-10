import type { Request, Response } from "express";
import { migrationService } from "../services/migration.service";
export const migrationController = { importLegacy: async (req: Request, res: Response) => res.json(await migrationService.importLegacy(req.body)) };
