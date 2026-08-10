import { crudController } from "./crud.controller";
import { fechamentosService } from "../services/fechamentos.service";
export const fechamentosController = crudController(fechamentosService);
