import { crudController } from "./crud.controller";
import { viagensService } from "../services/viagens.service";
export const viagensController = crudController(viagensService);
