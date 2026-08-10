import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

export type StatusMotorista = "ATIVO" | "DEMITIDO";
export interface Motorista { id: string; nome: string; cpf: string; salarioBase: number; status: StatusMotorista; createdAt: string; }
export interface Chapa { id: string; nome: string; telefone: string; cpf: string; cidade: string; chavePix: string; valorFixo: number; createdAt: string; }
export interface Cliente { id: string; nomeFantasia: string; razaoSocial: string; codigoInterno: string; cnpj: string; email: string; telefone: string; enderecoFiscal: string; createdAt: string; }

export interface Empresa {
  id: string;
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
  inscricaoEstadual?: string;
  rntrc?: string;
  antt?: string;
  email?: string;
  telefone?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  certificadoArquivo?: string;
  certificadoValidade?: string;
  ativa: boolean;
  empresaPadrao: boolean;
  createdAt: string;
}

export type CategoriaEstoque = string;
export interface Produto { id: string; nome: string; codigoInterno: string; categoriaEstoque: CategoriaEstoque; createdAt: string; }
export type TipoMovimentacaoEstoque = "ENTRADA" | "SAIDA";
export interface EstoqueMovimentacao { id:string; produtoId:string; tipo:TipoMovimentacaoEstoque; quantidade:number; valorUnitario:number; valorTotal:number; data:string; observacoes?:string|null; pdfUrl?:string|null; pdfName?:string|null; produto:Produto; createdAt:string; }
export interface EstoqueResumo { produto:Produto; entradas:number; saidas:number; estoque:number; valorSaidas:number; }
export interface Local { id: string; cidade: string; valorComissao: number; createdAt: string; }
export interface ViagemFechamento { localId: string; quantidade: number; }
export interface Fechamento { id: string; motoristaId: string; dataInicio: string; dataFim: string; viagens: ViagemFechamento[]; valorTotal: number; createdAt: string; }
export interface Veiculo { id: string; placa: string; modelo?: string; quantidadePneus?: number; quantidadeEstepes?: number; createdAt: string; }
export interface Viagem { id: string; placa: string; motoristaId: string; valorFrete: number; dataManifesto: string; cidadeEntrega: string; distanciaKm: number; valorPedagio: number; valorDiaria: number; valorAbastecimento: number; valorChapa: number; createdAt: string; }
export type TipoManifesto = "Bonificação - Lebrinha" | "Acertar c/ Lebrinha" | "Receber c/ Cliente";
export interface ManifestoProduto { id?: string; produtoId: string; clienteId?: string | null; romaneio?: string; notaFiscal?: string; serieNf?: string; instrucaoCobranca?: string; quantidade: number; valorUnitario: number; valorTotal: number; tipoManifesto?: TipoManifesto; pagoCliente?: boolean | null; }
export interface ManifestoMetadata {
  transportadoraCodigo?: string;
  transportadoraNome?: string;
  veiculoCodigo?: string;
  placaVeiculo?: string;
  modeloVeiculo?: string;
  romaneios?: string;
  notasFiscais?: string;
}
export interface Manifesto extends ManifestoMetadata { id: string; clienteId: string; dataManifesto: string; produtos: ManifestoProduto[]; tipoManifesto: TipoManifesto; pdfUrl?: string; pdfStored?: boolean; createdAt: string; }
export type RomaneioItem = ManifestoProduto;
export type Romaneio = Manifesto;
export interface AbastecimentoProduto { produtoId: string; quantidadeLitros: number; valorUnitario: number; valorTotal: number; }
export interface Abastecimento {
  id: string;
  clienteId: string;
  veiculoId: string;
  chaveNfe?: string | null;
  numeroNfe?: string;
  serieNfe?: string;
  emitenteCnpj?: string;
  emitenteRazaoSocial?: string;
  emitenteNomeFantasia?: string;
  emitenteInscricaoEstadual?: string;
  emitenteEndereco?: string;
  emitenteCidade?: string;
  emitenteUf?: string;
  destinatarioCnpjCpf?: string;
  destinatarioRazaoSocial?: string;
  destinatarioEndereco?: string;
  destinatarioCidade?: string;
  destinatarioUf?: string;
  naturezaOperacao?: string;
  placaXml?: string;
  hodometroOrigem?: string;
  valorProdutos?: number;
  valorFrete?: number;
  valorSeguro?: number;
  valorOutros?: number;
  valorIcms?: number;
  valorPis?: number;
  valorCofins?: number;
  informacoesComplementares?: string;
  dataEmissao: string;
  produtos: AbastecimentoProduto[];
  valorDesconto: number;
  valorTotal: number;
  hodometro: number;
  pdfUrl?: string | null;
  xmlUrl?: string | null;
  createdAt: string;
}
export type StatusCiot =
  | "RASCUNHO"
  | "PRONTO_ENVIO"
  | "PROCESSANDO"
  | "AUTORIZADO"
  | "REJEITADO"
  | "CANCELADO"
  | "ENCERRADO";

export type TipoOperacaoCiot = "LOTACAO" | "FRACIONADA" | "TAC_AGREGADO";

export interface CiotCte {
  id?: string;
  chave: string;
  numero: string;
  serie: string;
  emitenteCnpj: string;
  emitenteNome: string;
  emitenteNomeFantasia: string;
  emitenteInscricaoEstadual: string;
  emitenteEndereco: string;
  emitenteCidade: string;
  emitenteUf: string;
  remetenteCnpj: string;
  remetenteNome: string;
  destinatarioCnpj: string;
  destinatarioNome: string;
  destinatarioNomeFantasia?: string;
  destinatarioInscricaoEstadual?: string;
  destinatarioEndereco?: string;
  destinatarioCidade?: string;
  destinatarioUf?: string;
  tomadorCnpj: string;
  tomadorNome: string;
  origemCidade: string;
  origemUf: string;
  origemCodigoIbge?: string;
  origemCep?: string;
  destinoCidade: string;
  destinoUf: string;
  destinoCodigoIbge?: string;
  destinoCep?: string;
  produto: string;
  ncm: string;
  pesoKg: number;
  valorMercadoria: number;
  valorFrete: number;
  valorPedagio?: number;
  xmlUrl?: string | null;
}

export interface Ciot {
  id: string;
  idSequencial?: number;
  clienteId?: string | null;
  empresaId?: string | null;
  contratanteRazaoSocial?: string;
  contratanteNomeFantasia?: string;
  contratanteCnpj?: string;
  contratadoRazaoSocial?: string;
  contratadoNomeFantasia?: string;
  contratadoCnpj?: string;
  contratadoInscricaoEstadual?: string;
  contratadoEndereco?: string;
  contratadoCidade?: string;
  contratadoUf?: string;
  motoristaId: string;
  veiculoId: string;
  tipoOperacao: TipoOperacaoCiot;
  status: StatusCiot;
  rntrc: string;
  origemCidade: string;
  origemUf: string;
  destinoCidade: string;
  destinoUf: string;
  dataInicio: string;
  dataFim?: string | null;
  naturezaCarga: string;
  pesoKg: number;
  valorFrete: number;
  valorPedagio: number;
  outrosValores: number;
  descontos: number;
  valorLiquido: number;
  formaPagamento: string;
  favorecidoPix: string;
  payloadAntt?: unknown;
  preparadoEm?: string | null;
  observacoes?: string | null;
  numeroCiot?: string | null;
  codigoVerificador?: string | null;
  protocolo?: string | null;
  mensagemRetorno?: string | null;
  valorMercadoria: number;
  cnpjsCargaFracionada: string;
  ctes?: CiotCte[];
  createdAt: string;
  updatedAt?: string;
}

export type StatusPneu = "ESTOQUE" | "INSTALADO" | "MANUTENCAO" | "RECAPAGEM" | "DESCARTADO";
export type TipoPneu = "DIRECIONAL" | "TRACAO" | "LIVRE";
export type CondicaoPneu = "NOVO" | "USADO" | "RECAPADO" | "AGUARDANDO_RECAPAGEM";
export interface PneuFoto { id: string; url: string; legenda?: string | null; createdAt: string; }
export interface PneuEvento { id: string; tipo: "COMPRA" | "ALTERACAO" | "STATUS" | "FOTO" | "INSTALACAO" | "RETIRADA" | "RODIZIO" | "SULCO" | "CALIBRAGEM" | "RECAPAGEM" | "CONSERTO" | "INSPECAO"; data: string; quilometragem?: number | null; responsavel?: string | null; observacoes?: string | null; dados?: unknown; createdAt: string; }
export interface PneuInstalacao { id: string; pneuId: string; veiculoId: string; carretaId?: string | null; eixo: string; posicao: string; dataInstalacao: string; kmInstalacao: number; responsavel: string; dataRetirada?: string | null; kmRetirada?: number | null; motivoRetirada?: string | null; statusDestino?: StatusPneu | null; ativo: boolean; pneu: Pneu; veiculo: Veiculo; carreta?: Veiculo | null; createdAt: string; }
export interface PneuRodizioMovimento { id: string; pneuId: string; eixoOrigem: string; posicaoOrigem: string; eixoDestino: string; posicaoDestino: string; pneu: Pneu; }
export interface PneuRodizio { id: string; veiculoId: string; carretaId?: string | null; data: string; quilometragem: number; responsavel: string; motivo: string; veiculo: Veiculo; carreta?: Veiculo | null; movimentos: PneuRodizioMovimento[]; createdAt: string; }

export interface PneuMedicaoSulco { id:string; pneuId:string; data:string; quilometragem?:number|null; sulcoInterno:number; sulcoCentral:number; sulcoExterno:number; mediaSulco:number; percentualDesgaste:number; vidaUtilRestante:number; responsavel:string; observacoes?:string|null; createdAt:string; }
export interface PneuCalibragem { id:string; pneuId:string; data:string; pressaoRecomendada:number; pressaoEncontrada:number; pressaoAjustada:number; responsavel:string; observacoes?:string|null; createdAt:string; }
export interface PneuRecapagem { id:string; pneuId:string; empresaRecapadora:string; dataEnvio:string; dataRetorno?:string|null; valor:number; garantiaMeses:number; tipoRecapagem:string; numeroRecapagem:number; observacoes?:string|null; createdAt:string; }
export interface PneuConserto { id:string; pneuId:string; tipo:string; data:string; valor:number; responsavel:string; observacoes?:string|null; fotosAntes?:string[]; fotosDepois?:string[]; createdAt:string; }
export interface PneuInspecao { id:string; pneuId:string; data:string; responsavel:string; pressaoOk:boolean; sulcoOk:boolean; cortes:boolean; bolhas:boolean; trincas:boolean; desgasteIrregular:boolean; lonaAparente:boolean; observacoes?:string|null; fotos?:string[]; createdAt:string; }
export interface PneuManutencao { medicoesSulco:PneuMedicaoSulco[]; calibragens:PneuCalibragem[]; recapagens:PneuRecapagem[]; consertos:PneuConserto[]; inspecoes:PneuInspecao[]; }

export type PneuAlerta = { id:string; severity:"CRITICO"|"ATENCAO"; type:string; title:string; detail:string; pneuId:string };
export type PneuRelatorios = { period:{from:string|null;to:string|null}; summary:{pneus:number;investment:number;averageLifeKm:number}; history:Array<{pneu:string;marca:string;evento:string;data:string;responsavel:string;quilometragem:number|null;observacoes:string}>; costsByVehicle:Array<{vehicle:string;count:number;cost:number}>; rankingBrands:Array<{brand:string;count:number;cost:number;km:number}>; rankingRecappers:Array<{name:string;count:number;cost:number}>; wear:Array<{numeroFogo:string;marca:string;sulcoAtual:number|null;desgaste:number;km:number}>; nearReplacement:Array<{numeroFogo:string;marca:string;sulcoAtual:number|null;desgaste:number;km:number}> };
export interface Pneu { id: string; numeroFogo: string; codigoBarras?: string | null; qrCode?: string | null; marca: string; modelo: string; medida: string; dot: string; numeroSerie?: string | null; tipo: TipoPneu; valorCompra: number; fornecedor: string; dataCompra: string; maxRecapagens: number; recapagensRealizadas: number; status: StatusPneu; condicao: CondicaoPneu; sulcoInicial?: number | null; sulcoAtual?: number | null; kmAtual: number; proximoRodizioKm?: number | null; observacoes?: string | null; fotos: PneuFoto[]; eventos: PneuEvento[]; recapagens?: PneuRecapagem[]; consertos?: PneuConserto[]; medicoesSulco?: PneuMedicaoSulco[]; calibragens?: PneuCalibragem[]; inspecoes?: PneuInspecao[]; createdAt: string; }

type Entity = { id: string; createdAt: string };
const eventName = (resource: string) => `radasa-api-change:${resource}`;
const generateId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
type ApiChangeDetail = { source: string };

function notifyApiChange(resource: string, source: string) {
  window.dispatchEvent(
    new CustomEvent<ApiChangeDetail>(eventName(resource), {
      detail: { source },
    }),
  );
}

function requireCollection<T>(data: unknown, entityName: string): T[] {
  if (Array.isArray(data)) return data as T[];
  throw new Error(`Resposta inválida ao carregar ${entityName}: era esperada uma lista.`);
}

function requireEntity<T>(data: unknown, entityName: string): T {
  if (
    data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    "id" in data &&
    typeof data.id === "string" &&
    data.id.trim()
  ) {
    return data as T;
  }
  throw new Error(`Resposta inválida ao salvar ${entityName}.`);
}

function useApiCrud<T extends Entity>(resource: string, entityName: string) {
  const [items, setItems] = useState<T[]>([]);
  const sourceId = useRef(generateId()).current;
  const mutationRevision = useRef(0);
  const replaceLocalItem = useCallback((item: T) => {
    setItems(current => {
      const index = current.findIndex(currentItem => currentItem.id === item.id);
      if (index === -1) return current;
      const next = [...current];
      next[index] = item;
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    const revisionAtStart = mutationRevision.current;
    try {
      const response = await api.get<unknown>(`/${resource}`);
      const collection = requireCollection<T>(response.data, entityName);

      // Uma leitura iniciada antes de uma gravação não pode apagar o estado
      // confirmado pela resposta do POST/PUT/DELETE.
      if (revisionAtStart === mutationRevision.current) {
        setItems(collection);
      }
    }
    catch (error) { console.error(`Falha ao carregar ${entityName}.`, error); }
  }, [resource, entityName]);

  useEffect(() => {
    void refresh();
    const handler = (event: Event) => {
      const source = (event as CustomEvent<ApiChangeDetail>).detail?.source;
      if (source === sourceId) return;
      void refresh();
    };
    window.addEventListener(eventName(resource), handler);
    return () => window.removeEventListener(eventName(resource), handler);
  }, [refresh, resource, sourceId]);

  const create = useCallback(async (data: Omit<T, "id" | "createdAt">): Promise<T> => {
    const newItem = { ...data, id: generateId(), createdAt: new Date().toISOString() } as T;
    mutationRevision.current += 1;
    setItems(current => [...current, newItem]);

    try {
      const response = await api.post<unknown>(`/${resource}`, newItem);
      const createdItem = requireEntity<T>(response.data, entityName);
      setItems(current => current.map(item => item.id === newItem.id ? createdItem : item));
      notifyApiChange(resource, sourceId);
      return createdItem;
    } catch (error) {
      setItems(current => current.filter(item => item.id !== newItem.id));
      throw error;
    }
  }, [entityName, resource, sourceId]);

  const update = useCallback(async (id: string, data: Partial<Omit<T, "id" | "createdAt">>): Promise<T> => {
    let previous: T | undefined;
    mutationRevision.current += 1;
    setItems(current => current.map(item => {
      if (item.id !== id) return item;
      previous = item;
      return { ...item, ...data };
    }));

    try {
      const response = await api.put<unknown>(`/${resource}/${id}`, data);
      const updatedItem = requireEntity<T>(response.data, entityName);
      setItems(current => current.map(item => item.id === id ? updatedItem : item));
      notifyApiChange(resource, sourceId);
      return updatedItem;
    } catch (error) {
      if (previous) {
        setItems(current => current.map(item => item.id === id ? previous! : item));
      }
      throw error;
    }
  }, [entityName, resource, sourceId]);

  const remove = useCallback(async (id: string): Promise<void> => {
    let previous: T | undefined;
    mutationRevision.current += 1;
    setItems(current => {
      previous = current.find(item => item.id === id);
      return current.filter(item => item.id !== id);
    });

    try {
      await api.delete(`/${resource}/${id}`);
      notifyApiChange(resource, sourceId);
    } catch (error) {
      if (previous) setItems(current => [...current, previous!]);
      throw error;
    }
  }, [resource, sourceId]);

  const getById = useCallback((id: string) => items.find(item => item.id === id), [items]);
  return { items, create, update, remove, getById, entityName, refresh, replaceLocalItem };
}

export const useMotoristas = () => useApiCrud<Motorista>("motoristas", "Motorista");
export const useChapas = () => useApiCrud<Chapa>("chapas", "Chapa");
export const useClientes = () => useApiCrud<Cliente>("clientes", "Cliente");
export const useEmpresa = () => useApiCrud<Empresa>("empresa", "Empresa");
export const useProdutos = () => useApiCrud<Produto>("produtos", "Produto");
export const useLocais = () => useApiCrud<Local>("locais", "Local");
export const useVeiculos = () => useApiCrud<Veiculo>("veiculos", "Veículo");
export const useViagens = () => useApiCrud<Viagem>("viagens", "Viagem");
export const useAbastecimentos = () => useApiCrud<Abastecimento>("abastecimentos", "Abastecimento");
export const useCiots = () => useApiCrud<Ciot>("ciots", "CIOT");
export const usePneus = () => useApiCrud<Pneu>("pneus", "Pneu");

export function useFechamentos() {
  const crud = useApiCrud<Fechamento>("fechamentos", "Fechamento");
  const create = useCallback((motoristaId: string, dataInicio: string, dataFim: string, viagens: ViagemFechamento[]) => crud.create({ motoristaId, dataInicio, dataFim, viagens, valorTotal: 0 }), [crud.create]);
  const update = useCallback((id: string, motoristaId: string, dataInicio: string, dataFim: string, viagens: ViagemFechamento[]) => crud.update(id, { motoristaId, dataInicio, dataFim, viagens }), [crud.update]);
  return { ...crud, create, update };
}

export function useRomaneios() {
  // O backend mantém "manifestos" como rota interna legada e estável.
  // A interface continua usando o nome Romaneios para o usuário.
  const crud = useApiCrud<Manifesto>("manifestos", "Romaneio");
  const create = useCallback((clienteId: string, dataManifesto: string, produtos: ManifestoProduto[], tipoManifesto: TipoManifesto, pdfUrl?: string, metadata: ManifestoMetadata = {}) => crud.create({ clienteId, dataManifesto, produtos, tipoManifesto, pdfUrl, ...metadata }), [crud.create]);
  const update = useCallback((id: string, clienteId: string, dataManifesto: string, produtos: ManifestoProduto[], tipoManifesto: TipoManifesto, pdfUrl?: string, metadata: ManifestoMetadata = {}) => crud.update(id, { clienteId, dataManifesto, produtos, tipoManifesto, pdfUrl, ...metadata }), [crud.update]);
  return { ...crud, create, update };
}

export const useManifestos = useRomaneios;


export function useEstoque() {
  const [movimentacoes, setMovimentacoes] = useState<EstoqueMovimentacao[]>([]);
  const [resumo, setResumo] = useState<EstoqueResumo[]>([]);
  const refresh = useCallback(async () => {
    const [movimentosResponse, resumoResponse] = await Promise.all([api.get<EstoqueMovimentacao[]>("/estoque"), api.get<EstoqueResumo[]>("/estoque/resumo")]);
    setMovimentacoes(movimentosResponse.data); setResumo(resumoResponse.data);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const create = useCallback(async (data: Omit<EstoqueMovimentacao,"id"|"produto"|"valorTotal"|"createdAt">) => { const item=(await api.post<EstoqueMovimentacao>("/estoque",data)).data; await refresh(); return item; },[refresh]);
  const remove = useCallback(async (id:string)=>{ await api.delete(`/estoque/${id}`); await refresh(); },[refresh]);
  return { movimentacoes, resumo, create, remove, refresh };
}

export function usePneuOperacoes() {
  const [instalacoes, setInstalacoes] = useState<PneuInstalacao[]>([]);
  const [rodizios, setRodizios] = useState<PneuRodizio[]>([]);
  const refresh = useCallback(async () => {
    const [instalacoesResponse, rodiziosResponse] = await Promise.all([
      api.get<PneuInstalacao[]>("/pneus/instalacoes"),
      api.get<PneuRodizio[]>("/pneus/rodizios"),
    ]);
    setInstalacoes(instalacoesResponse.data);
    setRodizios(rodiziosResponse.data);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const instalar = useCallback(async (pneuId: string, data: Omit<PneuInstalacao, "id" | "pneuId" | "pneu" | "veiculo" | "carreta" | "ativo" | "createdAt">) => {
    const item = (await api.post<PneuInstalacao>(`/pneus/${pneuId}/instalar`, data)).data;
    await refresh();
    window.dispatchEvent(new Event(eventName("pneus")));
    return item;
  }, [refresh]);
  const retirar = useCallback(async (pneuId: string, data: { dataRetirada: string; kmRetirada: number; motivoRetirada: string; statusDestino: "ESTOQUE" | "MANUTENCAO" | "RECAPAGEM" }) => {
    const item = (await api.post<PneuInstalacao>(`/pneus/${pneuId}/retirar`, data)).data;
    await refresh();
    window.dispatchEvent(new Event(eventName("pneus")));
    return item;
  }, [refresh]);
  const rodiziar = useCallback(async (data: Omit<PneuRodizio, "id" | "veiculo" | "carreta" | "createdAt" | "movimentos"> & { movimentos: Array<Omit<PneuRodizioMovimento, "id" | "pneu">> }) => {
    const item = (await api.post<PneuRodizio>("/pneus/rodizios", data)).data;
    await refresh();
    window.dispatchEvent(new Event(eventName("pneus")));
    return item;
  }, [refresh]);
  return { instalacoes, rodizios, instalar, retirar, rodiziar, refresh };
}


export function usePneuManutencao(pneuId?: string) {
  const [data, setData] = useState<PneuManutencao | null>(null);
  const refresh = useCallback(async () => { if (!pneuId) { setData(null); return; } setData((await api.get<PneuManutencao>(`/pneus/${pneuId}/manutencao`)).data); }, [pneuId]);
  useEffect(() => { void refresh(); }, [refresh]);
  const post = useCallback(async (path:string, body:unknown) => { if(!pneuId) throw new Error("Selecione um pneu."); await api.post(`/pneus/${pneuId}/${path}`, body); await refresh(); window.dispatchEvent(new Event(eventName("pneus"))); }, [pneuId, refresh]);
  return { data, refresh, addSulco:(body:unknown)=>post("sulcos",body), addCalibragem:(body:unknown)=>post("calibragens",body), addRecapagem:(body:unknown)=>post("recapagens",body), addConserto:(body:unknown)=>post("consertos",body), addInspecao:(body:unknown)=>post("inspecoes",body) };
}

export function usePneuGestao(){
  const [alerts,setAlerts]=useState<PneuAlerta[]>([]); const [reports,setReports]=useState<PneuRelatorios|null>(null); const [loading,setLoading]=useState(false);
  const loadAlerts=useCallback(async()=>setAlerts((await api.get<PneuAlerta[]>("/pneus/gestao/alertas")).data),[]);
  const loadReports=useCallback(async(from?:string,to?:string)=>{setLoading(true);try{setReports((await api.get<PneuRelatorios>("/pneus/gestao/relatorios",{params:{from:from||undefined,to:to||undefined}})).data)}finally{setLoading(false)}},[]);
  return {alerts,reports,loading,loadAlerts,loadReports};
}
