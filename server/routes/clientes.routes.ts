import { crudRoutes } from "./crud.routes";
import { clientesController } from "../controllers/clientes.controller";
import { clienteBody } from "../validators/schemas";
export const clientesRoutes = crudRoutes(clientesController, clienteBody);
