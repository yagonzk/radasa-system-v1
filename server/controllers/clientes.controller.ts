import { crudController } from "./crud.controller.js";
import { clientesService } from "../services/clientes.service.js";
export const clientesController = crudController(clientesService);
