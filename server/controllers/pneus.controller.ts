import { crudController } from "./crud.controller";
import { pneusService } from "../services/pneus.service";
export const pneusController = crudController(pneusService);
