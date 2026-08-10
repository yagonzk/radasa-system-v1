import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { logsController } from "../controllers/logs.controller.js";
export const logsRoutes = Router();
logsRoutes.use(authenticate);
logsRoutes.get("/", asyncHandler(logsController.list));
