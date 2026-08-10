import { crudRoutes } from "./crud.routes.js";
import { produtosController } from "../controllers/produtos.controller.js";
import { produtoBody } from "../validators/schemas.js";
export const produtosRoutes = crudRoutes(produtosController, produtoBody);
