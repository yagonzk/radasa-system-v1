import { crudController } from "./crud.controller.js";
import { locaisService } from "../services/locais.service.js";
export const locaisController = crudController(locaisService);
