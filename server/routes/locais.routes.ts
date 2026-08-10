import { crudRoutes } from "./crud.routes";
import { locaisController } from "../controllers/locais.controller";
import { localBody } from "../validators/schemas";
export const locaisRoutes = crudRoutes(locaisController, localBody);
