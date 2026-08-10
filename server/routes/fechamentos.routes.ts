import { crudRoutes } from "./crud.routes.js";
import { fechamentosController } from "../controllers/fechamentos.controller.js";
import { fechamentoBody } from "../validators/schemas.js";
export const fechamentosRoutes = crudRoutes(fechamentosController, fechamentoBody);
