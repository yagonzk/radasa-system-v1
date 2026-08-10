import { crudController } from "./crud.controller";
import { manifestosService } from "../services/manifestos.service";
export const manifestosController = crudController(manifestosService);
