import { crudController } from "./crud.controller.js";
import { produtosService } from "../services/produtos.service.js";
export const produtosController = crudController(produtosService);
