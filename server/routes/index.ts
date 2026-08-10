import { Router } from "express";
import { authenticateIfRequired } from "../middlewares/auth";
import { authRoutes } from "./auth.routes";
import { usuariosRoutes } from "./usuarios.routes";
import { migrationRoutes } from "./migration.routes";
import { motoristasRoutes } from "./motoristas.routes";
import { chapasRoutes } from "./chapas.routes";
import { clientesRoutes } from "./clientes.routes";
import { empresaRoutes } from "./empresa.routes";
import { cnpjRoutes } from "./cnpj.routes";
import { produtosRoutes } from "./produtos.routes";
import { locaisRoutes } from "./locais.routes";
import { veiculosRoutes } from "./veiculos.routes";
import { viagensRoutes } from "./viagens.routes";
import { fechamentosRoutes } from "./fechamentos.routes";
import { manifestosRoutes } from "./manifestos.routes";
import { logsRoutes } from "./logs.routes";
import { abastecimentosRoutes } from "./abastecimentos.routes";
import { abastecimentosXmlRoutes } from "./abastecimentos-xml.routes";
import { pneusRoutes } from "./pneus.routes";
import { estoqueRoutes } from "./estoque.routes";
import { ciotsRoutes } from "./ciots.routes";
import { cteRoutes } from "./cte.routes";
import { pedagiosRoutes } from "./pedagios.routes";
import { auditMutations } from "../middlewares/audit-log";

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
