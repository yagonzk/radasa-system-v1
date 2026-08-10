import { crudRoutes } from "./crud.routes.js";
import { veiculosController } from "../controllers/veiculos.controller.js";
import { veiculoBody } from "../validators/schemas.js";
export const veiculosRoutes = crudRoutes(veiculosController, veiculoBody);
