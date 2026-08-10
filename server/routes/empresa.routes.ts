import { crudRoutes } from "./crud.routes";
import { empresaController } from "../controllers/empresa.controller";
import { empresaBody } from "../validators/schemas";

export const empresaRoutes = crudRoutes(empresaController, empresaBody);
