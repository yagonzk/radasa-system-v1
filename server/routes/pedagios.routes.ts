import { Router } from "express";
import { z } from "zod";
import { calculateTolls, pedagiosProviderStatus } from "../services/pedagios.service.js";
import { createPedagio, deletePedagio, listPedagios, materializeAutomaticPedagios, updatePedagio } from "../services/pedagios-storage.service.js";

export const pedagiosRoutes = Router();

const vehicleTypes = [
  "TRUCK_WITH_TWO_SINGLE_AXIS",
  "TRUCK_WITH_THREE_DOUBLE_AXLES",
  "TRUCK_WITH_FOUR_DOUBLE_AXLES",
  "TRUCK_WITH_FIVE_DOUBLE_AXLES",
  "TRUCK_WITH_SIX_DOUBLE_AXLES",
  "TRUCK_WITH_SEVEN_DOUBLE_AXLES",
  "TRUCK_WITH_EIGHT_DOUBLE_AXLES",
  "TRUCK_WITH_NINE_DOUBLE_AXLES",
  "TRUCK_WITH_TEN_DOUBLE_AXLES",
] as const;

const citySchema = z.object({ name: z.string().min(1).max(120), uf: z.string().length(2) });
const calculationSchema = z.object({
  points: z.array(z.object({ latitude: z.number(), longitude: z.number() })).min(2).max(20_000),
  origin: citySchema,
  destination: citySchema,
  vehicleType: z.enum(vehicleTypes),
  billingType: z.enum(["NORMAL", "TAG"]).default("NORMAL"),
  calculationDate: z.number().int().positive().optional(),
});

const tollSchema = z.object({
  nome: z.string().trim().min(2).max(160),
  rodovia: z.string().trim().max(50).default(""),
  km: z.string().trim().max(30).default(""),
  cidade: z.string().trim().max(120).default(""),
  uf: z.string().trim().max(2).transform((value) => value.toUpperCase()).default(""),
  concessionaria: z.string().trim().max(160).default(""),
  latitude: z.coerce.number().min(-35).max(6),
  longitude: z.coerce.number().min(-75).max(-30),
  raioKm: z.coerce.number().min(0.2).max(3).default(1.5),
  valorPorEixo: z.coerce.number().min(0).max(10000),
  ativo: z.boolean().default(true),
  observacoes: z.string().trim().max(2000).optional().nullable(),
});

function serialize(row: any) {
  return {
    ...row,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    raioKm: Number(row.raioKm),
    valorPorEixo: Number(row.valorPorEixo),
  };
}

function storageErrorMessage(error: any, action = "salvar o pedágio") {
  const detail = String(error?.message ?? "");
  return detail ? `Não foi possível ${action}: ${detail}` : `Não foi possível ${action}.`;
}

pedagiosRoutes.get("/status", async (req, res, next) => {
  try {
    if (req.user?.id) await materializeAutomaticPedagios(req.user.id);
    res.json(await pedagiosProviderStatus());
  } catch (error) { next(error); }
});

pedagiosRoutes.get("/cadastros", async (req, res, next) => {
  try {
    if (req.user?.id) await materializeAutomaticPedagios(req.user.id);
    const rows = await listPedagios(false);
    res.json(rows.map(serialize));
  } catch (error) { next(error); }
});

pedagiosRoutes.post("/cadastros", async (req, res, next) => {
  try {
    const input = tollSchema.parse(req.body);
    const row = await createPedagio(input, req.user!.id);
    res.status(201).json(serialize(row));
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: "Dados inválidos", issues: error.issues });
      return;
    }
    console.error("[PEDAGIOS] Falha ao salvar cadastro:", error);
    res.status(500).json({ message: storageErrorMessage(error, "salvar o pedágio") });
  }
});

pedagiosRoutes.put("/cadastros/:id", async (req, res, next) => {
  try {
    const input = tollSchema.parse(req.body);
    const row = await updatePedagio(req.params.id, input, req.user!.id);
    if (!row) { res.status(404).json({ message: "Pedágio não encontrado." }); return; }
    res.json(serialize(row));
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: "Dados inválidos", issues: error.issues });
      return;
    }
    console.error("[PEDAGIOS] Falha ao atualizar cadastro:", error);
    res.status(500).json({ message: storageErrorMessage(error, "salvar as alterações") });
  }
});

pedagiosRoutes.delete("/cadastros/:id", async (req, res, next) => {
  try {
    const removed = await deletePedagio(req.params.id, req.user!.id);
    if (!removed) { res.status(404).json({ message: "Pedágio não encontrado." }); return; }
    res.status(204).end();
  } catch (error) { next(error); }
});

pedagiosRoutes.post("/calcular", async (req, res, next) => {
  try {
    const input = calculationSchema.parse(req.body);
    res.json(await calculateTolls(input));
  } catch (error: any) {
    if (String(error?.code ?? "").startsWith("LOCAL_TOLLS_")) {
      res.status(400).json({ code: error.code, message: error?.message || "Não foi possível calcular os pedágios na base local." });
      return;
    }
    next(error);
  }
});
