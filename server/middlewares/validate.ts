import type { RequestHandler } from "express";
import type { ZodType } from "zod";

export function validate(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse({ body: req.body, params: req.params, query: req.query });
    if (!parsed.success) return next(parsed.error);
    const data = parsed.data as { body?: unknown; params?: unknown; query?: unknown };
    if (data.body !== undefined) req.body = data.body;
    if (data.params !== undefined) req.params = data.params as typeof req.params;
    if (data.query !== undefined) req.query = data.query as typeof req.query;
    next();
  };
}
