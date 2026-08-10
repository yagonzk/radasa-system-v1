import { crudController } from "./crud.controller";
import { clientesService } from "../services/clientes.service";
export const clientesController = crudController(clientesService);
