import { crudController } from "./crud.controller";
import { abastecimentosService } from "../services/abastecimentos.service";
export const abastecimentosController = crudController(abastecimentosService);
