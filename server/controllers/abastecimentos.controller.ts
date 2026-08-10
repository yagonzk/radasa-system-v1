import { crudController } from "./crud.controller.js";
import { abastecimentosService } from "../services/abastecimentos.service.js";
export const abastecimentosController = crudController(abastecimentosService);
