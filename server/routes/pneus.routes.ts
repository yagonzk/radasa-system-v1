import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireRole } from "../middlewares/auth";
import { pneusGestaoController } from "../controllers/pneus-gestao.controller";
import { pneusController } from "../controllers/pneus.controller";
import { pneusOperacoesController } from "../controllers/pneus-operacoes.controller";
import { pneusManutencaoController } from "../controllers/pneus-manutencao.controller";
import { asyncHandler } from "../utils/async-handler";
import { validate } from "../middlewares/validate";
import { bodySchema, partialBodySchema, pneuBody, pneuInstalacaoBody, pneuRetiradaBody, pneuRodizioBody, pneuSulcoBody, pneuCalibragemBody, pneuRecapagemBody, pneuConsertoBody, pneuInspecaoBody } from "../validators/schemas";

export const pneusRoutes = Router();

const manage = requireRole(UserRole.ADMIN, UserRole.GERENTE, UserRole.BORRACHARIA, UserRole.MANUTENCAO, UserRole.USER);
const maintain = requireRole(UserRole.ADMIN, UserRole.GERENTE, UserRole.BORRACHARIA, UserRole.MANUTENCAO, UserRole.USER);

pneusRoutes.get("/gestao/alertas", asyncHandler(pneusGestaoController.alerts));
pneusRoutes.get("/gestao/relatorios", asyncHandler(pneusGestaoController.reports));

pneusRoutes.get("/:id/manutencao", asyncHandler(pneusManutencaoController.get));
pneusRoutes.post("/:id/sulcos", maintain, validate(bodySchema(pneuSulcoBody)), asyncHandler(pneusManutencaoController.addSulco));
pneusRoutes.post("/:id/calibragens", maintain, validate(bodySchema(pneuCalibragemBody)), asyncHandler(pneusManutencaoController.addCalibragem));
pneusRoutes.post("/:id/recapagens", maintain, validate(bodySchema(pneuRecapagemBody)), asyncHandler(pneusManutencaoController.addRecapagem));
pneusRoutes.post("/:id/consertos", maintain, validate(bodySchema(pneuConsertoBody)), asyncHandler(pneusManutencaoController.addConserto));
pneusRoutes.post("/:id/inspecoes", maintain, validate(bodySchema(pneuInspecaoBody)), asyncHandler(pneusManutencaoController.addInspecao));
pneusRoutes.get("/instalacoes", asyncHandler(pneusOperacoesController.listInstallations));
pneusRoutes.get("/rodizios", asyncHandler(pneusOperacoesController.listRotations));
pneusRoutes.post("/rodizios", manage, validate(bodySchema(pneuRodizioBody)), asyncHandler(pneusOperacoesController.rotate));
pneusRoutes.post("/:id/instalar", manage, validate(bodySchema(pneuInstalacaoBody)), asyncHandler(pneusOperacoesController.install));
pneusRoutes.post("/:id/retirar", manage, validate(bodySchema(pneuRetiradaBody)), asyncHandler(pneusOperacoesController.retire));

pneusRoutes.get("/", asyncHandler(pneusController.list));
pneusRoutes.get("/:id", asyncHandler(pneusController.get));
pneusRoutes.post("/", manage, validate(bodySchema(pneuBody)), asyncHandler(pneusController.create));
pneusRoutes.put("/:id", manage, validate(partialBodySchema(pneuBody)), asyncHandler(pneusController.update));
pneusRoutes.delete("/:id", requireRole(UserRole.ADMIN, UserRole.GERENTE), asyncHandler(pneusController.remove));
