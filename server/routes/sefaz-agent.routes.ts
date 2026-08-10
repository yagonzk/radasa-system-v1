import { Router } from "express";
import { sefazAgentController } from "../controllers/sefaz-agent.controller.js";
import { authenticateSefazAgent } from "../middlewares/sefaz-agent-auth.js";
import { validate } from "../middlewares/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { bodySchema } from "../validators/schemas.js";
import { sefazAgentImportBody } from "../validators/sefaz-agent.schemas.js";

export const sefazAgentRoutes = Router();

sefazAgentRoutes.use(authenticateSefazAgent);
sefazAgentRoutes.get("/status", asyncHandler(sefazAgentController.status));
sefazAgentRoutes.post(
  "/import",
  validate(bodySchema(sefazAgentImportBody)),
  asyncHandler(sefazAgentController.importXml),
);
