import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import { asyncHandler } from "../utils/async-handler";
import { logsController } from "../controllers/logs.controller";
export const logsRoutes = Router();
logsRoutes.use(authenticate);
logsRoutes.get("/", asyncHandler(logsController.list));
