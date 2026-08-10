import { Router } from "express";
import { authenticateIfRequired } from "../middlewares/auth.js";
import { authRoutes } from "./auth.routes.js";
import { usuariosRoutes } from "./usuarios.routes.js";
import { migrationRoutes } from "./migration.routes.js";
import { motoristasRoutes } from "./motoristas.routes.js";
import { chapasRoutes } from "./chapas.routes.js";
import { clientesRoutes } from "./clientes.routes.js";
import { empresaRoutes } from "./empresa.routes.js";
import { cnpjRoutes } from "./cnpj.routes.js";
import { produtosRoutes } from "./produtos.routes.js";
import { locaisRoutes } from "./locais.routes.js";
import { veiculosRoutes } from "./veiculos.routes.js";
import { viagensRoutes } from "./viagens.routes.js";
import { fechamentosRoutes } from "./fechamentos.routes.js";
import { manifestosRoutes } from "./manifestos.routes.js";
import { logsRoutes } from "./logs.routes.js";
import { abastecimentosRoutes } from "./abastecimentos.routes.js";
import { abastecimentosXmlRoutes } from "./abastecimentos-xml.routes.js";
import { pneusRoutes } from "./pneus.routes.js";
import { estoqueRoutes } from "./estoque.routes.js";
import { ciotsRoutes } from "./ciots.routes.js";
import { cteRoutes } from "./cte.routes.js";
import { pedagiosRoutes } from "./pedagios.routes.js";
import { auditMutations } from "../middlewares/audit-log.js";

export const apiRoutes = Router();
apiRoutes.get("/health", (_req, res) => res.json({ status: "ok" }));
apiRoutes.use("/auth", authRoutes);
apiRoutes.use("/usuarios", usuariosRoutes);
apiRoutes.use(authenticateIfRequired);
apiRoutes.use(auditMutations);
apiRoutes.use("/logs", logsRoutes);
apiRoutes.use("/migration", migrationRoutes);
apiRoutes.use("/motoristas", motoristasRoutes);
apiRoutes.use("/chapas", chapasRoutes);
apiRoutes.use("/clientes", clientesRoutes);
apiRoutes.use("/empresa", empresaRoutes);
apiRoutes.use("/cnpj", cnpjRoutes);
apiRoutes.use("/produtos", produtosRoutes);
apiRoutes.use("/locais", locaisRoutes);
apiRoutes.use("/veiculos", veiculosRoutes);
apiRoutes.use("/viagens", viagensRoutes);
apiRoutes.use("/pedagios", pedagiosRoutes);
apiRoutes.use("/fechamentos", fechamentosRoutes);
apiRoutes.use("/manifestos", manifestosRoutes);
apiRoutes.use("/romaneios", manifestosRoutes);
apiRoutes.use("/abastecimentos", abastecimentosRoutes);
apiRoutes.use("/abastecimentos/xml", abastecimentosXmlRoutes);
apiRoutes.use("/ciots", ciotsRoutes);
apiRoutes.use("/cte", cteRoutes);

apiRoutes.use("/pneus", pneusRoutes);
apiRoutes.use("/estoque", estoqueRoutes);

// Impede que uma rota /api desconhecida chegue ao fallback do frontend em produção.
apiRoutes.use((_req, res) => {
  res.status(404).json({ message: "Rota de API não encontrada." });
});
