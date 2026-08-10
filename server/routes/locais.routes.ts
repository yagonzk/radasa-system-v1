import { crudRoutes } from "./crud.routes.js";
import { locaisController } from "../controllers/locais.controller.js";
import { localBody } from "../validators/schemas.js";
export const locaisRoutes = crudRoutes(locaisController, localBody);
