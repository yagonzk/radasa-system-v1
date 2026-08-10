import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

function safeEqual(received: string, expected: string) {
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function authenticateSefazAgent(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!env.SEFAZ_FOLDER_AGENT_ENABLED) {
    return res.status(503).json({ message: "Agente de XML desativado." });
  }

  const expected = env.SEFAZ_FOLDER_AGENT_TOKEN;
  const received = req.header("x-radasa-agent-token") ?? "";

  if (!expected || !safeEqual(received, expected)) {
    return res.status(401).json({ message: "Token do agente inválido." });
  }

  next();
}
