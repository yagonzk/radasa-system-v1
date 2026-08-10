import { crudController } from "./crud.controller.js";
import { chapasService } from "../services/chapas.service.js";
export const chapasController = crudController(chapasService);
