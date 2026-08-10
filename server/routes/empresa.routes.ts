import { crudRoutes } from "./crud.routes.js";
import { empresaController } from "../controllers/empresa.controller.js";
import { empresaBody } from "../validators/schemas.js";

export const empresaRoutes = crudRoutes(empresaController, empresaBody);
