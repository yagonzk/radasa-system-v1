import { crudController } from "./crud.controller.js";
import { fechamentosService } from "../services/fechamentos.service.js";
export const fechamentosController = crudController(fechamentosService);
