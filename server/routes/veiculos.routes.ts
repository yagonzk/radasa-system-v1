import { crudRoutes } from "./crud.routes";
import { veiculosController } from "../controllers/veiculos.controller";
import { veiculoBody } from "../validators/schemas";
export const veiculosRoutes = crudRoutes(veiculosController, veiculoBody);
