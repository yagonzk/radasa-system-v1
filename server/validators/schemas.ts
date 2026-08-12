import { z } from "zod";

const id = z.string().min(1).max(100);
const text = (max = 255) => z.string().trim().min(1).max(max);
const optionalText = (max = 255) => z.string().trim().max(max).optional().or(z.literal(""));
const money = z.coerce.number().finite().min(0);
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use AAAA-MM-DD");

export const idParamsSchema = z.object({
  body: z.unknown().optional(),
  query: z.unknown().optional(),
  params: z.object({ id }),
});

export const motoristaBody = z.object({
  id: id.optional(), nome: text(), cpf: text(30), salarioBase: money,
  status: z.enum(["ATIVO", "DEMITIDO"]).default("ATIVO"), createdAt: z.string().optional(),
});
export const chapaBody = z.object({
  id: id.optional(),
  nome: text(),

  telefone: z
    .string()
    .trim()
    .max(20)
    .transform((value) => value.replace(/\D/g, ""))
    .default(""),

  cpf: z
    .string()
    .trim()
    .max(14)
    .transform((value) => value.replace(/\D/g, ""))
    .refine(
      (value) => !value || value.length === 11,
      "CPF deve possuir 11 dígitos.",
    )
    .default(""),

  cidade: z.string().trim().max(120).default(""),
  chavePix: z.string().trim().max(160).default(""),

  valorFixo: money,
  createdAt: z.string().optional(),
});
export const clienteBody = z.object({
  id: id.optional(), nomeFantasia: text(), razaoSocial: z.string().trim().max(255).default(""), codigoInterno: text(100), cnpj: z.string().trim().max(18).transform(v => v.replace(/\D/g, "")).refine(v => !v || v.length === 14, "CNPJ deve possuir 14 dígitos").default(""), email: z.string().trim().max(255), telefone: z.string().trim().max(100), enderecoFiscal: z.string().trim().max(1000), createdAt: z.string().optional(),
});

export const clienteSyncBody = z.object({
  rows: z.array(z.object({
    rowNumber: z.coerce.number().int().positive(),
    nomeFantasia: z.string().trim().max(255).default(""),
    razaoSocial: z.string().trim().max(255).default(""),
    codigoInterno: z.string().trim().max(100).default(""),
    cnpj: z.string().trim().max(18).transform(v => v.replace(/\D/g, "")).refine(v => !v || v.length === 14, "CNPJ deve possuir 14 dígitos").default(""),
    email: z.string().trim().max(255).default(""),
    telefone: z.string().trim().max(100).default(""),
    enderecoFiscal: z.string().trim().max(1000).default(""),
  })).min(1).max(10000),
});


export const empresaBody = z.object({
  id: id.optional(),
  razaoSocial: text(),
  nomeFantasia: optionalText(255),
  cnpj: z.string().trim().max(18).transform(v => v.replace(/\D/g, "")).refine(v => !v || v.length === 14, "CNPJ deve possuir 14 dígitos"),
  inscricaoEstadual: optionalText(30),
  rntrc: optionalText(30),
  antt: optionalText(30),
  email: z.string().trim().email().optional().or(z.literal("")),
  telefone: optionalText(30),
  cep: optionalText(12),
  logradouro: optionalText(255),
  numero: optionalText(30),
  complemento: optionalText(255),
  bairro: optionalText(255),
  cidade: optionalText(120),
  uf: z.string().trim().max(2).optional().or(z.literal("")),
  certificadoArquivo: optionalText(500),
  certificadoSenha: optionalText(500),
  certificadoValidade: z.string().optional().nullable().or(z.literal("")),
  ativa: z.coerce.boolean().default(true),
  empresaPadrao: z.coerce.boolean().default(false),
  createdAt: z.string().optional(),
});

export const produtoBody = z.object({
  id: id.optional(), nome: text(), codigoInterno: text(100),
  categoriaEstoque: z.string().trim().min(1).max(80).default("Produtos de piscina"),
  createdAt: z.string().optional(),
});

export const estoqueMovimentacaoBody = z.object({
  id: id.optional(), produtoId: id, tipo: z.enum(["ENTRADA", "SAIDA"]),
  quantidade: z.coerce.number().finite().positive(),
  valorUnitario: z.coerce.number().finite().min(0).optional().default(0),
  data: dateOnly, observacoes: z.string().trim().max(2000).optional().or(z.literal("")),
  pdfUrl: z.string().optional().nullable(), pdfName: z.string().trim().max(255).optional().nullable(),
  createdAt: z.string().optional(),
});
export const localBody = z.object({
  id: id.optional(), cidade: text(), valorComissao: money, createdAt: z.string().optional(),
});
export const veiculoBody = z.object({
  id: id.optional(), placa: text(20), modelo: optionalText(255), subcategoria: z.enum(["CAMINHAO", "CARRO", "MOTO"]).optional().nullable(), quantidadePneus: z.coerce.number().int().min(4).max(16).default(10), quantidadeEstepes: z.coerce.number().int().min(0).max(3).default(1), createdAt: z.string().optional(),
});
export const viagemBody = z.object({
  id: id.optional(), placa: text(20), motoristaId: id, valorFrete: money, dataManifesto: dateOnly, cidadeEntrega: text(), distanciaKm: money, valorPedagio: money, valorDiaria: money, valorAbastecimento: money, valorChapa: money, createdAt: z.string().optional(),
});
export const fechamentoBody = z.object({
  id: id.optional(), motoristaId: id, dataInicio: dateOnly, dataFim: dateOnly,
  viagens: z.array(z.object({ localId: id, quantidade: z.coerce.number().int().min(1) })),
  valorTotal: money.optional(), createdAt: z.string().optional(),
});
export const tipoManifesto = z.enum(["Bonificação - Lebrinha", "Acertar c/ Lebrinha", "Receber c/ Cliente"]);
export const manifestoProdutoBody = z.object({
  id: id.optional(), produtoId: id, clienteId: id.optional().nullable(), romaneio: z.string().max(80).optional().default(""), notaFiscal: z.string().max(80).optional().default(""), serieNf: z.string().max(30).optional().default(""), instrucaoCobranca: z.string().max(2000).optional().default(""), quantidade: money, valorUnitario: money, valorTotal: money, tipoManifesto: tipoManifesto.optional(), pagoCliente: z.boolean().nullable().optional().default(null),
});
export const manifestoBody = z.object({
  id: id.optional(),
  clienteId: id,
  dataManifesto: dateOnly,
  produtos: z.array(manifestoProdutoBody).min(1, "Adicione pelo menos um item ao romaneio."),
  tipoManifesto,
  pdfUrl: z.string().max(30_000_000).optional().or(z.literal("")),
  transportadoraCodigo: z.string().max(80).optional().default(""),
  transportadoraNome: z.string().max(255).optional().default(""),
  veiculoCodigo: z.string().max(80).optional().default(""),
  placaVeiculo: z.string().max(20).optional().default(""),
  modeloVeiculo: z.string().max(255).optional().default(""),
  romaneios: z.string().max(10_000).optional().default(""),
  notasFiscais: z.string().max(10_000).optional().default(""),
  createdAt: z.string().optional(),
});

export const abastecimentoProdutoBody = z.object({
  produtoId: id,
  quantidadeLitros: z.coerce.number().finite().positive(),
  valorUnitario: z.coerce.number().finite().min(0),
  valorTotal: money.optional(),
});

export const abastecimentoBody = z.object({
  id: id.optional(), clienteId: id, veiculoId: id, dataEmissao: dateOnly,
  produtos: z.array(abastecimentoProdutoBody).min(1, "Adicione pelo menos um produto."),
  valorDesconto: z.coerce.number().finite().min(0).optional().default(0),
  valorTotal: money.optional(),
  hodometro: z.coerce.number().finite().min(0),
  pdfUrl: z.string().max(20_000_000).optional().nullable().or(z.literal("")),
  xmlUrl: z.string().max(20_000_000).optional().nullable().or(z.literal("")),
  chaveNfe: z.string().trim().max(44).optional().nullable().or(z.literal("")),
  numeroNfe: z.string().trim().max(30).optional().default(""),
  serieNfe: z.string().trim().max(20).optional().default(""),
  emitenteCnpj: z.string().trim().max(18).optional().default(""),
  emitenteRazaoSocial: z.string().trim().max(255).optional().default(""),
  emitenteNomeFantasia: z.string().trim().max(255).optional().default(""),
  emitenteInscricaoEstadual: z.string().trim().max(40).optional().default(""),
  emitenteEndereco: z.string().trim().max(2000).optional().default(""),
  emitenteCidade: z.string().trim().max(160).optional().default(""),
  emitenteUf: z.string().trim().max(2).optional().default(""),
  destinatarioCnpjCpf: z.string().trim().max(18).optional().default(""),
  destinatarioRazaoSocial: z.string().trim().max(255).optional().default(""),
  destinatarioEndereco: z.string().trim().max(2000).optional().default(""),
  destinatarioCidade: z.string().trim().max(160).optional().default(""),
  destinatarioUf: z.string().trim().max(2).optional().default(""),
  naturezaOperacao: z.string().trim().max(255).optional().default(""),
  placaXml: z.string().trim().max(20).optional().default(""),
  hodometroOrigem: z.string().trim().max(5000).optional().default(""),
  valorProdutos: money.optional().default(0),
  valorFrete: money.optional().default(0),
  valorSeguro: money.optional().default(0),
  valorOutros: money.optional().default(0),
  valorIcms: money.optional().default(0),
  valorPis: money.optional().default(0),
  valorCofins: money.optional().default(0),
  informacoesComplementares: z.string().max(20_000).optional().default(""),
  createdAt: z.string().optional(),
});

export const statusCiot = z.enum([
  "RASCUNHO",
  "PRONTO_ENVIO",
  "PROCESSANDO",
  "AUTORIZADO",
  "REJEITADO",
  "CANCELADO",
  "ENCERRADO",
]);

export const tipoOperacaoCiot = z.enum([
  "LOTACAO",
  "FRACIONADA",
  "TAC_AGREGADO",
]);


export const ciotCteBody = z.object({
  id: id.optional(),
  chave: z.string().trim().min(20).max(60),
  numero: z.string().trim().max(30).default(""),
  serie: z.string().trim().max(20).default(""),
  emitenteCnpj: z.string().trim().max(20).default(""),
  emitenteNome: z.string().trim().max(255).default(""),
  emitenteNomeFantasia: z.string().trim().max(255).default(""),
  emitenteInscricaoEstadual: z.string().trim().max(30).default(""),
  emitenteEndereco: z.string().trim().max(1000).default(""),
  emitenteCidade: z.string().trim().max(160).default(""),
  emitenteUf: z.string().trim().max(2).default(""),
  remetenteCnpj: z.string().trim().max(20).default(""),
  remetenteNome: z.string().trim().max(255).default(""),
  destinatarioCnpj: z.string().trim().max(20).default(""),
  destinatarioNome: z.string().trim().max(255).default(""),
  destinatarioNomeFantasia: z.string().trim().max(255).optional().default(""),
  destinatarioInscricaoEstadual: z.string().trim().max(30).optional().default(""),
  destinatarioEndereco: z.string().trim().max(1000).optional().default(""),
  destinatarioCidade: z.string().trim().max(160).optional().default(""),
  destinatarioUf: z.string().trim().max(2).optional().default(""),
  tomadorCnpj: z.string().trim().max(20).default(""),
  tomadorNome: z.string().trim().max(255).default(""),
  origemCidade: z.string().trim().max(160).default(""),
  origemUf: z.string().trim().max(2).default(""),
  destinoCidade: z.string().trim().max(160).default(""),
  destinoUf: z.string().trim().max(2).default(""),
  produto: z.string().trim().max(255).default(""),
  ncm: z.string().trim().max(20).default(""),
  pesoKg: z.coerce.number().finite().min(0).default(0),
  valorMercadoria: z.coerce.number().finite().min(0).default(0),
  valorFrete: z.coerce.number().finite().min(0).default(0),
  valorPedagio: z.coerce.number().finite().min(0).default(0),
  xmlUrl: z.string().max(20_000_000).optional().nullable().or(z.literal("")),
  arquivoNome: z.string().trim().max(500).optional().default(""),
  dataEmissao: dateOnly.optional().nullable().or(z.literal("")),
});

export const ciotBody = z.object({
  id: id.optional(),
  clienteId: id.optional().nullable().or(z.literal("")),
  empresaId: id.optional().nullable().or(z.literal("")),
  contratanteRazaoSocial: z.string().trim().max(255).default(""),
  contratanteNomeFantasia: z.string().trim().max(255).default(""),
  contratanteCnpj: z.string().trim().max(20).default(""),
  contratadoRazaoSocial: z.string().trim().max(255).default(""),
  contratadoNomeFantasia: z.string().trim().max(255).default(""),
  contratadoCnpj: z.string().trim().max(20).default(""),
  contratadoInscricaoEstadual: z.string().trim().max(30).default(""),
  contratadoEndereco: z.string().trim().max(1000).default(""),
  contratadoCidade: z.string().trim().max(160).default(""),
  contratadoUf: z.string().trim().max(2).default(""),
  motoristaId: id,
  veiculoId: id,
  tipoOperacao: tipoOperacaoCiot,
  status: statusCiot.default("RASCUNHO"),
  rntrc: z.string().trim().min(8, "Informe o RNTRC.").max(30),
  origemCidade: text(160),
  origemUf: z.string().trim().length(2, "Use a sigla da UF com 2 letras.").transform((value) => value.toUpperCase()),
  destinoCidade: text(160),
  destinoUf: z.string().trim().length(2, "Use a sigla da UF com 2 letras.").transform((value) => value.toUpperCase()),
  dataInicio: dateOnly,
  dataFim: dateOnly.optional().nullable().or(z.literal("")),
  naturezaCarga: text(255),
  pesoKg: z.coerce.number().finite().min(0),
  valorFrete: money,
  valorPedagio: money.default(0),
  outrosValores: money.default(0),
  descontos: money.default(0),
  valorLiquido: money.default(0),
  formaPagamento: z.string().trim().max(120).default(""),
  favorecidoPix: z.string().trim().max(255).default(""),
  payloadAntt: z.unknown().optional().nullable(),
  preparadoEm: z.string().optional().nullable(),
  observacoes: optionalText(5000),
  numeroCiot: optionalText(100),
  codigoVerificador: optionalText(100),
  protocolo: optionalText(100),
  mensagemRetorno: optionalText(5000),
  valorMercadoria: money.default(0),
  cnpjsCargaFracionada: z.string().trim().max(5000).default(""),
  ctes: z.array(ciotCteBody).max(200).optional().default([]),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const pneuBody = z.object({
  id: id.optional(), numeroFogo: text(100), codigoBarras: optionalText(255), qrCode: optionalText(255),
  marca: text(120), modelo: text(120), medida: text(80), dot: text(20), numeroSerie: optionalText(120),
  tipo: z.enum(["DIRECIONAL", "TRACAO", "LIVRE"]), valorCompra: money, fornecedor: text(180), dataCompra: dateOnly,
  maxRecapagens: z.coerce.number().int().min(0).max(20).default(0), recapagensRealizadas: z.coerce.number().int().min(0).max(20).default(0),
  status: z.enum(["ESTOQUE", "INSTALADO", "MANUTENCAO", "RECAPAGEM", "DESCARTADO"]).default("ESTOQUE"),
  condicao: z.enum(["NOVO", "USADO", "RECAPADO", "AGUARDANDO_RECAPAGEM"]).default("NOVO"),
  sulcoInicial: z.coerce.number().finite().min(0).max(100).optional().nullable(), sulcoAtual: z.coerce.number().finite().min(0).max(100).optional().nullable(),
  kmAtual: z.coerce.number().finite().min(0).default(0), proximoRodizioKm: z.coerce.number().finite().min(0).optional().nullable(),
  observacoes: z.string().max(5000).optional().or(z.literal("")), fotos: z.array(z.string().max(20_000_000)).max(10).optional(), createdAt: z.string().optional(),
});

export const bodySchema = (schema: z.ZodTypeAny) => z.object({ body: schema, params: z.unknown().optional(), query: z.unknown().optional() });
export const partialBodySchema = (schema: z.ZodObject<any>) => z.object({ body: schema.partial(), params: z.object({ id }), query: z.unknown().optional() });

const username = z.string().trim().toLowerCase().min(3, "O usuário deve ter pelo menos 3 caracteres").max(30).regex(/^[a-z0-9._-]+$/, "Use apenas letras, números, ponto, hífen ou sublinhado");
const password = z.string().min(8, "A senha deve ter pelo menos 8 caracteres").max(200);

export const loginSchema = bodySchema(z.object({ identifier: z.string().trim().min(3).max(255), password }));
export const registerSchema = bodySchema(z.object({ name: text(120), username, email: z.string().trim().email().transform(v => v.toLowerCase()), password }));
export const changePasswordSchema = bodySchema(z.object({ currentPassword: password, newPassword: password }));
const cpfProfile = z.string().trim().max(14).transform((value) => value.replace(/\D/g, "")).refine((value) => !value || value.length === 11, "CPF deve possuir 11 dígitos.");
export const updateProfileSchema = bodySchema(z.object({
  name: text(120),
  email: z.string().trim().email("Informe um e-mail válido.").transform((value) => value.toLowerCase()),
  telefone: z.string().trim().max(20).transform((value) => value.replace(/\D/g, "")),
  cpf: cpfProfile,
  fotoPerfil: z.string().max(7_000_000, "A foto de perfil é muito grande.").nullable().optional(),
}));

export const createUserSchema = bodySchema(z.object({ name: text(), username, email: z.string().email().transform(v => v.toLowerCase()), password, role: z.enum(["ADMIN", "GERENTE", "BORRACHARIA", "MANUTENCAO", "VISUALIZACAO", "USER"]).default("VISUALIZACAO") }));

export const migrationSchema = bodySchema(z.object({
  motoristas: z.array(motoristaBody).default([]), chapas: z.array(chapaBody).default([]), clientes: z.array(clienteBody).default([]), produtos: z.array(produtoBody).default([]), locais: z.array(localBody).default([]), veiculos: z.array(veiculoBody).default([]), viagens: z.array(viagemBody).default([]), fechamentos: z.array(fechamentoBody).default([]), manifestos: z.array(manifestoBody).default([]),
}));

export const pneuInstalacaoBody = z.object({
  veiculoId: id,
  carretaId: id.optional().nullable().or(z.literal("")),
  eixo: text(80),
  posicao: text(80),
  dataInstalacao: dateOnly,
  kmInstalacao: z.coerce.number().finite().min(0),
  responsavel: text(160),
});

export const pneuRetiradaBody = z.object({
  dataRetirada: dateOnly,
  kmRetirada: z.coerce.number().finite().min(0),
  motivoRetirada: text(1000),
  statusDestino: z.enum(["ESTOQUE", "MANUTENCAO", "RECAPAGEM"]).default("ESTOQUE"),
});

export const pneuRodizioBody = z.object({
  veiculoId: id,
  carretaId: id.optional().nullable().or(z.literal("")),
  data: dateOnly,
  quilometragem: z.coerce.number().finite().min(0),
  responsavel: text(160),
  motivo: text(1000),
  movimentos: z.array(z.object({
    pneuId: id,
    eixoOrigem: text(80),
    posicaoOrigem: text(80),
    eixoDestino: text(80),
    posicaoDestino: text(80),
  })).min(2, "Selecione ao menos duas posições para o rodízio."),
});


export const pneuSulcoBody = z.object({
  data: dateOnly, quilometragem: z.coerce.number().finite().min(0).optional().nullable(),
  sulcoInterno: z.coerce.number().finite().min(0).max(100), sulcoCentral: z.coerce.number().finite().min(0).max(100),
  sulcoExterno: z.coerce.number().finite().min(0).max(100), responsavel: text(160), observacoes: optionalText(2000),
});
export const pneuCalibragemBody = z.object({
  data: dateOnly, pressaoRecomendada: z.coerce.number().finite().positive(), pressaoEncontrada: z.coerce.number().finite().min(0),
  pressaoAjustada: z.coerce.number().finite().min(0), responsavel: text(160), observacoes: optionalText(2000),
});
export const pneuRecapagemBody = z.object({
  empresaRecapadora: text(180), dataEnvio: dateOnly, dataRetorno: dateOnly.optional().nullable().or(z.literal("")),
  valor: money, garantiaMeses: z.coerce.number().int().min(0).max(120).default(0), tipoRecapagem: text(120),
  numeroRecapagem: z.coerce.number().int().min(1).max(20), observacoes: optionalText(2000),
});
export const pneuConsertoBody = z.object({
  tipo: z.enum(["FURO", "REMENDO", "VULCANIZACAO", "CORTE_LATERAL", "OUTRO"]), data: dateOnly, valor: money,
  responsavel: text(160), observacoes: optionalText(2000), fotosAntes: z.array(z.string().max(20_000_000)).max(10).optional(),
  fotosDepois: z.array(z.string().max(20_000_000)).max(10).optional(),
});
export const pneuInspecaoBody = z.object({
  data: dateOnly, responsavel: text(160), pressaoOk: z.boolean(), sulcoOk: z.boolean(), cortes: z.boolean().default(false),
  bolhas: z.boolean().default(false), trincas: z.boolean().default(false), desgasteIrregular: z.boolean().default(false),
  lonaAparente: z.boolean().default(false), observacoes: optionalText(2000), fotos: z.array(z.string().max(20_000_000)).max(10).optional(),
});
