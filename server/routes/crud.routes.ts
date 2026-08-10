import { Router } from "express";
import { asyncHandler } from "../utils/async-handler";
import { validate } from "../middlewares/validate";
import { bodySchema, idParamsSchema, partialBodySchema } from "../validators/schemas";
import type { ZodObject, ZodRawShape } from "zod";

export function crudRoutes(controller: any, schema: ZodObject<ZodRawShape>) {
  const router = Router();
  router.get("/", asyncHandler(controller.list));
  router.get("/:id", validate(idParamsSchema), asyncHandler(controller.get));
  router.post("/", validate(bodySchema(schema)), asyncHandler(controller.create));
  router.put("/:id", validate(partialBodySchema(schema)), asyncHandler(controller.update));
  router.delete("/:id", validate(idParamsSchema), asyncHandler(controller.remove));
  return router;
}
