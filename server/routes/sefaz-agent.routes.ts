import { Router } from "express";
import { sefazAgentController } from "../controllers/sefaz-agent.controller";
import { authenticateSefazAgent } from "../middlewares/sefaz-agent-auth";
import { validate } from "../middlewares/validate";
import { asyncHandler } from "../utils/async-handler";
import { bodySchema } from "../validators/schemas";
import { sefazAgentImportBody } from "../validators/sefaz-agent.schemas";

export const sefazAgentRoutes = Router();

sefazAgentRoutes.use(authenticateSefazAgent);
sefazAgentRoutes.get("/status", asyncHandler(sefazAgentController.status));
sefazAgentRoutes.post(
  "/import",
  validate(bodySchema(sefazAgentImportBody)),
  asyncHandler(sefazAgentController.importXml),
);
