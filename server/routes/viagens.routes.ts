import { crudRoutes } from "./crud.routes";
import { viagensController } from "../controllers/viagens.controller";
import { viagemBody } from "../validators/schemas";
export const viagensRoutes = crudRoutes(viagensController, viagemBody);
