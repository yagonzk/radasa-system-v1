import { crudController } from "./crud.controller";
import { usuariosService } from "../services/usuarios.service";
export const usuariosController = crudController(usuariosService);
