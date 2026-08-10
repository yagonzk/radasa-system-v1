import { crudController } from "./crud.controller.js";
import { veiculosService } from "../services/veiculos.service.js";
export const veiculosController = crudController(veiculosService);
