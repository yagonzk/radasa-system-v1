import { crudController } from "./crud.controller.js";
import { empresaService } from "../services/empresa.service.js";

export const empresaController = crudController(empresaService);
