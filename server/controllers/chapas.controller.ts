import { crudController } from "./crud.controller";
import { chapasService } from "../services/chapas.service";
export const chapasController = crudController(chapasService);
