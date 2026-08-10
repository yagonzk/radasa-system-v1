import { crudController } from "./crud.controller";
import { empresaService } from "../services/empresa.service";

export const empresaController = crudController(empresaService);
