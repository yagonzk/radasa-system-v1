import { crudRoutes } from "./crud.routes.js";
import { chapasController } from "../controllers/chapas.controller.js";
import { chapaBody } from "../validators/schemas.js";
export const chapasRoutes = crudRoutes(chapasController, chapaBody);
