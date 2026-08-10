import { crudRoutes } from "./crud.routes";
import { chapasController } from "../controllers/chapas.controller";
import { chapaBody } from "../validators/schemas";
export const chapasRoutes = crudRoutes(chapasController, chapaBody);
