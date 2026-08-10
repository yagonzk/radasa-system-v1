import { crudRoutes } from "./crud.routes.js";
import { clientesController } from "../controllers/clientes.controller.js";
import { clienteBody } from "../validators/schemas.js";
export const clientesRoutes = crudRoutes(clientesController, clienteBody);
