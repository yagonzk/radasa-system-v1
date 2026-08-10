import { crudController } from "./crud.controller.js";
import { usuariosService } from "../services/usuarios.service.js";
export const usuariosController = crudController(usuariosService);
