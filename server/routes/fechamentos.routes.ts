import { crudRoutes } from "./crud.routes";
import { fechamentosController } from "../controllers/fechamentos.controller";
import { fechamentoBody } from "../validators/schemas";
export const fechamentosRoutes = crudRoutes(fechamentosController, fechamentoBody);
