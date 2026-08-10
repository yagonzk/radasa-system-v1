import { Router } from "express";
import { migrationController } from "../controllers/migration.controller";
import { validate } from "../middlewares/validate";
import { migrationSchema } from "../validators/schemas";
import { asyncHandler } from "../utils/async-handler";
export const migrationRoutes = Router();
migrationRoutes.post("/local-storage", validate(migrationSchema), asyncHandler(migrationController.importLegacy));
