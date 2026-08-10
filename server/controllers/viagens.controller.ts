import { crudController } from "./crud.controller.js";
import { viagensService } from "../services/viagens.service.js";
export const viagensController = crudController(viagensService);
