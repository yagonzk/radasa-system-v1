import { crudController } from "./crud.controller";
import { produtosService } from "../services/produtos.service";
export const produtosController = crudController(produtosService);
