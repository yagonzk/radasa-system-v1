import { Router } from "express";
import { migrationController } from "../controllers/migration.controller.js";
import { validate } from "../middlewares/validate.js";
import { migrationSchema } from "../validators/schemas.js";
import { asyncHandler } from "../utils/async-handler.js";
export const migrationRoutes = Router();
migrationRoutes.post("/local-storage", validate(migrationSchema), asyncHandler(migrationController.importLegacy));
