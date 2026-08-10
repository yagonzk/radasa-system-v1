import rateLimit, { type Options } from "express-rate-limit";
import type { RequestHandler } from "express";

export function createRateLimiter(options: Partial<Options>): RequestHandler {
  return rateLimit(options);
}
