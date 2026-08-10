import { crudController } from "./crud.controller.js";
import { motoristasService } from "../services/motoristas.service.js";
export const motoristasController = crudController(motoristasService);
