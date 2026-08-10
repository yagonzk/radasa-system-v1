import { crudController } from "./crud.controller";
import { locaisService } from "../services/locais.service";
export const locaisController = crudController(locaisService);
