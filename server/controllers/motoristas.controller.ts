import { crudController } from "./crud.controller";
import { motoristasService } from "../services/motoristas.service";
export const motoristasController = crudController(motoristasService);
