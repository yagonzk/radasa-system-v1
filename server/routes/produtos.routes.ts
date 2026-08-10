import { crudRoutes } from "./crud.routes";
import { produtosController } from "../controllers/produtos.controller";
import { produtoBody } from "../validators/schemas";
export const produtosRoutes = crudRoutes(produtosController, produtoBody);
