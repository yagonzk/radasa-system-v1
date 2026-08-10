import { crudController } from "./crud.controller.js";
import { manifestosService } from "../services/manifestos.service.js";
export const manifestosController = crudController(manifestosService);
