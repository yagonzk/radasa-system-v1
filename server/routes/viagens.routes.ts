import { crudRoutes } from "./crud.routes.js";
import { viagensController } from "../controllers/viagens.controller.js";
import { viagemBody } from "../validators/schemas.js";
export const viagensRoutes = crudRoutes(viagensController, viagemBody);
