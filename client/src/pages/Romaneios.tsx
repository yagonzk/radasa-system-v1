import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  useClientes,
  useProdutos,
  useRomaneios,
  useVeiculos,
  type Cliente,
  type Produto,
  type Romaneio,
  type RomaneioItem,
  type TipoManifesto,
  type Veiculo,
} from "@/lib/store";
import { api } from "@/lib/api";
import { extrairTextoPdf, type PdfTextProgress } from "@/lib/pdfText";
import {
  analyzeRomaneioReadQuality,
  chooseBestRomaneioRead,
  shouldTryOcrFallback,
} from "@/lib/romaneioImportQuality";

const EXPECTED_ROMANEIO_PARSER_VERSION = "2026.08.11.01";
import { formatBRL, formatDate } from "@/lib/exportUtils";
import {
  Check,
  ChevronDown,
  CircleDollarSign,
  Download,
  Eye,
  Files,
  FileText,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
  Truck,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface PdfProduto {
  romaneio: string;
  data: string;
  item: string;
  codigo: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  instrucaoCobranca: string;
  notaFiscal: string;
  serie: string;
  tipoManifesto: TipoManifesto;
  clienteCodigo: string;
  clienteNome: string;
  blocoCliente?: number;
}

interface PdfResponse {
  documento: {
    parserVersion?: string;
    dataEmissao: string;
    transportadoraCodigo: string;
    transportadoraNome: string;
    veiculoCodigo: string;
    placaVeiculo: string;
    modeloVeiculo: string;
    romaneios: string[];
    notasFiscais: string[];
    valorTotal: number;
    avisos: string[];
    produtos?: PdfProduto[];
  };
  sugestoes: {
    clientesCriados: number;
    produtosCriados: number;
    produtos: Array<{
      produto: PdfProduto;
      cliente: Cliente & { criadoAutomaticamente?: boolean };
      cadastro: Produto & { criadoAutomaticamente?: boolean };
    }>;
  };
  pendencias: string[];
}

interface ImportReview {
  result: PdfResponse;
  file: File;
}

interface BulkImportEntry {
  file: File;
  result?: PdfResponse;
  error?: string;
}

interface ManualForm {
  data: string;
  placa: string;
  modelo: string;
  transportadoraCodigo: string;
  transportadoraNome: string;
  veiculoCodigo: string;
  itens: RomaneioItem[];
}

interface ItemDraft {
  clienteId: string;
  produtoId: string;
  romaneio: string;
  notaFiscal: string;
  serieNf: string;
  quantidade: string;
  valorUnitario: string;
  tipoManifesto: TipoManifesto;
}

type RomaneioFilterKey = "romaneio" | "data" | "veiculo" | "valorLebrinha" | "valorClientes" | "valorTotal";

interface RomaneioColumnFilters {
  romaneio: string;
  dataInicio: string;
  dataFim: string;
  veiculo: string;
  valorLebrinha: string;
  valorClientes: string;
  valorTotal: string;
}

const emptyColumnFilters: RomaneioColumnFilters = {
  romaneio: "",
  dataInicio: "",
  dataFim: "",
  veiculo: "",
  valorLebrinha: "",
  valorClientes: "",
  valorTotal: "",
};

const romaneioColumns: Array<{
  key: RomaneioFilterKey;
  label: string;
  align?: "center" | "right";
  date?: boolean;
}> = [
  { key: "romaneio", label: "Romaneio" },
  { key: "data", label: "Data", date: true },
  { key: "veiculo", label: "Veículo" },
  { key: "valorLebrinha", label: "Valor Lebrinha", align: "center" },
  { key: "valorClientes", label: "Valor Clientes", align: "center" },
  { key: "valorTotal", label: "Valor total", align: "center" },
];

const tipos: TipoManifesto[] = [
  "Bonificação - Lebrinha",
  "Acertar c/ Lebrinha",
  "Receber c/ Cliente",
];

const emptyManual = (): ManualForm => ({
  data: new Date().toISOString().slice(0, 10),
  placa: "",
  modelo: "",
  transportadoraCodigo: "",
  transportadoraNome: "",
  veiculoCodigo: "",
  itens: [],
});

const emptyDraft = (): ItemDraft => ({
  clienteId: "",
  produtoId: "",
  romaneio: "",
  notaFiscal: "",
  serieNf: "",
  quantidade: "",
  valorUnitario: "",
  tipoManifesto: "Bonificação - Lebrinha",
});

function reviewNumericValue(value: string) {
  const normalizedValue = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalizedValue);
  return Number.isFinite(parsed) ? parsed : 0;
}

function refreshReviewDocument(result: PdfResponse): PdfResponse {
  const romaneios = Array.from(new Set(result.sugestoes.produtos.map(({ produto }) => produto.romaneio).filter(Boolean)));
  const notasFiscais = Array.from(new Set(result.sugestoes.produtos.map(({ produto }) => produto.notaFiscal).filter(Boolean)));
  const valorTotal = result.sugestoes.produtos.reduce((sum, { produto }) => {
    const isVasilhame = /VASI.*(?:LH|LE).*AME/i.test(produto.descricao.replace(/\s+/g, ""));
    return sum + (isVasilhame ? 0 : Number(produto.valorTotal || 0));
  }, 0);

  return {
    ...result,
    documento: {
      ...result.documento,
      romaneios,
      notasFiscais,
      valorTotal,
    },
  };
}

const BULK_PARSE_CONCURRENCY = 6;
const BULK_PARSE_CHUNK_SIZE = 50;
const BULK_SAVE_CHUNK_SIZE = 5;
const BULK_SAVE_MAX_RETRIES = 4;

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function normalized(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function romaneioTotal(romaneio: Romaneio) {
  return romaneio.produtos.reduce((sum, item) => sum + item.valorTotal, 0);
}

function romaneioClientCount(romaneio: Romaneio) {
  return new Set(
    romaneio.produtos
      .map((item) => item.clienteId ?? romaneio.clienteId)
      .filter(Boolean),
  ).size;
}

function romaneioVehicleLabel(romaneio: Romaneio) {
  return `${romaneio.placaVeiculo || "Sem placa"}${romaneio.modeloVeiculo ? ` - ${romaneio.modeloVeiculo}` : ""}`;
}

function typeClasses(type?: TipoManifesto) {
  if (type === "Receber c/ Cliente") return "bg-blue-500/15 text-blue-700 dark:text-blue-300";
  if (type === "Acertar c/ Lebrinha") return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  return "bg-violet-500/15 text-violet-700 dark:text-violet-300";
}

function TypeBadge({ type }: { type?: TipoManifesto }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${typeClasses(type)}`}>
      {type ?? "Bonificação - Lebrinha"}
    </span>
  );
}

function pdfProgressLabel(progress: PdfTextProgress) {
  const page = `pÃ¡gina ${progress.page}/${progress.totalPages}`;
  if (progress.stage === "extracting") return `Lendo ${page}...`;
  if (progress.stage === "ocr-loading") return `PDF digitalizado: preparando OCR da ${page}...`;
  return `OCR da ${page}: ${Math.round(progress.progress * 100)}%`;
}

interface SearchableOption {
  value: string;
  label: string;
  keywords?: string;
}

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Selecione",
  searchPlaceholder = "Digite para procurar...",
  emptyText = "Nenhum resultado encontrado.",
}: {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-10 w-full justify-between px-3 font-normal"
        >
          <span className="truncate text-left">{selected?.label ?? placeholder}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} autoFocus />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={`${option.label} ${option.keywords ?? ""}`}
                onSelect={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <Check
                  className={`h-4 w-4 ${value === option.value ? "opacity-100" : "opacity-0"}`}
                />
                <span className="truncate">{option.label}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function Romaneios() {
  const { items: romaneios, create, update, remove, replaceLocalItem, refresh: refreshRomaneios } = useRomaneios();
  const { items: clientes, refresh: refreshClientes } = useClientes();
  const { items: produtos, refresh: refreshProdutos } = useProdutos();
  const { items: veiculos, refresh: refreshVeiculos } = useVeiculos();
  const importInputRef = useRef<HTMLInputElement>(null);
  const bulkImportInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [pdfDragActive, setPdfDragActive] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [importProgress, setImportProgress] = useState("");
  const [bulkImportProgress, setBulkImportProgress] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [review, setReview] = useState<ImportReview | null>(null);
  const [bulkReview, setBulkReview] = useState<BulkImportEntry[] | null>(null);
  const [inspecting, setInspecting] = useState<Romaneio | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [editing, setEditing] = useState<Romaneio | null>(null);
  const [manual, setManual] = useState<ManualForm>(emptyManual);
  const [draft, setDraft] = useState<ItemDraft>(emptyDraft);
  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<RomaneioColumnFilters>(emptyColumnFilters);
  const [activeColumnFilter, setActiveColumnFilter] = useState<RomaneioFilterKey | null>(null);
  const [columnFilterSearch, setColumnFilterSearch] = useState("");
  // Exibe os controles logo abaixo da tabela, como em Abastecimentos.
  const [pageSize, setPageSize] = useState(15);
  const [page, setPage] = useState(1);
  const paymentRequestRevision = useRef<Record<string, number>>({});

  const clienteById = (id?: string | null) => clientes.find((item) => item.id === id);
  const produtoById = (id?: string | null) => produtos.find((item) => item.id === id);

  const normalizePlate = (value?: string | null) =>
    String(value ?? "")
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9]/g, "");

  const formatPlate = (value?: string | null) => {
    const normalized = normalizePlate(value).slice(0, 7);
    if (!normalized) return "";
    if (normalized.length <= 3) return normalized;
    return `${normalized.slice(0, 3)}-${normalized.slice(3)}`;
  };

  const plateEditDistance = (left: string, right: string) => {
    const rows = left.length + 1;
    const cols = right.length + 1;
    const matrix = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
    for (let row = 0; row < rows; row += 1) matrix[row][0] = row;
    for (let col = 0; col < cols; col += 1) matrix[0][col] = col;

    for (let row = 1; row < rows; row += 1) {
      for (let col = 1; col < cols; col += 1) {
        const substitution = left[row - 1] === right[col - 1] ? 0 : 1;
        matrix[row][col] = Math.min(
          matrix[row - 1][col] + 1,
          matrix[row][col - 1] + 1,
          matrix[row - 1][col - 1] + substitution,
        );
      }
    }
    return matrix[left.length][right.length];
  };

  const findRegisteredVehicleByPlate = (plate?: string | null, sourceVehicles: Veiculo[] = veiculos) => {
    const imported = normalizePlate(plate);
    if (imported.length < 6 || imported.length > 8) return undefined;

    const registered = sourceVehicles
      .map((veiculo) => ({ veiculo, plate: normalizePlate(veiculo.placa) }))
      .filter((entry) => entry.plate.length === 7);

    // Primeiro exige correspondência exata. Se o OCR confundiu 1/2 caracteres
    // (ex.: I/T, 3/S) ou inseriu um glifo, só aceitamos correção quando existe
    // UMA placa cadastrada inequivocamente mais próxima. O valor salvo continua
    // sendo sempre a placa real já cadastrada no sistema.
    const exact = registered.find((entry) => entry.plate === imported);
    if (exact) return exact.veiculo;

    const ranked = registered
      .map((entry) => ({ ...entry, distance: plateEditDistance(imported, entry.plate) }))
      .filter((entry) => entry.distance <= 2)
      .sort((a, b) => a.distance - b.distance);

    if (!ranked.length) return undefined;
    if (ranked.length > 1 && ranked[0].distance === ranked[1].distance) return undefined;
    return ranked[0].veiculo;
  };

  const bindImportedVehicle = (result: PdfResponse, sourceVehicles: Veiculo[] = veiculos) => {
    const importedPlate = result.documento.placaVeiculo;
    const registered = findRegisteredVehicleByPlate(importedPlate, sourceVehicles);

    return {
      result: {
        ...result,
        documento: {
          ...result.documento,
          // Placa importada só é mantida quando existe no cadastro de veículos.
          placaVeiculo: registered ? formatPlate(registered.placa) : "",
          modeloVeiculo: registered?.modelo ?? "",
          veiculoCodigo: registered?.id ?? "",
        },
      },
      matched: Boolean(registered),
      importedPlate: importedPlate ?? "",
    };
  };

  const updateReviewDocument = (patch: Partial<PdfResponse["documento"]>) => {
    setReview((current) => current ? {
      ...current,
      result: {
        ...current.result,
        documento: { ...current.result.documento, ...patch },
      },
    } : current);
  };

  const updateReviewProduct = (index: number, patch: Partial<PdfProduto>) => {
    setReview((current) => {
      if (!current) return current;
      const nextEntries = current.result.sugestoes.produtos.map((entry, itemIndex) =>
        itemIndex === index
          ? { ...entry, produto: { ...entry.produto, ...patch } }
          : entry,
      );
      const nextResult = refreshReviewDocument({
        ...current.result,
        sugestoes: { ...current.result.sugestoes, produtos: nextEntries },
      });
      return { ...current, result: nextResult };
    });
  };

  const updateReviewClient = (index: number, clienteId: string) => {
    const selected = clientes.find((cliente) => cliente.id === clienteId);
    if (!selected) return;
    setReview((current) => {
      if (!current) return current;
      const nextEntries = current.result.sugestoes.produtos.map((entry, itemIndex) =>
        itemIndex === index
          ? {
              ...entry,
              cliente: selected,
              produto: {
                ...entry.produto,
                clienteCodigo: selected.codigoInterno ?? entry.produto.clienteCodigo,
                clienteNome: selected.nomeFantasia ?? entry.produto.clienteNome,
              },
            }
          : entry,
      );
      return {
        ...current,
        result: refreshReviewDocument({
          ...current.result,
          sugestoes: { ...current.result.sugestoes, produtos: nextEntries },
        }),
      };
    });
  };

  const updateReviewCadastro = (index: number, produtoId: string) => {
    const selected = produtos.find((produto) => produto.id === produtoId);
    if (!selected) return;
    setReview((current) => {
      if (!current) return current;
      const nextEntries = current.result.sugestoes.produtos.map((entry, itemIndex) =>
        itemIndex === index
          ? {
              ...entry,
              cadastro: selected,
              produto: {
                ...entry.produto,
                codigo: selected.codigoInterno ?? entry.produto.codigo,
                descricao: selected.nome ?? entry.produto.descricao,
              },
            }
          : entry,
      );
      return {
        ...current,
        result: refreshReviewDocument({
          ...current.result,
          sugestoes: { ...current.result.sugestoes, produtos: nextEntries },
        }),
      };
    });
  };

  const removeReviewProduct = (index: number) => {
    setReview((current) => {
      if (!current) return current;
      const produtosRestantes = current.result.sugestoes.produtos.filter((_, itemIndex) => itemIndex !== index);
      return {
        ...current,
        result: refreshReviewDocument({
          ...current.result,
          sugestoes: { ...current.result.sugestoes, produtos: produtosRestantes },
        }),
      };
    });
  };

  const filtered = useMemo(() => {
    const query = normalized(search);
    return [...romaneios]
      .filter((romaneio) => {
        if (query) {
          const text = [
            romaneio.romaneios,
            romaneio.notasFiscais,
            romaneio.placaVeiculo,
            romaneio.transportadoraNome,
            ...romaneio.produtos.flatMap((item) => [
              clienteById(item.clienteId ?? romaneio.clienteId)?.nomeFantasia,
              produtoById(item.produtoId)?.nome,
              item.notaFiscal,
              item.romaneio,
              item.tipoManifesto,
            ]),
          ].join(" ");
          if (!normalized(text).includes(query)) return false;
        }
        if (columnFilters.romaneio && (romaneio.romaneios || "Sem número") !== columnFilters.romaneio) return false;
        if (columnFilters.dataInicio && romaneio.dataManifesto < columnFilters.dataInicio) return false;
        if (columnFilters.dataFim && romaneio.dataManifesto > columnFilters.dataFim) return false;
        if (columnFilters.veiculo && romaneioVehicleLabel(romaneio) !== columnFilters.veiculo) return false;
        const valorLebrinhaRomaneio = romaneio.produtos.reduce((sum, item) => {
          const tipo = item.tipoManifesto ?? romaneio.tipoManifesto;
          return tipo === "Receber c/ Cliente" ? sum : sum + item.valorTotal;
        }, 0);
        const valorClientesRomaneio = romaneio.produtos.reduce((sum, item) => {
          const tipo = item.tipoManifesto ?? romaneio.tipoManifesto;
          return tipo === "Receber c/ Cliente" ? sum + item.valorTotal : sum;
        }, 0);
        if (columnFilters.valorLebrinha && formatBRL(valorLebrinhaRomaneio) !== columnFilters.valorLebrinha) return false;
        if (columnFilters.valorClientes && formatBRL(valorClientesRomaneio) !== columnFilters.valorClientes) return false;
        if (columnFilters.valorTotal && formatBRL(romaneioTotal(romaneio)) !== columnFilters.valorTotal) return false;
        return true;
      })
      .sort((a, b) =>
        b.dataManifesto.localeCompare(a.dataManifesto) ||
        b.createdAt.localeCompare(a.createdAt),
      );
  }, [clientes, columnFilters, produtos, romaneios, search]);

  useEffect(() => {
    setPage(1);
  }, [search, columnFilters, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const visibleRomaneios = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const summary = useMemo(() => {
    let valorCliente = 0;
    let valorLebrinha = 0;
    let faltaPagar = 0;
    let foiPago = 0;
    filtered.forEach((romaneio) => {
      romaneio.produtos.forEach((item) => {
        const tipo = item.tipoManifesto ?? romaneio.tipoManifesto;
        if (tipo === "Receber c/ Cliente") {
          valorCliente += item.valorTotal;
          if (item.pagoCliente === true) foiPago += item.valorTotal;
          else faltaPagar += item.valorTotal;
        } else {
          valorLebrinha += item.valorTotal;
        }
      });
    });
    return { valorCliente, valorLebrinha, faltaPagar, foiPago };
  }, [filtered]);

  const columnFilterOptions = (key: RomaneioFilterKey) => {
    let values: string[] = [];
    if (key === "romaneio") values = romaneios.map((item) => item.romaneios || "Sem número");
    if (key === "veiculo") values = romaneios.map(romaneioVehicleLabel);
    if (key === "valorLebrinha") values = romaneios.map((romaneio) => formatBRL(romaneio.produtos.reduce((sum, item) => {
      const tipo = item.tipoManifesto ?? romaneio.tipoManifesto;
      return tipo === "Receber c/ Cliente" ? sum : sum + item.valorTotal;
    }, 0)));
    if (key === "valorClientes") values = romaneios.map((romaneio) => formatBRL(romaneio.produtos.reduce((sum, item) => {
      const tipo = item.tipoManifesto ?? romaneio.tipoManifesto;
      return tipo === "Receber c/ Cliente" ? sum + item.valorTotal : sum;
    }, 0)));
    if (key === "valorTotal") values = romaneios.map((item) => formatBRL(romaneioTotal(item)));
    return Array.from(new Set(values))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  };

  const hasColumnFilters = Boolean(
    columnFilters.romaneio ||
    columnFilters.dataInicio ||
    columnFilters.dataFim ||
    columnFilters.veiculo ||
    columnFilters.valorLebrinha ||
    columnFilters.valorClientes ||
    columnFilters.valorTotal,
  );

  const inspectionChargeTotals = useMemo(() => {
    const totals = Object.fromEntries(
      tipos.map((tipo) => [tipo, { itens: 0, valor: 0 }]),
    ) as Record<TipoManifesto, { itens: number; valor: number }>;

    inspecting?.produtos.forEach((item) => {
      const tipo = tipos.includes(item.tipoManifesto as TipoManifesto)
        ? item.tipoManifesto as TipoManifesto
        : inspecting.tipoManifesto;
      const safeTipo = tipos.includes(tipo as TipoManifesto)
        ? tipo as TipoManifesto
        : "Bonificação - Lebrinha";
      totals[safeTipo].itens += 1;
      totals[safeTipo].valor += item.valorTotal;
    });

    return totals;
  }, [inspecting]);

  const saveImportedRomaneio = async (result: PdfResponse, file: File) => {
    const entries = result.sugestoes.produtos;
    const first = entries[0];
    if (!first) throw new Error("O arquivo não possui itens vÃ¡lidos para cadastrar.");

    const pdfUrl = await fileToDataUrl(file);
    const itens: RomaneioItem[] = entries.map(({ produto, cliente, cadastro }, index) => {
      const ehVasilhame = /VASI.*(?:LH|LE).*AME/i.test(produto.descricao.replace(/\s+/g, ""));
      return {
        produtoId: cadastro.id,
        clienteId: cliente.id,
        romaneio: produto.romaneio,
        notaFiscal: produto.notaFiscal,
        serieNf: produto.serie,
        instrucaoCobranca: produto.instrucaoCobranca,
        quantidade: produto.quantidade,
        // Defesa adicional no momento da gravação: vasilhame nunca recebe preço.
        valorUnitario: ehVasilhame ? 0 : produto.valorUnitario,
        valorTotal: ehVasilhame ? 0 : produto.valorTotal,
        tipoManifesto: produto.tipoManifesto,
      };
    });
    const documento = result.documento;

    await create(
      first.cliente.id,
      documento.dataEmissao || first.produto.data,
      itens,
      first.produto.tipoManifesto,
      pdfUrl,
      {
        transportadoraCodigo: documento.transportadoraCodigo,
        transportadoraNome: documento.transportadoraNome,
        veiculoCodigo: documento.veiculoCodigo,
        placaVeiculo: documento.placaVeiculo,
        modeloVeiculo: documento.modeloVeiculo,
        romaneios: documento.romaneios.join(", "),
        notasFiscais: documento.notasFiscais.join(", "),
      },
    );
  };

  const handleImport = async (file?: File) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Selecione um arquivo PDF válido.");
      return;
    }

    setImporting(true);
    setImportProgress("Lendo PDF...");
    try {
      const progressCallback = (progress: PdfTextProgress) => {
        setImportProgress(pdfProgressLabel(progress));
      };

      // O backend recebe somente TEXTO. A camada digital é
      // extraída no navegador via PDF.js; scans/imagens caem no Tesseract local.
      // Isso evita empacotar pdf-parse/pdf.js de Node dentro do Worker.
      const digitalText = await extrairTextoPdf(file, progressCallback);
      const digitalResponse = await api.post<PdfResponse>(
        "/manifestos/interpretar-texto-pdf",
        { texto: digitalText },
        { timeout: 120_000 },
      );

      let response = digitalResponse;
      let selectedSource: "digital" | "ocr" = "digital";

      // Não esperamos a leitura digital zerar para tentar outra estratégia.
      // Se o resultado estiver estruturalmente suspeito (linha provável perdida,
      // cálculo incoerente, total divergente, placa/transportadora ausente),
      // fazemos OCR visual em alta resolução, interpretamos de novo e comparamos as
      // duas respostas. A leitura mais consistente vence.
      if (shouldTryOcrFallback(digitalResponse.data, digitalText)) {
        const digitalQuality = analyzeRomaneioReadQuality(digitalResponse.data, digitalText);
        setImportProgress(
          digitalQuality.reasons.length
            ? `Conferindo leitura (${digitalQuality.reasons[0]}). Tentando OCR em alta resolução...`
            : "Conferindo leitura. Tentando OCR em alta resolução...",
        );

        try {
          const ocrText = await extrairTextoPdf(file, progressCallback, { forceOcr: true });
          const ocrResponse = await api.post<PdfResponse>(
            "/manifestos/interpretar-texto-pdf",
            { texto: ocrText },
            { timeout: 180_000 },
          );
          const best = chooseBestRomaneioRead(
            digitalResponse.data,
            digitalText,
            ocrResponse.data,
            ocrText,
          );
          response = { ...digitalResponse, data: best.result };
          selectedSource = best.source;
        } catch (ocrError) {
          // Se a leitura digital já produziu itens válidos, não descartamos o
          // documento só porque a tentativa complementar de OCR falhou.
          if (!digitalResponse.data.sugestoes.produtos.length) throw ocrError;
          response = digitalResponse;
        }
      }

      const [vehiclesResponse] = await Promise.all([
        api.get<Veiculo[]>("/veiculos"),
        refreshClientes(),
        refreshProdutos(),
        refreshVeiculos(),
      ]);
      const currentVehicles = Array.isArray(vehiclesResponse.data) ? vehiclesResponse.data : [];
      if (!response.data.documento.parserVersion) {
        toast.error("O servidor de Romaneios está desatualizado. Reinicie/reimplante o backend.");
        return;
      }
      if (response.data.documento.parserVersion !== EXPECTED_ROMANEIO_PARSER_VERSION) {
        toast.error(
          `Backend desatualizado: servidor ${response.data.documento.parserVersion}; esperado ${EXPECTED_ROMANEIO_PARSER_VERSION}.`,
        );
        return;
      }
      if (!response.data.sugestoes.produtos.length) {
        toast.error(`Nenhuma linha foi identificada pelo parser ${response.data.documento.parserVersion}, mesmo após OCR.`);
        return;
      }

      setManualOpen(false);
      const vehicleBinding = bindImportedVehicle(response.data, currentVehicles);
      setReview({ result: vehicleBinding.result, file });
      if (vehicleBinding.importedPlate && !vehicleBinding.matched) {
        toast.warning(
          `A placa ${vehicleBinding.importedPlate} foi lida no PDF, mas não existe nos veículos cadastrados. Selecione uma placa cadastrada antes de salvar.`,
        );
      }
      const criados = response.data.sugestoes.clientesCriados + response.data.sugestoes.produtosCriados;
      toast.success(
        criados
          ? `PDF lido. ${response.data.sugestoes.clientesCriados} cliente(s) e ${response.data.sugestoes.produtosCriados} produto(s) foram cadastrados.`
          : `PDF lido e todos os dados foram preenchidos${selectedSource === "ocr" ? " (OCR de segurança selecionado)" : ""}.`,
      );
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message ?? error?.message ?? "Não foi possível interpretar o romaneio.");
    } finally {
      setImporting(false);
      setImportProgress("");
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  const handleBulkImport = async (fileList?: FileList | null) => {
    const files = Array.from(fileList ?? []).filter((file) =>
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"),
    );
    if (!files.length) {
      toast.error("Selecione pelo menos um arquivo PDF válido.");
      return;
    }

    setBulkImporting(true);
    setBulkImportProgress(`Preparando ${files.length} PDF(s)...`);
    const processed: BulkImportEntry[] = files.map((file) => ({ file }));

    try {
      // Extração local com concorrência controlada. PDFs digitais usam apenas
      // PDF.js (rápido); OCR só é acionado pelo extrator quando realmente
      // necessário. Nenhum PDF binário é enviado ao backend.
      const texts = new Array<string>(files.length);
      const initialResults = new Array<PdfResponse | undefined>(files.length);
      const extractionErrors = new Map<number, string>();
      const EXTRACT_CONCURRENCY = 4;
      let nextIndex = 0;
      let extractedCount = 0;

      const extractionWorker = async () => {
        while (true) {
          const index = nextIndex++;
          if (index >= files.length) return;
          try {
            texts[index] = await extrairTextoPdf(files[index], undefined, { bulk: true });
          } catch (error: any) {
            extractionErrors.set(index, error?.message ?? "Falha ao ler o PDF.");
          } finally {
            extractedCount += 1;
            setBulkImportProgress(`Lendo PDFs no navegador: ${extractedCount}/${files.length}...`);
          }
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(EXTRACT_CONCURRENCY, files.length) }, () => extractionWorker()),
      );

      extractionErrors.forEach((message, index) => {
        processed[index] = { file: files[index], error: message };
      });

      const validIndexes = files
        .map((_, index) => index)
        .filter((index) => Boolean(texts[index]) && !extractionErrors.has(index));

      // Busca a lista atual diretamente do backend. Assim o vínculo da placa
      // não depende do estado React ainda estar atualizado no mesmo tick.
      const vehiclesResponse = await api.get<Veiculo[]>("/veiculos");
      const registeredVehicles = Array.isArray(vehiclesResponse.data) ? vehiclesResponse.data : [];

      // Envia somente texto, em lotes pequenos para manter requests leves no Worker.
      const TEXT_BATCH_SIZE = 20;
      let interpretedCount = 0;
      for (let offset = 0; offset < validIndexes.length; offset += TEXT_BATCH_SIZE) {
        const indexes = validIndexes.slice(offset, offset + TEXT_BATCH_SIZE);
        const batchTexts = indexes.map((index) => texts[index]);
        setBulkImportProgress(`Interpretando romaneios: ${interpretedCount}/${validIndexes.length}...`);

        try {
          const response = await api.post<{ resultados: PdfResponse[] }>(
            "/manifestos/interpretar-textos-pdf",
            { textos: batchTexts },
            { timeout: 120_000 },
          );

          indexes.forEach((fileIndex, batchIndex) => {
            const result = response.data.resultados[batchIndex];
            if (!result?.documento?.parserVersion) {
              processed[fileIndex] = { file: files[fileIndex], error: "Servidor de Romaneios desatualizado." };
            } else if (result.documento.parserVersion !== EXPECTED_ROMANEIO_PARSER_VERSION) {
              processed[fileIndex] = {
                file: files[fileIndex],
                error: `Backend desatualizado: servidor ${result.documento.parserVersion}; esperado ${EXPECTED_ROMANEIO_PARSER_VERSION}.`,
              };
            } else {
              initialResults[fileIndex] = result;
              if (shouldTryOcrFallback(result, texts[fileIndex])) {
                // Mantemos o resultado inicial para comparar depois. Se ele já
                // possui itens, uma eventual falha do OCR não fará o arquivo
                // ser perdido.
                processed[fileIndex] = { file: files[fileIndex], error: "__RETRY_OCR__" };
              } else {
                processed[fileIndex] = {
                  file: files[fileIndex],
                  result: bindImportedVehicle(result, registeredVehicles).result,
                };
              }
            }
          });
        } catch (error: any) {
          const message = error?.response?.data?.message ?? error?.message ?? "Não foi possível interpretar este lote.";
          indexes.forEach((fileIndex) => {
            processed[fileIndex] = { file: files[fileIndex], error: message };
          });
        }

        interpretedCount += indexes.length;
      }

      // Segunda leitura nos PDFs cujo primeiro resultado ficou suspeito.
      // Não precisa zerar: linhas perdidas, cálculo/total incoerente ou cabeçalho
      // ausente também acionam OCR. Depois comparamos e preservamos o melhor.
      const retryIndexes = processed
        .map((entry, index) => entry.error === "__RETRY_OCR__" ? index : -1)
        .filter((index) => index >= 0);

      for (let retryPosition = 0; retryPosition < retryIndexes.length; retryPosition += 1) {
        const fileIndex = retryIndexes[retryPosition];
        const file = files[fileIndex];
        try {
          setBulkImportProgress(`OCR de segurança: ${retryPosition + 1}/${retryIndexes.length}...`);
          const ocrText = await extrairTextoPdf(file, undefined, { bulk: true, forceOcr: true });
          const retryResponse = await api.post<PdfResponse>(
            "/manifestos/interpretar-texto-pdf",
            { texto: ocrText },
            { timeout: 180_000 },
          );
          const initial = initialResults[fileIndex];
          if (initial) {
            const best = chooseBestRomaneioRead(
              initial,
              texts[fileIndex],
              retryResponse.data,
              ocrText,
            );
            if (best.result.sugestoes.produtos.length) {
              processed[fileIndex] = {
                file,
                result: bindImportedVehicle(best.result, registeredVehicles).result,
              };
            } else {
              processed[fileIndex] = { file, error: "Nenhuma linha foi identificada nem após OCR." };
            }
          } else if (retryResponse.data.sugestoes.produtos.length) {
            processed[fileIndex] = {
              file,
              result: bindImportedVehicle(retryResponse.data, registeredVehicles).result,
            };
          } else {
            processed[fileIndex] = { file, error: "Nenhuma linha foi identificada nem após OCR." };
          }
        } catch (error: any) {
          const initial = initialResults[fileIndex];
          if (initial?.sugestoes.produtos.length) {
            // OCR complementar falhou, mas a primeira leitura era utilizável.
            processed[fileIndex] = {
              file,
              result: bindImportedVehicle(initial, registeredVehicles).result,
            };
          } else {
            processed[fileIndex] = {
              file,
              error: error?.response?.data?.message ?? error?.message ?? "Falha no OCR de segurança.",
            };
          }
        }
      }

      await Promise.all([refreshClientes(), refreshProdutos(), refreshVeiculos()]);
      setBulkReview(processed);
      const valid = processed.filter((entry) => entry.result).length;
      const failed = processed.length - valid;
      if (valid) toast.success(`${valid} PDF(s) preparado(s) para importação.`);
      if (failed) toast.error(`${failed} PDF(s) não puderam ser interpretados.`);
    } finally {
      setBulkImporting(false);
      setBulkImportProgress("");
      if (bulkImportInputRef.current) bulkImportInputRef.current.value = "";
    }
  };

  const confirmImport = async () => {
    if (!review) return;
    const registeredVehicle = findRegisteredVehicleByPlate(review.result.documento.placaVeiculo);
    if (!registeredVehicle) {
      toast.error("Selecione uma placa já cadastrada antes de cadastrar o romaneio.");
      return;
    }
    // Garante que os três campos gravados vêm do mesmo cadastro de veículo.
    review.result.documento.placaVeiculo = formatPlate(registeredVehicle.placa);
    review.result.documento.modeloVeiculo = registeredVehicle.modelo ?? "";
    review.result.documento.veiculoCodigo = registeredVehicle.id;
    setSaving(true);
    try {
      await saveImportedRomaneio(review.result, review.file);
      setReview(null);
      toast.success("Romaneio cadastrado com todos os itens.");
    } catch (error) {
      console.error(error);
      toast.error(
        (error as any)?.response?.data?.message ??
        "Não foi possível cadastrar o romaneio.",
      );
    } finally {
      setSaving(false);
    }
  };

  const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const postBulkSaveWithRetry = async (payloads: any[]) => {
    let lastError: any = null;
    for (let attempt = 0; attempt <= BULK_SAVE_MAX_RETRIES; attempt += 1) {
      try {
        return await api.post<{
          imported: Array<{ index: number; id: string }>;
          failed: Array<{ index: number; message: string }>;
        }>("/manifestos/importar-lote", { items: payloads }, { timeout: 120_000 });
      } catch (error: any) {
        lastError = error;
        const status = Number(error?.response?.status || 0);
        const transient = !status || status === 502 || status === 503 || status === 504;
        if (!transient || attempt >= BULK_SAVE_MAX_RETRIES) throw error;

        // 503 no Vite normalmente significa que o backend reiniciou ou ficou
        // momentaneamente indisponível. Esperar e repetir evita marcar todo o
        // lote como erro por uma indisponibilidade de poucos segundos.
        const delay = Math.min(8_000, 750 * (2 ** attempt));
        setBulkImportProgress(
          `Servidor indisponível. Tentando novamente em ${Math.ceil(delay / 1000)}s...`,
        );
        await wait(delay);
      }
    }
    throw lastError;
  };

  const confirmBulkImport = async () => {
    const allResultEntries = (bulkReview ?? []).filter(
      (entry): entry is BulkImportEntry & { result: PdfResponse } => Boolean(entry.result),
    );
    const unmatchedVehicles = allResultEntries.filter(
      (entry) => !findRegisteredVehicleByPlate(entry.result.documento.placaVeiculo),
    );
    const validEntries = allResultEntries.filter(
      (entry) => Boolean(findRegisteredVehicleByPlate(entry.result.documento.placaVeiculo)),
    );
    if (unmatchedVehicles.length) {
      toast.error(`${unmatchedVehicles.length} romaneio(s) estão sem placa cadastrada correspondente e não serão importados.`);
    }
    if (!validEntries.length) {
      toast.error("Nenhum PDF válido para cadastrar.");
      return;
    }

    setBulkSaving(true);
    const failed: BulkImportEntry[] = [];
    let imported = 0;
    try {
      for (let offset = 0; offset < validEntries.length; offset += BULK_SAVE_CHUNK_SIZE) {
        const chunk = validEntries.slice(offset, offset + BULK_SAVE_CHUNK_SIZE);
        setBulkImportProgress(
          `Cadastrando romaneios: ${imported + failed.length}/${validEntries.length}...`,
        );

        // Converte os PDFs deste pequeno lote em paralelo, sem manter os 249
        // arquivos em base64 simultaneamente na memória do navegador.
        const payloads = await Promise.all(chunk.map(async (entry) => {
          const entries = entry.result.sugestoes.produtos;
          const first = entries[0];
          if (!first) throw new Error("O arquivo não possui itens válidos para cadastrar.");
          const documento = entry.result.documento;
          const registeredVehicle = findRegisteredVehicleByPlate(documento.placaVeiculo);
          if (!registeredVehicle) throw new Error("A placa lida não corresponde a um veículo cadastrado.");
          const pdfUrl = await fileToDataUrl(entry.file);
          return {
            clienteId: first.cliente.id,
            dataManifesto: documento.dataEmissao || first.produto.data,
            tipoManifesto: first.produto.tipoManifesto,
            pdfUrl,
            transportadoraCodigo: documento.transportadoraCodigo,
            transportadoraNome: documento.transportadoraNome,
            veiculoCodigo: registeredVehicle.id,
            placaVeiculo: formatPlate(registeredVehicle.placa),
            modeloVeiculo: registeredVehicle.modelo ?? "",
            romaneios: documento.romaneios.join(", "),
            notasFiscais: documento.notasFiscais.join(", "),
            produtos: entries.map(({ produto, cliente, cadastro }) => {
              const ehVasilhame = /VASI.*(?:LH|LE).*AME/i.test(produto.descricao.replace(/\s+/g, ""));
              return {
                produtoId: cadastro.id,
                clienteId: cliente.id,
                romaneio: produto.romaneio,
                notaFiscal: produto.notaFiscal,
                serieNf: produto.serie,
                instrucaoCobranca: produto.instrucaoCobranca,
                quantidade: produto.quantidade,
                valorUnitario: ehVasilhame ? 0 : produto.valorUnitario,
                valorTotal: ehVasilhame ? 0 : produto.valorTotal,
                tipoManifesto: produto.tipoManifesto,
              };
            }),
          };
        }));

        try {
          const response = await postBulkSaveWithRetry(payloads);

          imported += response.data.imported.length;
          response.data.failed.forEach((item) => {
            failed.push({ ...chunk[item.index], error: item.message });
          });
        } catch (error: any) {
          // Se um lote inteiro ainda falhar após as tentativas, não condena os
          // cinco arquivos de uma vez. Reenvia um por vez; assim uma falha de
          // gateway/DB ou um registro problemático não derruba os demais.
          for (let itemIndex = 0; itemIndex < chunk.length; itemIndex += 1) {
            const entry = chunk[itemIndex];
            const payload = payloads[itemIndex];
            try {
              const singleResponse = await postBulkSaveWithRetry([payload]);
              imported += singleResponse.data.imported.length;
              if (singleResponse.data.failed.length) {
                failed.push({
                  ...entry,
                  error: singleResponse.data.failed[0]?.message ?? "Não foi possível cadastrar este romaneio.",
                });
              }
            } catch (singleError: any) {
              failed.push({
                ...entry,
                error:
                  singleError?.response?.data?.message ??
                  singleError?.message ??
                  "Servidor indisponível ao cadastrar este romaneio.",
              });
            }
          }
        }
      }

      // Uma única recarga ao final substitui centenas de atualizações otimistas
      // e eventos de sincronização disparados pelo create() individual.
      await refreshRomaneios();
      if (imported) toast.success(`${imported} romaneio(s) importado(s) com sucesso.`);
      if (failed.length) {
        setBulkReview(failed);
        toast.error(`${failed.length} romaneio(s) não puderam ser cadastrados.`);
      } else {
        setBulkReview(null);
      }
    } finally {
      setBulkSaving(false);
      setBulkImportProgress("");
    }
  };

  const openManual = (romaneio?: Romaneio) => {
    setEditing(romaneio ?? null);
    setDraft(emptyDraft());
    setManual(romaneio ? {
      data: romaneio.dataManifesto,
      placa: romaneio.placaVeiculo ?? "",
      modelo: romaneio.modeloVeiculo ?? "",
      transportadoraCodigo: romaneio.transportadoraCodigo ?? "",
      transportadoraNome: romaneio.transportadoraNome ?? "",
      veiculoCodigo: romaneio.veiculoCodigo ?? "",
      itens: romaneio.produtos.map((item) => ({ ...item })),
    } : emptyManual());
    setManualOpen(true);
  };

  const addDraft = () => {
    const quantidade = Number(draft.quantidade.replace(",", "."));
    const valorUnitario = Number(draft.valorUnitario.replace(",", "."));
    if (!draft.clienteId || !draft.produtoId) return toast.error("Selecione cliente e produto.");
    if (!Number.isFinite(quantidade) || quantidade <= 0) return toast.error("Informe uma quantidade vÃ¡lida.");
    if (!Number.isFinite(valorUnitario) || valorUnitario < 0) return toast.error("Informe um valor unitÃ¡rio vÃ¡lido.");
    setManual((current) => ({
      ...current,
      itens: [...current.itens, {
        produtoId: draft.produtoId,
        clienteId: draft.clienteId,
        romaneio: draft.romaneio,
        notaFiscal: draft.notaFiscal,
        serieNf: draft.serieNf,
        instrucaoCobranca: draft.tipoManifesto,
        quantidade,
        valorUnitario,
        valorTotal: Number((quantidade * valorUnitario).toFixed(2)),
        tipoManifesto: draft.tipoManifesto,
      }],
    }));
    // Mantém o cliente e os dados comuns selecionados para facilitar o lançamento
    // de vários produtos para o mesmo cliente no mesmo romaneio/NF.
    setDraft({
      ...emptyDraft(),
      clienteId: draft.clienteId,
      romaneio: draft.romaneio,
      notaFiscal: draft.notaFiscal,
      serieNf: draft.serieNf,
      tipoManifesto: draft.tipoManifesto,
    });
  };

  const saveManual = async () => {
    if (!manual.data) return toast.error("Informe a data do romaneio.");
    if (!manual.itens.length) return toast.error("Adicione pelo menos um item.");
    const first = manual.itens[0];
    const clienteId = first.clienteId;
    if (!clienteId) return toast.error("Informe o cliente do primeiro item.");
    const metadata = {
      transportadoraCodigo: manual.transportadoraCodigo,
      transportadoraNome: manual.transportadoraNome,
      veiculoCodigo: manual.veiculoCodigo,
      placaVeiculo: manual.placa,
      modeloVeiculo: manual.modelo,
      romaneios: Array.from(new Set(manual.itens.map((item) => item.romaneio).filter(Boolean))).join(", "),
      notasFiscais: Array.from(new Set(manual.itens.map((item) => item.notaFiscal).filter(Boolean))).join(", "),
    };
    setSaving(true);
    try {
      if (editing) {
        await update(editing.id, clienteId, manual.data, manual.itens, first.tipoManifesto ?? "Bonificação - Lebrinha", editing.pdfUrl, metadata);
      } else {
        await create(clienteId, manual.data, manual.itens, first.tipoManifesto ?? "Bonificação - Lebrinha", undefined, metadata);
      }
      setManualOpen(false);
      setEditing(null);
      toast.success(editing ? "Romaneio atualizado." : "Romaneio cadastrado.");
    } catch (error) {
      console.error(error);
      toast.error(
        (error as any)?.response?.data?.message ??
        "Não foi possível salvar o romaneio.",
      );
    } finally {
      setSaving(false);
    }
  };

  const downloadPdf = async (romaneio: Romaneio) => {
    try {
      let pdfUrl = romaneio.pdfUrl;
      if (!pdfUrl && romaneio.pdfStored) {
        const response = await api.get<Romaneio>(`/manifestos/${romaneio.id}`);
        pdfUrl = response.data.pdfUrl;
      }
      if (!pdfUrl) return toast.error("Este romaneio não possui PDF armazenado.");
      const link = document.createElement("a");
      link.href = pdfUrl;
      link.download = `romaneio-${romaneio.romaneios || romaneio.id}.pdf`;
      link.click();
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? "Não foi possível baixar o PDF.");
    }
  };

  const updateClientPayment = async (item: RomaneioItem, pago: boolean) => {
    if (!inspecting || !item.id) {
      toast.error("Não foi possível identificar o item do romaneio.");
      return;
    }

    const currentInspecting = inspecting;
    const requestRevision = (paymentRequestRevision.current[item.id] ?? 0) + 1;
    paymentRequestRevision.current[item.id] = requestRevision;
    const updatedInspecting: Romaneio = {
      ...currentInspecting,
      produtos: currentInspecting.produtos.map((produto) =>
        produto.id === item.id ? { ...produto, pagoCliente: pago } : produto,
      ),
    };

    setInspecting(updatedInspecting);
    replaceLocalItem(updatedInspecting);
    try {
      await api.patch<Romaneio>(
        `/manifestos/${currentInspecting.id}/produtos/${item.id}/pagamento`,
        { pago },
      );
      if (paymentRequestRevision.current[item.id] !== requestRevision) return;
      toast.success(pago ? "Pagamento confirmado." : "Item marcado como ainda não pago.");
    } catch (error: any) {
      console.error(error);
      if (paymentRequestRevision.current[item.id] !== requestRevision) return;
      setInspecting(currentInspecting);
      replaceLocalItem(currentInspecting);
      toast.error(error?.response?.data?.message ?? "Não foi possível atualizar o pagamento.");
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold">Romaneios</h1>
            <p className="mt-1 text-sm text-muted-foreground">Importe romaneios de frete e acompanhe cada cliente, produto, NF e cobrança.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={importInputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(event) => void handleImport(event.target.files?.[0])} />
            <input ref={bulkImportInputRef} type="file" accept=".pdf,application/pdf" multiple className="hidden" onChange={(event) => void handleBulkImport(event.target.files)} />
            <Button
              variant="outline"
              disabled={bulkImporting || importing}
              title={bulkImportProgress || undefined}
              onClick={() => bulkImportInputRef.current?.click()}
            >
              {bulkImporting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Files className="mr-2 h-4 w-4" />}
              {bulkImporting ? "Processando arquivos..." : "Importar em massa"}
            </Button>
            <Button onClick={() => openManual()}><Plus className="mr-2 h-4 w-4" /> Novo Romaneio</Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Romaneios", value: filtered.length, Icon: FileText },
            {
              label: "Total Clientes",
              value: formatBRL(summary.valorCliente),
              Icon: CircleDollarSign,
              valueClass: "text-blue-500",
            },
            { label: "Total Lebrinha", value: formatBRL(summary.valorLebrinha), Icon: Truck, valueClass: "text-violet-500" },
            { label: "Foi pago", value: formatBRL(summary.foiPago), Icon: Check, valueClass: "text-emerald-500" },
            { label: "Falta pagar", value: formatBRL(summary.faltaPagar), Icon: CircleDollarSign, valueClass: "text-amber-500" },
          ].map(({ label, value, Icon, valueClass }) => (
            <div key={label} className="rounded-xl border bg-card p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><Icon className="h-4 w-4" />{label}</p>
              <p className={`mt-2 text-2xl font-bold ${valueClass ?? ""}`}>{String(value)}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar romaneio, NF, cliente, produto ou placa..." className="pl-9" />
          </div>
          {hasColumnFilters && (
            <Button type="button" variant="outline" onClick={() => setColumnFilters(emptyColumnFilters)}>
              <X className="mr-2 h-4 w-4" />Limpar filtros
            </Button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">Nenhum romaneio encontrado.</div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    {romaneioColumns.map((column) => {
                      const valueKey = column.key as Exclude<RomaneioFilterKey, "data">;
                      const active = column.date
                        ? Boolean(columnFilters.dataInicio || columnFilters.dataFim)
                        : Boolean(columnFilters[valueKey]);
                      const options = columnFilterOptions(column.key).filter((option) =>
                        normalized(option).includes(normalized(columnFilterSearch)),
                      );
                      const justify = column.align === "right"
                        ? "justify-end text-right"
                        : column.align === "center"
                          ? "justify-center text-center"
                          : "justify-start text-left";
                      return (
                        <th key={column.key} className="px-4 py-3 font-semibold">
                          <Popover
                            open={activeColumnFilter === column.key}
                            onOpenChange={(open) => {
                              setActiveColumnFilter(open ? column.key : null);
                              setColumnFilterSearch("");
                            }}
                          >
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className={`flex w-full items-center gap-1 rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary ${justify} ${active ? "text-primary" : "text-muted-foreground"}`}
                                title={`Filtrar por ${column.label}`}
                              >
                                <span>{column.label}</span>
                                <ChevronDown className="h-4 w-4 shrink-0" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent align={column.align === "right" ? "end" : "start"} className="w-80 p-0">
                              {column.date ? (
                                <div className="space-y-3 p-3">
                                  <div className="space-y-1"><Label className="text-xs">De</Label><DatePicker value={columnFilters.dataInicio} onChange={(value) => setColumnFilters((current) => ({ ...current, dataInicio: value }))} placeholder="Data inicial" /></div>
                                  <div className="space-y-1"><Label className="text-xs">Até</Label><DatePicker value={columnFilters.dataFim} onChange={(value) => setColumnFilters((current) => ({ ...current, dataFim: value }))} placeholder="Data final" /></div>
                                </div>
                              ) : (
                                <>
                                  <div className="border-b p-3">
                                    <Input value={columnFilterSearch} onChange={(event) => setColumnFilterSearch(event.target.value)} placeholder={`Pesquisar ${column.label.toLocaleLowerCase("pt-BR")}...`} autoFocus />
                                  </div>
                                  <div className="max-h-60 overflow-y-auto p-2">
                                    {options.length === 0 ? (
                                      <p className="py-4 text-center text-xs text-muted-foreground">Nenhuma opção encontrada.</p>
                                    ) : options.map((option) => (
                                      <button
                                        type="button"
                                        key={option}
                                        onClick={() => {
                                          setColumnFilters((current) => ({ ...current, [valueKey]: option }));
                                          setActiveColumnFilter(null);
                                        }}
                                        className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${columnFilters[valueKey] === option ? "bg-primary/10 text-primary" : ""}`}
                                      >
                                        <span className="truncate">{option}</span>
                                        {columnFilters[valueKey] === option && <Check className="h-4 w-4" />}
                                      </button>
                                    ))}
                                  </div>
                                </>
                              )}
                              <div className="flex gap-2 border-t p-3">
                                <Button size="sm" variant="outline" className="flex-1" onClick={() => setColumnFilters((current) => column.date ? { ...current, dataInicio: "", dataFim: "" } : { ...current, [valueKey]: "" })}>Limpar</Button>
                                <Button size="sm" className="flex-1" onClick={() => setActiveColumnFilter(null)}>OK</Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </th>
                      );
                    })}
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRomaneios.map((romaneio) => {
                    const total = romaneio.produtos.reduce((sum, item) => sum + item.valorTotal, 0);
                    const hasPendingReceberCliente = romaneio.produtos.some((item) => {
                      const tipo = item.tipoManifesto ?? romaneio.tipoManifesto;
                      return tipo === "Receber c/ Cliente" && item.pagoCliente !== true;
                    });
                    const valorLebrinhaRomaneio = romaneio.produtos.reduce((sum, item) => {
                      const tipo = item.tipoManifesto ?? romaneio.tipoManifesto;
                      return tipo === "Receber c/ Cliente" ? sum : sum + item.valorTotal;
                    }, 0);
                    const valorClientesRomaneio = romaneio.produtos.reduce((sum, item) => {
                      const tipo = item.tipoManifesto ?? romaneio.tipoManifesto;
                      return tipo === "Receber c/ Cliente" ? sum + item.valorTotal : sum;
                    }, 0);
                    return (
                      <tr key={romaneio.id} className="border-t transition-colors hover:bg-muted/20">
                        <td className="max-w-[220px] px-4 py-3">
                          <p className="truncate font-semibold">{romaneio.romaneios || "Sem número"}</p>
                          <p className="truncate text-xs text-muted-foreground">{romaneio.transportadoraNome || "Sem transportadora"}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-medium">{formatDate(romaneio.dataManifesto)}</td>
                        <td className="max-w-[260px] px-4 py-3">
                          <p className="truncate font-medium">{romaneio.placaVeiculo || "—"}</p>
                          <p className="truncate text-xs text-muted-foreground">{romaneio.modeloVeiculo || "Modelo não informado"}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-center font-semibold text-violet-500 tabular-nums">{formatBRL(valorLebrinhaRomaneio)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-center font-semibold text-blue-500 tabular-nums">{formatBRL(valorClientesRomaneio)}</td>
                         <td className="whitespace-nowrap px-4 py-3 text-center font-bold text-primary tabular-nums">
                           <span className="mx-auto grid w-full max-w-[150px] grid-cols-[1.25rem_minmax(0,1fr)_1.25rem] items-center gap-x-1">
                             <span aria-hidden="true" />
                             <span className="justify-self-center">{formatBRL(total)}</span>
                             {hasPendingReceberCliente ? (
                               <span
                                 className="inline-flex h-5 w-5 items-center justify-center justify-self-center rounded-full border border-amber-500 text-[11px] font-black leading-none text-amber-500"
                                 title="Existem itens de Receber c/ Cliente sem decisão de pagamento."
                                 aria-label="Existem itens de Receber c/ Cliente sem decisão de pagamento."
                               >
                                 !
                               </span>
                             ) : (
                               <span aria-hidden="true" />
                             )}
                           </span>
                         </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <div className="inline-flex gap-1">
                            <Button size="icon" variant="ghost" title="Inspecionar romaneio" aria-label="Inspecionar romaneio" onClick={() => setInspecting(romaneio)}><Eye className="h-4 w-4 text-blue-500" /></Button>
                            {(romaneio.pdfUrl || romaneio.pdfStored) && <Button size="icon" variant="ghost" title="Baixar PDF" aria-label="Baixar PDF" onClick={() => void downloadPdf(romaneio)}><Download className="h-4 w-4 text-emerald-600" /></Button>}
                            <Button size="icon" variant="ghost" title="Excluir" aria-label="Excluir romaneio" onClick={async () => {
                              if (!window.confirm("Deseja excluir este romaneio?")) return;
                              try {
                                await remove(romaneio.id);
                                toast.success("Romaneio excluído.");
                              } catch (error: any) {
                                console.error("Falha ao excluir romaneio.", error);
                                toast.error(error?.response?.data?.message ?? "Não foi possível excluir o romaneio.");
                              }
                            }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>{filtered.length} romaneio(s) encontrado(s).</span>

            <label className="flex items-center gap-2">
              <span>Romaneios por página</span>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                aria-label="Quantidade de romaneios por página"
              >
                {[15, 30, 60, 120, 240].map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>
              Anterior
            </Button>
            <span className="min-w-[110px] text-center text-sm text-muted-foreground">
              Página {page} de {totalPages}
            </span>
            <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>
              Próxima
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={Boolean(inspecting)} onOpenChange={(open) => !open && setInspecting(null)}>
        <DialogContent className="max-h-[94vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Inspeção do romaneio {inspecting?.romaneios || "sem número"}</DialogTitle>
          </DialogHeader>
          {inspecting && (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
                <div><p className="text-xs text-muted-foreground">Data</p><p className="font-semibold">{formatDate(inspecting.dataManifesto)}</p></div>
                <div><p className="text-xs text-muted-foreground">Veículo</p><p className="font-semibold">{inspecting.placaVeiculo || "—"}</p><p className="text-xs text-muted-foreground">{inspecting.modeloVeiculo || "Modelo não informado"}</p></div>
                <div><p className="text-xs text-muted-foreground">Transportadora</p><p className="font-semibold">{inspecting.transportadoraNome || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Itens</p><p className="font-semibold">{inspecting.produtos.length}</p></div>
                <div><p className="text-xs text-muted-foreground">Valor total</p><p className="font-bold text-primary">{formatBRL(inspecting.produtos.reduce((sum, item) => sum + item.valorTotal, 0))}</p></div>
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[1080px] text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr><th className="px-3 py-2 text-left">Rom./Item</th><th className="px-3 py-2 text-left">Produto</th><th className="px-3 py-2 text-left">NF/Série</th><th className="px-3 py-2 text-right">Quantidade</th><th className="px-3 py-2 text-right">Valor unitÃ¡rio</th><th className="px-3 py-2 text-right">Valor total</th><th className="px-3 py-2 text-left">Cobrança</th></tr>
                  </thead>
                  <tbody>
                    {inspecting.produtos.map((item, index) => {
                      const cliente = clienteById(item.clienteId ?? inspecting.clienteId);
                      const produto = produtoById(item.produtoId);
                      return (
                        <tr key={`${inspecting.id}-${index}`} className="border-t">
                          <td className="px-3 py-3"><p className="font-medium">{cliente?.nomeFantasia ?? "Cliente não localizado"}</p><p className="text-xs text-muted-foreground">Cód. {cliente?.codigoInterno || "—"}</p></td>
                          <td className="px-3 py-3"><p className="font-medium">{produto?.nome ?? "Produto não localizado"}</p><p className="text-xs text-muted-foreground">Cód. {produto?.codigoInterno || "—"}</p></td>
                          <td className="whitespace-nowrap px-3 py-3">{item.notaFiscal || "—"}/{item.serieNf || "—"}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{item.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{formatBRL(item.valorUnitario)}</td>
                          <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatBRL(item.valorTotal)}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <TypeBadge type={item.tipoManifesto} />
                              {(item.tipoManifesto ?? inspecting.tipoManifesto) === "Receber c/ Cliente" && (
                                <div className="inline-flex overflow-hidden rounded-md border-2 border-border bg-background shadow-sm">
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className={`h-9 w-9 rounded-none ${item.pagoCliente === true ? "bg-emerald-600 text-white shadow-inner hover:bg-emerald-700 hover:text-white" : "text-emerald-500 hover:bg-emerald-500/20 hover:text-emerald-600"}`}
                                    title="Marcar como pago"
                                    aria-label="Marcar como pago"
                                    aria-pressed={item.pagoCliente === true}
                                    onClick={() => void updateClientPayment(item, true)}
                                  >
                                    <Check className="h-5 w-5 stroke-[3]" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className={`h-9 w-9 rounded-none border-l-2 ${item.pagoCliente === false ? "bg-red-600 text-white shadow-inner hover:bg-red-700 hover:text-white" : "text-red-500 hover:bg-red-500/20 hover:text-red-600"}`}
                                    title="Marcar como ainda não pago"
                                    aria-label="Marcar como ainda não pago"
                                    aria-pressed={item.pagoCliente === false}
                                    onClick={() => void updateClientPayment(item, false)}
                                  >
                                    <X className="h-5 w-5 stroke-[3]" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="w-full overflow-hidden rounded-lg border lg:max-w-xl">
                  <div className="border-b bg-muted/30 px-3 py-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Resumo por cobrança</p>
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {[
                        { tipo: "Receber c/ Cliente" as TipoManifesto, label: "Valor total a receber dos clientes" },
                        { tipo: "Acertar c/ Lebrinha" as TipoManifesto, label: "Valor total a acertar com a Lebrinha" },
                        { tipo: "Bonificação - Lebrinha" as TipoManifesto, label: "Valor total em bonificações" },
                      ].map(({ tipo, label }) => (
                        <tr key={tipo} className="border-t first:border-t-0">
                          <td className="px-3 py-2.5"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${typeClasses(tipo)}`}>{label}</span></td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-center text-xs text-muted-foreground">{inspectionChargeTotals[tipo].itens} item(ns)</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right font-bold tabular-nums">{formatBRL(inspectionChargeTotals[tipo].valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  {(inspecting.pdfUrl || inspecting.pdfStored) && <Button variant="outline" onClick={() => void downloadPdf(inspecting)}><Download className="mr-2 h-4 w-4" />Baixar PDF</Button>}
                  <Button onClick={() => {
                    const romaneio = inspecting;
                    setInspecting(null);
                    openManual(romaneio);
                  }}><Pencil className="mr-2 h-4 w-4" />Editar</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(bulkReview)} onOpenChange={(open) => {
        if (!open && !bulkSaving) setBulkReview(null);
      }}>
        <DialogContent className="max-h-[94vh] max-w-5xl overflow-y-auto">
          <DialogHeader><DialogTitle>Conferir importação em massa</DialogTitle></DialogHeader>
          {bulkReview && (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 text-sm sm:grid-cols-3">
                <div><p className="text-xs text-muted-foreground">Arquivos selecionados</p><p className="text-xl font-bold">{bulkReview.length}</p></div>
                <div><p className="text-xs text-muted-foreground">Prontos para cadastrar</p><p className="text-xl font-bold text-emerald-600">{bulkReview.filter((entry) => entry.result && !entry.error).length}</p></div>
                <div><p className="text-xs text-muted-foreground">Com erro</p><p className="text-xl font-bold text-destructive">{bulkReview.filter((entry) => entry.error || !entry.result).length}</p></div>
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr><th className="px-3 py-2 text-left">Arquivo</th><th className="px-3 py-2 text-left">Romaneio</th><th className="px-3 py-2 text-center">Itens</th><th className="px-3 py-2 text-center">Clientes</th><th className="px-3 py-2 text-right">Valor total</th><th className="px-3 py-2 text-left">Situação</th><th className="w-12 px-3 py-2"></th></tr>
                  </thead>
                  <tbody>
                    {bulkReview.map((entry, index) => {
                      const itemCount = entry.result?.sugestoes.produtos.length ?? 0;
                      const clientCount = new Set(
                        entry.result?.sugestoes.produtos.map((item) => item.cliente.id) ?? [],
                      ).size;
                      return (
                        <tr key={`${entry.file.name}-${index}`} className="border-t">
                          <td className="max-w-[260px] px-3 py-3"><p className="truncate font-medium">{entry.file.name}</p><p className="text-xs text-muted-foreground">{(entry.file.size / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB</p></td>
                          <td className="px-3 py-3 font-medium">{entry.result?.documento.romaneios.join(", ") || "—"}</td>
                          <td className="px-3 py-3 text-center font-semibold">{itemCount}</td>
                          <td className="px-3 py-3 text-center font-semibold">{clientCount}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums">{entry.result ? formatBRL(entry.result.documento.valorTotal) : "—"}</td>
                          <td className="max-w-[250px] px-3 py-3">
                            {entry.result && !entry.error ? (
                              <span className="inline-flex rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">Pronto</span>
                            ) : (
                              <div><span className="inline-flex rounded-full bg-destructive/15 px-2.5 py-1 text-xs font-semibold text-destructive">Erro</span><p className="mt-1 text-xs text-destructive">{entry.error}</p></div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right"><Button size="icon" variant="ghost" title="Remover da importação" disabled={bulkSaving} onClick={() => setBulkReview((current) => {
                            const next = current?.filter((_, itemIndex) => itemIndex !== index) ?? [];
                            return next.length ? next : null;
                          })}><X className="h-4 w-4 text-muted-foreground" /></Button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" disabled={bulkSaving} onClick={() => setBulkReview(null)}>Cancelar</Button>
                <Button disabled={bulkSaving || !bulkReview.some((entry) => entry.result)} onClick={() => void confirmBulkImport()}>
                  {bulkSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {bulkSaving ? "Cadastrando..." : `Cadastrar ${bulkReview.filter((entry) => entry.result).length} romaneio(s)`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(review)} onOpenChange={(open) => !open && setReview(null)}>
        <DialogContent className="max-h-[94vh] max-w-7xl overflow-y-auto">
          <DialogHeader><DialogTitle>Conferir e editar importação do romaneio</DialogTitle></DialogHeader>
          {review && (
            <div className="space-y-5">
              <div className="rounded-xl border bg-muted/10 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">Dados do romaneio</p>
                    <p className="text-xs text-muted-foreground">Revise e altere os dados lidos do PDF antes de cadastrar.</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Valor total</p>
                    <p className="text-lg font-bold text-primary">{formatBRL(review.result.documento.valorTotal)}</p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <div className="space-y-1.5">
                    <Label>Data</Label>
                    <Input
                      type="date"
                      value={review.result.documento.dataEmissao || ""}
                      onChange={(event) => updateReviewDocument({ dataEmissao: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5 xl:col-span-2">
                    <Label>Placa</Label>
                    <SearchableSelect
                      value={findRegisteredVehicleByPlate(review.result.documento.placaVeiculo)?.id ?? ""}
                      placeholder="Selecione uma placa cadastrada"
                      searchPlaceholder="Digite a placa ou modelo..."
                      options={veiculos.map((veiculo) => ({
                        value: veiculo.id,
                        label: `${formatPlate(veiculo.placa)}${veiculo.modelo ? ` - ${veiculo.modelo}` : ""}`,
                        keywords: `${veiculo.placa} ${formatPlate(veiculo.placa)} ${veiculo.modelo ?? ""}`,
                      }))}
                      onChange={(veiculoId) => {
                        const veiculo = veiculos.find((item) => item.id === veiculoId);
                        updateReviewDocument({
                          placaVeiculo: veiculo ? formatPlate(veiculo.placa) : "",
                          modeloVeiculo: veiculo?.modelo ?? "",
                          veiculoCodigo: veiculo?.id ?? "",
                        });
                      }}
                    />
                  </div>
                  <div className="space-y-1.5 xl:col-span-2">
                    <Label>Modelo</Label>
                    <Input
                      value={review.result.documento.modeloVeiculo || ""}
                      onChange={(event) => updateReviewDocument({ modeloVeiculo: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-1 xl:col-span-2">
                    <Label>Cód. transportadora</Label>
                    <Input
                      value={review.result.documento.transportadoraCodigo || ""}
                      onChange={(event) => updateReviewDocument({ transportadoraCodigo: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-1 xl:col-span-3">
                    <Label>Transportadora</Label>
                    <Input
                      value={review.result.documento.transportadoraNome || ""}
                      onChange={(event) => updateReviewDocument({ transportadoraNome: event.target.value })}
                    />
                  </div>
                </div>
              </div>

              {(review.result.sugestoes.clientesCriados > 0 || review.result.sugestoes.produtosCriados > 0) && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-200">
                  Foram cadastrados automaticamente {review.result.sugestoes.clientesCriados} cliente(s) e {review.result.sugestoes.produtosCriados} produto(s). Você ainda pode trocar os vínculos abaixo.
                </div>
              )}

              <div className="space-y-3">
                {review.result.sugestoes.produtos.map(({ produto, cliente, cadastro }, index) => {
                  const ehVasilhame = /VASI.*(?:LH|LE).*AME/i.test(produto.descricao.replace(/\s+/g, ""));
                  const valorUnitario = ehVasilhame ? 0 : produto.valorUnitario;
                  const valorTotal = ehVasilhame ? 0 : produto.valorTotal;

                  return (
                    <div key={`${produto.romaneio}-${produto.blocoCliente ?? "sem-bloco"}-${produto.item}-${produto.codigo}-${index}`} className="rounded-xl border bg-muted/10 p-4 shadow-sm">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">Item {index + 1}</p>
                          <p className="text-xs text-muted-foreground">Cód. lido {produto.codigo} · Item do PDF {produto.item}</p>
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="Remover item"
                          onClick={() => removeReviewProduct(index)}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="space-y-1.5 xl:col-span-2">
                          <Label>Cliente</Label>
                          <SearchableSelect
                            value={cliente.id}
                            placeholder="Selecione o cliente"
                            searchPlaceholder="Digite nome ou código do cliente..."
                            options={clientes.map((item) => ({
                              value: item.id,
                              label: `${item.nomeFantasia} (${item.codigoInterno})`,
                              keywords: `${item.nomeFantasia} ${item.razaoSocial} ${item.codigoInterno}`,
                            }))}
                            onChange={(value) => updateReviewClient(index, value)}
                          />
                        </div>
                        <div className="space-y-1.5 xl:col-span-2">
                          <Label>Produto</Label>
                          <SearchableSelect
                            value={cadastro.id}
                            placeholder="Selecione o produto"
                            searchPlaceholder="Digite nome ou código do produto..."
                            options={produtos.map((item) => ({
                              value: item.id,
                              label: `${item.nome} (${item.codigoInterno})`,
                              keywords: `${item.nome} ${item.codigoInterno}`,
                            }))}
                            onChange={(value) => updateReviewCadastro(index, value)}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label>Romaneio</Label>
                          <Input value={produto.romaneio} onChange={(event) => updateReviewProduct(index, { romaneio: event.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>NF</Label>
                          <Input value={produto.notaFiscal} onChange={(event) => updateReviewProduct(index, { notaFiscal: event.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Série</Label>
                          <Input value={produto.serie} onChange={(event) => updateReviewProduct(index, { serie: event.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Cobrança</Label>
                          <SearchableSelect
                            value={produto.tipoManifesto}
                            placeholder="Selecione a cobrança"
                            searchPlaceholder="Digite para procurar..."
                            options={tipos.map((tipo) => ({ value: tipo, label: tipo, keywords: tipo }))}
                            onChange={(value) => updateReviewProduct(index, {
                              tipoManifesto: value as TipoManifesto,
                              instrucaoCobranca: value,
                            })}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label>Quantidade</Label>
                          <Input
                            inputMode="decimal"
                            value={String(produto.quantidade).replace(".", ",")}
                            onChange={(event) => {
                              const quantidade = reviewNumericValue(event.target.value);
                              updateReviewProduct(index, {
                                quantidade,
                                valorTotal: ehVasilhame ? 0 : quantidade * valorUnitario,
                              });
                            }}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Valor unitário</Label>
                          <Input
                            inputMode="decimal"
                            disabled={ehVasilhame}
                            value={String(valorUnitario).replace(".", ",")}
                            onChange={(event) => {
                              const unitario = reviewNumericValue(event.target.value);
                              updateReviewProduct(index, {
                                valorUnitario: unitario,
                                valorTotal: produto.quantidade * unitario,
                              });
                            }}
                          />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                          <Label>Total calculado</Label>
                          <div className="flex h-10 items-center rounded-md border bg-muted/30 px-3 font-bold tabular-nums">
                            {formatBRL(valorTotal)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {!review.result.sugestoes.produtos.length && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  Todos os itens foram removidos. Mantenha pelo menos um item para cadastrar o romaneio.
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setReview(null)}>Cancelar</Button>
                <Button disabled={saving || !review.result.sugestoes.produtos.length} onClick={() => void confirmImport()}>
                  {saving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {saving ? "Cadastrando..." : "Cadastrar romaneio"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={manualOpen} onOpenChange={(open) => !open && setManualOpen(false)}>
        <DialogContent className="max-h-[94vh] max-w-5xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Romaneio" : "Novo Romaneio"}</DialogTitle></DialogHeader>
          {!editing && (
            <div
              className={`flex flex-col gap-3 rounded-xl border-2 border-dashed p-4 transition-colors sm:flex-row sm:items-center sm:justify-between ${pdfDragActive ? "border-primary bg-primary/10" : "border-primary/30 bg-primary/5"}`}
              onDragEnter={(event) => {
                event.preventDefault();
                if (!importing && !bulkImporting) setPdfDragActive(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
                if (!importing && !bulkImporting) setPdfDragActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                if (event.currentTarget === event.target) setPdfDragActive(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setPdfDragActive(false);
                if (importing || bulkImporting) return;

                const file = Array.from(event.dataTransfer.files).find(
                  (item) => item.type === "application/pdf" || item.name.toLowerCase().endsWith(".pdf"),
                );

                if (!file) {
                  toast.error("Solte um arquivo PDF válido.");
                  return;
                }

                void handleImport(file);
              }}
            >
              <div>
                <p className="font-semibold">Preencher pelo PDF do romaneio</p>
                <p className="text-sm text-muted-foreground">
                  {importing
                    ? importProgress || "Lendo PDF..."
                    : pdfDragActive
                      ? "Solte o PDF aqui para importar."
                      : "Arraste e solte o PDF aqui ou clique em Importar PDF. Clientes, produtos, notas fiscais, valores e cobranças serão identificados automaticamente."}
                </p>
              </div>
              <Button type="button" variant="outline" className="shrink-0" disabled={importing || bulkImporting} onClick={() => importInputRef.current?.click()}>
                {importing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {importing ? "Processando..." : "Importar PDF"}
              </Button>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1"><Label>Data *</Label><Input type="date" value={manual.data} onChange={(e) => setManual((c) => ({ ...c, data: e.target.value }))} /></div>
            <div className="space-y-1">
              <Label>Placa</Label>
              <SearchableSelect
                value={veiculos.find((item) => item.placa === manual.placa)?.id ?? ""}
                onChange={(value) => {
                  const veiculo = veiculos.find((item) => item.id === value);
                  if (!veiculo) return;
                  setManual((current) => ({
                    ...current,
                    placa: formatPlate(veiculo.placa),
                    modelo: veiculo.modelo ?? "",
                  }));
                }}
                options={veiculos.map((veiculo) => ({
                  value: veiculo.id,
                  label: `${formatPlate(veiculo.placa)}${veiculo.modelo ? ` - ${veiculo.modelo}` : ""}`,
                  keywords: `${veiculo.placa} ${formatPlate(veiculo.placa)} ${veiculo.modelo ?? ""}`,
                }))}
                placeholder={manual.placa || "Selecione a placa"}
                searchPlaceholder="Digite a placa ou modelo..."
                emptyText="Nenhum veículo cadastrado encontrado."
              />
            </div>
            <div className="space-y-1"><Label>Modelo</Label><Input value={manual.modelo} readOnly className="bg-muted/30" /></div>
            <div className="space-y-1"><Label>Cód. transportadora</Label><Input value={manual.transportadoraCodigo} onChange={(e) => setManual((c) => ({ ...c, transportadoraCodigo: e.target.value }))} /></div>
            <div className="space-y-1 sm:col-span-2"><Label>Transportadora</Label><Input value={manual.transportadoraNome} onChange={(e) => setManual((c) => ({ ...c, transportadoraNome: e.target.value }))} /></div>
          </div>
          <div className="mt-4 space-y-3 border-t pt-4">
            <div>
              <h3 className="font-semibold">Adicionar produtos por cliente</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Um mesmo cliente pode receber quantos produtos forem necessários. Depois de adicionar um produto, o cliente, romaneio, NF, série e cobrança permanecem selecionados para o próximo item.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label>Cliente *</Label>
                <SearchableSelect
                  value={draft.clienteId}
                  onChange={(clienteId) => setDraft((c) => ({ ...c, clienteId }))}
                  options={clientes.map((item) => ({
                    value: item.id,
                    label: `${item.nomeFantasia} - ${item.codigoInterno}`,
                    keywords: `${item.nomeFantasia} ${item.codigoInterno}`,
                  }))}
                  searchPlaceholder="Digite o nome ou código do cliente..."
                  emptyText="Nenhum cliente encontrado."
                />
              </div>
              <div className="space-y-1">
                <Label>Produto *</Label>
                <SearchableSelect
                  value={draft.produtoId}
                  onChange={(produtoId) => setDraft((c) => ({ ...c, produtoId }))}
                  options={produtos.map((item) => ({
                    value: item.id,
                    label: `${item.nome} - ${item.codigoInterno}`,
                    keywords: `${item.nome} ${item.codigoInterno}`,
                  }))}
                  searchPlaceholder="Digite o nome ou código do produto..."
                  emptyText="Nenhum produto encontrado."
                />
              </div>
              <div className="space-y-1"><Label>Romaneio</Label><Input value={draft.romaneio} onChange={(e) => setDraft((c) => ({ ...c, romaneio: e.target.value }))} /></div>
              <div className="space-y-1"><Label>NF</Label><Input value={draft.notaFiscal} onChange={(e) => setDraft((c) => ({ ...c, notaFiscal: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Série</Label><Input value={draft.serieNf} onChange={(e) => setDraft((c) => ({ ...c, serieNf: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Quantidade *</Label><Input inputMode="decimal" value={draft.quantidade} onChange={(e) => setDraft((c) => ({ ...c, quantidade: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Valor unitÃ¡rio *</Label><Input inputMode="decimal" value={draft.valorUnitario} onChange={(e) => setDraft((c) => ({ ...c, valorUnitario: e.target.value }))} /></div>
              <div className="space-y-1">
                <Label>Cobrança *</Label>
                <SearchableSelect
                  value={draft.tipoManifesto}
                  onChange={(tipoManifesto) =>
                    setDraft((c) => ({ ...c, tipoManifesto: tipoManifesto as TipoManifesto }))
                  }
                  options={tipos.map((tipo) => ({ value: tipo, label: tipo }))}
                  searchPlaceholder="Digite para procurar a cobrança..."
                  emptyText="Nenhuma cobrança encontrada."
                />
              </div>
            </div>
            <Button type="button" variant="outline" onClick={addDraft}><Plus className="mr-2 h-4 w-4" />{draft.clienteId ? "Adicionar outro produto para este cliente" : "Adicionar produto"}</Button>
          </div>
          <div className="mt-4 space-y-2">
            {manual.itens.map((item, index) => (
              <div key={index} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
                <div><p className="font-medium">{clienteById(item.clienteId)?.nomeFantasia} - {produtoById(item.produtoId)?.nome}</p><p className="text-xs text-muted-foreground">Romaneio {item.romaneio || "—"} · NF {item.notaFiscal || "—"}/{item.serieNf || "—"} · {item.quantidade.toLocaleString("pt-BR")} × {formatBRL(item.valorUnitario)} = {formatBRL(item.valorTotal)}</p></div>
                <div className="flex items-center gap-2"><TypeBadge type={item.tipoManifesto} /><Button size="icon" variant="ghost" onClick={() => setManual((c) => ({ ...c, itens: c.itens.filter((_, i) => i !== index) }))}><X className="h-4 w-4 text-destructive" /></Button></div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setManualOpen(false)}>Cancelar</Button><Button disabled={saving} onClick={() => void saveManual()}>{saving && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}{editing ? "Salvar alterações" : "Cadastrar"}</Button></div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

