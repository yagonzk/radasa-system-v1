import type { RequestHandler } from "express";
import { sanitizeUnknown } from "../utils/sanitize";

export const sanitizeInputs: RequestHandler = (req, _res, next) => {
  if (req.body) req.body = sanitizeUnknown(req.body);
  next();
};
