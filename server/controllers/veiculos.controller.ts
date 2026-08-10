import { crudController } from "./crud.controller";
import { veiculosService } from "../services/veiculos.service";
export const veiculosController = crudController(veiculosService);
