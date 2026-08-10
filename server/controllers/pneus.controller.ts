import { crudController } from "./crud.controller.js";
import { pneusService } from "../services/pneus.service.js";
export const pneusController = crudController(pneusService);
