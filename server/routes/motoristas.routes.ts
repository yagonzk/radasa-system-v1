import { crudRoutes } from "./crud.routes";
import { motoristasController } from "../controllers/motoristas.controller";
import { motoristaBody } from "../validators/schemas";
export const motoristasRoutes = crudRoutes(motoristasController, motoristaBody);
