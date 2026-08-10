import { crudRoutes } from "./crud.routes.js";
import { motoristasController } from "../controllers/motoristas.controller.js";
import { motoristaBody } from "../validators/schemas.js";
export const motoristasRoutes = crudRoutes(motoristasController, motoristaBody);
