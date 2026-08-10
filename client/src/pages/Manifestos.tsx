import { useState, useEffect, useCallback, useMemo, useRef, ReactNode } from "react";
import Layout from "@/components/Layout";
import { useManifestos, useClientes, useProdutos, type Manifesto, type ManifestoProduto, type TipoManifesto, type Produto } from "@/lib/store";
import { formatBRL, formatDate } from "@/lib/exportUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DatePicker } from "@/components/ui/date-picker";
import { Plus, Trash2, Edit3, Eye, FileText, Package, Building2, Calculator, Download, Upload, X, ChevronDown, Check, ChevronsUpDown, AlertTriangle, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { extrairTextoPdf } from "@/lib/pdfText";


interface ManifestoPdfProdutoImportado {
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
}

interface ManifestoPdfResponse {
  documento: {
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
  };
  sugestoes: {
    cliente: { id: string } | null;
    produtos: Array<{
      produto: ManifestoPdfProdutoImportado;
      cadastro: { id: string; nome: string; codigoInterno: string } | null;
    }>;
  };
  pendencias: string[];
}

interface ProdutoPendentePdf extends ManifestoPdfProdutoImportado {
  produtoId: string;
}

interface FormField {
  label: string;
  children: ReactNode;
}

function FormField({ label, children }: FormField) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}

/**
 * Returns the calendar date shown to the user as YYYY-MM-DD.
 * Manifestos store createdAt as an ISO timestamp (UTC), so using slice(0, 10)
 * can produce a different day from the one displayed in the browser timezone.
 */
function getLocalDateKey(value: string): string {
  if (!value) return "";

  // Date-only values are already calendar dates and must not be shifted by UTC.
  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) return `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}`;

  // Supports legacy Brazilian values that may already exist in localStorage.
  const brDateMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brDateMatch) return `${brDateMatch[3]}-${brDateMatch[2]}-${brDateMatch[1]}`;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayDateKey(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={highlight ? "font-bold text-emerald-600 dark:text-emerald-400" : "font-medium"}>
        {value}
      </span>
    </div>
  );
}

export default function Manifestos() {
  const { items: manifestos, create, update, remove } = useManifestos();
  const { items: clientes } = useClientes();
  const { items: produtos } = useProdutos();

  const [formOpen, setFormOpen] = useState(false);
  const [editingManifesto, setEditingManifesto] = useState<Manifesto | null>(null);
  const [viewingManifesto, setViewingManifesto] = useState<Manifesto | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ url: string; title: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Manifesto | null>(null);

  // Form state
  const [clienteId, setClienteId] = useState("");
  const [dataManifesto, setDataManifesto] = useState("");
  const [produtosForm, setProdutosForm] = useState<ManifestoProduto[]>([]);
  const [tipoManifesto, setTipoManifesto] = useState<TipoManifesto>("Bonificação - Lebrinha");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [existingPdfUrl, setExistingPdfUrl] = useState<string | null>(null);
  const [clienteSelectOpen, setClienteSelectOpen] = useState(false);
  const [importandoPdf, setImportandoPdf] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendenciasPdf, setPendenciasPdf] = useState<string[]>([]);
  const [produtosPendentesPdf, setProdutosPendentesPdf] = useState<ProdutoPendentePdf[]>([]);
  const importPdfInputRef = useRef<HTMLInputElement>(null);
  const [transportadoraCodigo, setTransportadoraCodigo] = useState("");
  const [transportadoraNome, setTransportadoraNome] = useState("");
  const [veiculoCodigo, setVeiculoCodigo] = useState("");
  const [placaVeiculo, setPlacaVeiculo] = useState("");
  const [modeloVeiculo, setModeloVeiculo] = useState("");
  const [romaneios, setRomaneios] = useState("");
  const [notasFiscais, setNotasFiscais] = useState("");

  // Current product being added
  const [currentProdutoId, setCurrentProdutoId] = useState("");
  const [currentQuantidade, setCurrentQuantidade] = useState("");
  const [currentValorUnitario, setCurrentValorUnitario] = useState("");
  const [currentProdutoTipo, setCurrentProdutoTipo] = useState<TipoManifesto | "">("");
  const [dragActive, setDragActive] = useState(false);

  // Filter state
  const [filters, setFilters] = useState<{
    cliente: string;
    produtos: string;
    valorTotal: string;
    tipo: string;
    data: string;
  }>({
    cliente: "",
    produtos: "",
    valorTotal: "",
    tipo: "",
    data: "",
  });
  const [activeFilterMenu, setActiveFilterMenu] = useState<string | null>(null);

  const handleOpenCreate = () => {
    setClienteId("");
    setDataManifesto("");
    setProdutosForm([]);
    setTipoManifesto("Bonificação - Lebrinha");
    setPdfFile(null);
    setExistingPdfUrl(null);
    setCurrentProdutoId("");
    setCurrentQuantidade("");
    setCurrentValorUnitario("");
    setCurrentProdutoTipo("");
    setEditingManifesto(null);
    setClienteSelectOpen(false);
    setPendenciasPdf([]);
    setProdutosPendentesPdf([]);
    setTransportadoraCodigo("");
    setTransportadoraNome("");
    setVeiculoCodigo("");
    setPlacaVeiculo("");
    setModeloVeiculo("");
    setRomaneios("");
    setNotasFiscais("");
    setFormOpen(true);
  };

  const handleOpenEdit = (manifesto: Manifesto) => {
    setClienteId(manifesto.clienteId);
    setDataManifesto(getLocalDateKey(manifesto.dataManifesto || manifesto.createdAt));
    setProdutosForm(manifesto.produtos);
    setTipoManifesto(manifesto.tipoManifesto);
    setPdfFile(null);
    setExistingPdfUrl(manifesto.pdfUrl ?? null);
    setCurrentProdutoId("");
    setCurrentQuantidade("");
    setCurrentValorUnitario("");
    setCurrentProdutoTipo("");
    setEditingManifesto(manifesto);
    setClienteSelectOpen(false);
    setPendenciasPdf([]);
    setProdutosPendentesPdf([]);
    setTransportadoraCodigo(manifesto.transportadoraCodigo ?? "");
    setTransportadoraNome(manifesto.transportadoraNome ?? "");
    setVeiculoCodigo(manifesto.veiculoCodigo ?? "");
    setPlacaVeiculo(manifesto.placaVeiculo ?? "");
    setModeloVeiculo(manifesto.modeloVeiculo ?? "");
    setRomaneios(manifesto.romaneios ?? "");
    setNotasFiscais(manifesto.notasFiscais ?? "");
    setFormOpen(true);
  };

  const manifestoMetadata = () => ({
    transportadoraCodigo,
    transportadoraNome,
    veiculoCodigo,
    placaVeiculo,
    modeloVeiculo,
    romaneios,
    notasFiscais,
  });

  const handleImportPdf = async (file?: File) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Selecione um arquivo PDF válido.");
      return;
    }

    setImportandoPdf(true);
    try {
      const texto = await extrairTextoPdf(file);
      const response = await api.post<ManifestoPdfResponse>(
        "/manifestos/interpretar-texto-pdf",
        { texto },
        { timeout: 120_000 },
      );

      const { documento, sugestoes, pendencias } = response.data;
      setPdfFile(file);
      setEditingManifesto(null);
      setExistingPdfUrl(null);
      setClienteId(sugestoes.cliente?.id ?? "");
      setDataManifesto(documento.dataEmissao ?? "");
      setTransportadoraCodigo(documento.transportadoraCodigo ?? "");
      setTransportadoraNome(documento.transportadoraNome ?? "");
      setVeiculoCodigo(documento.veiculoCodigo ?? "");
      setPlacaVeiculo(documento.placaVeiculo ?? "");
      setModeloVeiculo(documento.modeloVeiculo ?? "");
      setRomaneios(documento.romaneios.join(", "));
      setNotasFiscais(documento.notasFiscais.join(", "));

      const associados: ManifestoProduto[] = [];
      const naoAssociados: ProdutoPendentePdf[] = [];
      sugestoes.produtos.forEach(({ produto, cadastro }) => {
        if (cadastro) {
          associados.push({
            produtoId: cadastro.id,
            quantidade: produto.quantidade,
            valorUnitario: produto.valorUnitario,
            valorTotal: produto.valorTotal,
            tipoManifesto: produto.tipoManifesto,
          });
        } else {
          naoAssociados.push({ ...produto, produtoId: "" });
        }
      });

      setProdutosForm(associados);
      setProdutosPendentesPdf(naoAssociados);
      const tipos = associados.map((produto) => produto.tipoManifesto).filter(Boolean) as TipoManifesto[];
      setTipoManifesto(tipos[0] ?? "Bonificação - Lebrinha");
      setPendenciasPdf(Array.from(new Set([...pendencias, ...documento.avisos])));
      setFormOpen(true);

      if (pendencias.length || naoAssociados.length) {
        toast.warning("PDF lido. Revise e preencha os campos pendentes antes de salvar.");
      } else {
        toast.success("PDF lido e manifesto preenchido automaticamente.");
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message ?? error?.message ?? "Não foi possível interpretar o PDF.");
    } finally {
      setImportandoPdf(false);
      if (importPdfInputRef.current) importPdfInputRef.current.value = "";
    }
  };

  const resolverProdutoPendente = (index: number) => {
    const pendente = produtosPendentesPdf[index];
    if (!pendente?.produtoId) {
      toast.error("Selecione o produto correspondente.");
      return;
    }
    setProdutosForm((atuais) => [
      ...atuais,
      {
        produtoId: pendente.produtoId,
        quantidade: pendente.quantidade,
        valorUnitario: pendente.valorUnitario,
        valorTotal: pendente.valorTotal,
        tipoManifesto: pendente.tipoManifesto,
      },
    ]);
    setProdutosPendentesPdf((atuais) => atuais.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleAddProduct = () => {
    if (!currentProdutoId) {
      toast.error("Selecione o produto.");
      return;
    }
    if (!currentQuantidade || parseFloat(currentQuantidade) <= 0) {
      toast.error("Informe a quantidade válida.");
      return;
    }
    if (!currentValorUnitario || parseFloat(currentValorUnitario) < 0) {
      toast.error("Informe o valor unitário válido.");
      return;
    }

    const q = parseFloat(currentQuantidade);
    const v = parseFloat(currentValorUnitario);
    const valorTotal = q * v;

    const newProduto: ManifestoProduto = {
      produtoId: currentProdutoId,
      quantidade: q,
      valorUnitario: v,
      valorTotal,
      tipoManifesto: (currentProdutoTipo || undefined) as TipoManifesto | undefined,
    };

    setProdutosForm([...produtosForm, newProduto]);
    setCurrentProdutoId("");
    setCurrentQuantidade("");
    setCurrentValorUnitario("");
    toast.success("Produto adicionado!");
  };

  const handleRemoveProduct = (index: number) => {
    setProdutosForm(produtosForm.filter((_, i) => i !== index));
  };

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
      toast.success("PDF selecionado!");
    } else {
      toast.error("Selecione um arquivo PDF válido.");
    }
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
      toast.success("PDF selecionado!");
    } else {
      toast.error("Selecione um arquivo PDF válido.");
    }
  };

  const handleRemovePdf = () => {
    setPdfFile(null);
    setExistingPdfUrl(null);
    toast.success("PDF removido!");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (!clienteId) {
      toast.error("Selecione o cliente.");
      return;
    }
    if (!dataManifesto) {
      toast.error("Selecione a data do manifesto.");
      return;
    }
    if (produtosPendentesPdf.length > 0) {
      toast.error("Associe todos os produtos pendentes do PDF.");
      return;
    }
    if (produtosForm.length === 0) {
      toast.error("Adicione pelo menos um produto.");
      return;
    }

    setSaving(true);
    try {
      const pdfUrl = pdfFile
        ? await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error ?? new Error("Não foi possível ler o PDF."));
            reader.readAsDataURL(pdfFile);
          })
        : existingPdfUrl ?? undefined;

      if (editingManifesto) {
        await update(
          editingManifesto.id,
          clienteId,
          dataManifesto,
          produtosForm,
          tipoManifesto,
          pdfUrl,
          manifestoMetadata(),
        );
        toast.success("Manifesto atualizado com sucesso!");
      } else {
        await create(clienteId, dataManifesto, produtosForm, tipoManifesto, pdfUrl, manifestoMetadata());
        toast.success("Manifesto cadastrado com sucesso!");
      }
      setFormOpen(false);
    } catch (error: any) {
      console.error("Falha ao salvar manifesto.", error);
      toast.error(error?.response?.data?.message ?? "Não foi possível salvar o manifesto.");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (deleteTarget && !deleting) {
      const id = deleteTarget.id;
      setDeleting(true);
      try {
        await remove(id);
      toast.success("Manifesto excluído com sucesso!");
      setDeleteTarget(null);
      } catch (error: any) {
        console.error("Falha ao excluir manifesto.", error);
        toast.error(error?.response?.data?.message ?? "Não foi possível excluir o manifesto.");
      } finally {
        setDeleting(false);
      }
    }
  };

  const totalManifesto = useMemo(() => {
    return produtosForm.reduce((sum, p) => sum + p.valorTotal, 0);
  }, [produtosForm]);

  const columns: { key: string; label: string; render?: (item: Manifesto) => ReactNode }[] = [
    {
      key: "cliente",
      label: "Cliente",
      render: (item: Manifesto) => {
        const cliente = clientes.find((c) => c.id === item.clienteId);
        return (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <span className="font-medium">{cliente?.nomeFantasia || "—"}</span>
              {cliente?.codigoInterno && (
                <p className="text-xs text-muted-foreground">Cód: {cliente.codigoInterno}</p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "produtos",
      label: "Produtos",
      render: (item: Manifesto) => (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400">
            <Package className="h-4 w-4" />
          </div>
          <span className="font-medium">{(item.produtos ?? []).length} produto(s)</span>
        </div>
      ),
    },
    {
      key: "valorTotal",
      label: "Valor Total",
      render: (item: Manifesto) => {
        const total = (item.produtos ?? []).reduce((sum, p) => sum + p.valorTotal, 0);
        return (
          <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatBRL(total)}</span>
        );
      },
    },
    {
      key: "tipoManifesto",
      label: "Tipo",
      render: (item: Manifesto) => {
        const colors: Record<TipoManifesto, string> = {
          "Bonificação - Lebrinha": "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300",
          "Acertar c/ Lebrinha": "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
          "Receber c/ Cliente": "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
        };
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[item.tipoManifesto]}`}>
            {item.tipoManifesto}
          </span>
        );
      },
    },
    {
      key: "createdAt",
      label: "Data",
      render: (item: Manifesto) => (
        <span className="text-muted-foreground">{formatDate(item.dataManifesto || item.createdAt)}</span>
      ),
    },
  ];

  return (
    <Layout>
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-foreground">
            Manifestos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie os manifestos de frete da operação.
          </p>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {manifestos.length} manifesto(s) cadastrado(s)
          </p>
          <div className="flex items-center gap-2">
            <input
              ref={importPdfInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(event) => void handleImportPdf(event.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={importandoPdf}
              onClick={() => importPdfInputRef.current?.click()}
            >
              {importandoPdf ? (
                <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-4 w-4" />
              )}
              Importar PDF
            </Button>
            <Button onClick={handleOpenCreate} size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              Novo Manifesto
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {columns.map((col) => {
                    const hasFilter = ["cliente", "produtos", "valorTotal", "tipoManifesto", "createdAt"].includes(col.key);
                    const filterKey = col.key === "tipoManifesto" ? "tipo" : col.key === "createdAt" ? "data" : col.key;
                    return (
                      <th
                        key={col.key}
                        className="px-4 py-3 text-left font-semibold text-muted-foreground relative"
                      >
                        <div className="flex items-center gap-2">
                          <span>{col.label}</span>
                          {hasFilter && (
                            col.key === "cliente" ? (
                              // Cliente filter uses Popover — renders in a portal above everything
                              <Popover open={activeFilterMenu === "cliente"} onOpenChange={(open) => setActiveFilterMenu(open ? "cliente" : null)}>
                                <PopoverTrigger asChild>
                                  <button
                                    className="flex h-5 w-5 items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                    title="Filtrar por Cliente"
                                  >
                                    <ChevronDown className="h-4 w-4" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent align="start" side="bottom" className="w-[380px] p-0" sideOffset={4}>
                                  <div className="p-3 pb-2">
                                    <p className="text-xs text-muted-foreground mb-1.5 font-medium">
                                      Filtrar clientes
                                    </p>
                                    <Input
                                      type="text"
                                      placeholder="Buscar por nome ou código..."
                                      value={filters.cliente}
                                      onChange={(e) =>
                                        setFilters({ ...filters, cliente: e.target.value })
                                      }
                                      className="text-sm"
                                      autoFocus
                                    />
                                  </div>
                                  <ScrollArea className="max-h-[260px] px-3 pb-3">
                                    {clientes.length === 0 ? (
                                      <p className="py-4 text-center text-xs text-muted-foreground">
                                        Nenhum cliente cadastrado
                                      </p>
                                    ) : clientes.filter((c) => {
                                      const q = filters.cliente.toLowerCase();
                                      if (!q) return true;
                                      return (
                                        c.nomeFantasia?.toLowerCase().includes(q) ||
                                        c.codigoInterno?.toLowerCase().includes(q) ||
                                        c.email?.toLowerCase().includes(q)
                                      );
                                    }).length === 0 ? (
                                      <p className="py-4 text-center text-xs text-muted-foreground">
                                        Nenhum resultado encontrado
                                      </p>
                                    ) : (
                                      clientes
                                        .filter((c) => {
                                          const q = filters.cliente.toLowerCase();
                                          if (!q) return true;
                                          return (
                                            c.nomeFantasia?.toLowerCase().includes(q) ||
                                            c.codigoInterno?.toLowerCase().includes(q) ||
                                            c.email?.toLowerCase().includes(q)
                                          );
                                        })
                                        .map((c) => {
                                          const usageCount = manifestos.filter(
                                            (m) => m.clienteId === c.id
                                          ).length;

                                          return (
                                            <button
                                              key={c.id}
                                              type="button"
                                              onClick={() => {
                                                setFilters({ ...filters, cliente: c.nomeFantasia || "" });
                                                setActiveFilterMenu(null);
                                              }}
                                              className={`w-full text-left px-2.5 py-2 rounded-md text-sm flex items-center justify-between gap-2 transition-colors ${
                                                filters.cliente && (c.nomeFantasia === filters.cliente || c.codigoInterno === filters.cliente)
                                                  ? "bg-primary/10 text-primary font-medium"
                                                  : "hover:bg-muted"
                                              }`}
                                            >
                                              <div className="min-w-0">
                                                <p className="font-medium truncate">
                                                  {c.nomeFantasia || "Sem nome"}
                                                </p>
                                                <p className="text-xs text-muted-foreground truncate">
                                                  Cód: {c.codigoInterno || "—"}
                                                </p>
                                              </div>
                                              {usageCount > 0 && (
                                                <span className="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted/80 text-muted-foreground">
                                                  {usageCount} manifesto{usageCount > 1 ? "s" : ""}
                                                </span>
                                              )}
                                            </button>
                                          );
                                        })
                                    )}
                                  </ScrollArea>
                                  <div className="px-3 pb-3 flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setFilters({ ...filters, cliente: "" });
                                      }}
                                      className="flex-1"
                                    >
                                      Limpar
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => setActiveFilterMenu(null)}
                                      className="flex-1"
                                    >
                                      OK
                                    </Button>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            ) : (
                              // Other filters use Popover — renders in portal above everything
                              <Popover open={activeFilterMenu === filterKey} onOpenChange={(open) => setActiveFilterMenu(open ? filterKey : null)}>
                                <PopoverTrigger asChild>
                                  <button
                                    className="flex h-5 w-5 items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                    title={`Filtrar por ${col.label}`}
                                  >
                                    <ChevronDown className="h-4 w-4" />
                                  </button>
                                </PopoverTrigger>
                                {col.key === "createdAt" ? (
                                  // Data — calendar date picker
                                  <PopoverContent align="start" side="bottom" className="w-auto p-0" sideOffset={4}>
                                    <div className="p-3 pb-2">
                                      <p className="text-xs text-muted-foreground mb-1.5 font-medium">
                                        Escolher data do manifesto
                                      </p>
                                      <DatePicker
                                        value={filters.data}
                                        onChange={(v) => setFilters({ ...filters, data: v })}
                                        placeholder="Selecione uma data"
                                      />
                                    </div>
                                    <div className="px-3 pb-3 flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setFilters({ ...filters, data: "" })}
                                        className="flex-1"
                                      >
                                        Limpar
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() => setActiveFilterMenu(null)}
                                        className="flex-1"
                                      >
                                        OK
                                      </Button>
                                    </div>
                                  </PopoverContent>
                                ) : col.key === "valorTotal" ? (
                                  // Valor Total — free-text filter in Popover
                                  <PopoverContent align="start" side="bottom" className="w-[320px] p-0" sideOffset={4}>
                                    <div className="p-3 pb-2">
                                      <p className="text-xs text-muted-foreground mb-1.5 font-medium">
                                        Filtrar por valor total
                                      </p>
                                      <Input
                                        type="text"
                                        placeholder="Ex: 1.000,00"
                                        value={filters.valorTotal}
                                        onChange={(e) => setFilters({ ...filters, valorTotal: e.target.value })}
                                        className="text-sm"
                                        autoFocus
                                      />
                                    </div>
                                    <div className="px-3 pb-3 flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setFilters({ ...filters, valorTotal: "" })}
                                        className="flex-1"
                                      >
                                        Limpar
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() => setActiveFilterMenu(null)}
                                        className="flex-1"
                                      >
                                        OK
                                      </Button>
                                    </div>
                                  </PopoverContent>
                                ) : (
                                  // Produtos and Tipo — list of selectable items in Popover
                                  <PopoverContent align="start" side="bottom" className="w-[380px] p-0" sideOffset={4}>
                                    <div className="p-3 pb-2">
                                      <p className="text-xs text-muted-foreground mb-1.5 font-medium">
                                        {col.key === "tipoManifesto" ? "Tipos de manifesto" : "Produtos"}
                                      </p>
                                      <Input
                                        type="text"
                                        placeholder={`Digite para pesquisar...`}
                                        value={filters[filterKey as keyof typeof filters]}
                                        onChange={(e) => setFilters({ ...filters, [filterKey]: e.target.value })}
                                        className="text-sm"
                                        autoFocus
                                      />
                                    </div>
                                    <ScrollArea className="max-h-[260px] px-3 pb-3">
                                      {(() => {
                                        // Build the items to display
                                        const items = col.key === "tipoManifesto"
                                          ? (["Bonificação - Lebrinha", "Acertar c/ Lebrinha", "Receber c/ Cliente"] as TipoManifesto[])
                                          : produtos;

                                        const filteredItems = items.filter((item) => {
                                          const q = filters[filterKey as keyof typeof filters].toLowerCase();
                                          if (!q) return true;
                                          return col.key === "tipoManifesto"
                                            ? (item as string).toLowerCase().includes(q)
                                            : (item as any).nome?.toLowerCase().includes(q);
                                        });

                                        if (filteredItems.length === 0) {
                                          return <p className="py-4 text-center text-xs text-muted-foreground">Nenhum resultado encontrado</p>;
                                        }

                                        return filteredItems.map((item: TipoManifesto | Produto, idx: number) => {
                                          const label: string = col.key === "tipoManifesto" ? (item as TipoManifesto) : ((item as Produto).nome ?? "");
                                          const isActive = filters[filterKey as keyof typeof filters] === label;

                                          return (
                                            <button
                                              key={idx}
                                              type="button"
                                              onClick={() => {
                                                setFilters({ ...filters, [filterKey]: isActive ? "" : label });
                                                setActiveFilterMenu(null);
                                              }}
                                              className={`w-full text-left px-2.5 py-2 rounded-md text-sm flex items-center gap-2 transition-colors ${
                                                isActive
                                                  ? "bg-primary/10 text-primary font-medium"
                                                  : "hover:bg-muted"
                                              }`}
                                            >
                                              <div className="min-w-0 truncate">
                                                {label}
                                              </div>
                                              {isActive && (
                                                <span className="shrink-0 text-xs font-medium">✓</span>
                                              )}
                                            </button>
                                          );
                                        });
                                      })()}
                                    </ScrollArea>
                                    <div className="px-3 pb-3 flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setFilters({ ...filters, [filterKey]: "" });
                                        }}
                                        className="flex-1"
                                      >
                                        Limpar
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() => setActiveFilterMenu(null)}
                                        className="flex-1"
                                      >
                                        OK
                                      </Button>
                                    </div>
                                  </PopoverContent>
                                )}
                              </Popover>
                            )
                          )}
                        </div>
                      </th>
                    );
                  })}
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {manifestos.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length + 1}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      Nenhum manifesto cadastrado. Clique em 'Novo Manifesto' para começar.
                    </td>
                  </tr>
                ) : (
                  manifestos
                    .filter((item) => {
                      // Filter by cliente
                      if (filters.cliente) {
                        const cliente = clientes.find((c) => c.id === item.clienteId);
                        if (!cliente?.nomeFantasia.toLowerCase().includes(filters.cliente.toLowerCase())) {
                          return false;
                        }
                      }
                      // Filter by produtos
                      if (filters.produtos) {
                        const hasMatch = (item.produtos ?? []).some((p) => {
                          const prod = produtos.find((pr) => pr.id === p.produtoId);
                          return prod?.nome.toLowerCase().includes(filters.produtos.toLowerCase());
                        });
                        if (!hasMatch) return false;
                      }
                      // Filter by valor total
                      if (filters.valorTotal) {
                        const total = (item.produtos ?? []).reduce((sum, p) => sum + p.valorTotal, 0);
                        const totalStr = formatBRL(total);
                        if (!totalStr.toLowerCase().includes(filters.valorTotal.toLowerCase())) {
                          return false;
                        }
                      }
                      // Filter by tipo
                      if (filters.tipo && !item.tipoManifesto.toLowerCase().includes(filters.tipo.toLowerCase())) {
                        return false;
                      }
                      // Filter by data
                      if (filters.data && getLocalDateKey(item.dataManifesto || item.createdAt) !== filters.data) {
                        return false;
                      }
                      return true;
                    })
                    .map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                    >
                      {columns.map((col) => (
                        <td key={col.key} className="px-4 py-3 text-card-foreground">
                          {col.render ? col.render(item) : String((item as any)[col.key] ?? "")}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setViewingManifesto(item)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 transition-colors hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-500/20"
                            title="Visualizar"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-amber-600 transition-colors hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-500/20"
                            title="Editar"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(item)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-red-600 transition-colors hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-500/20"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Form Dialog */}
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingManifesto ? "Editar Manifesto" : "Novo Manifesto"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {pendenciasPdf.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                  <div className="mb-1 flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    Conferência manual necessária
                  </div>
                  <p>{pendenciasPdf.join(" • ")}</p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Cliente *">
                  <Popover open={clienteSelectOpen} onOpenChange={setClienteSelectOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={clienteSelectOpen}
                        className="w-full justify-between font-normal"
                      >
                        <span className="truncate text-left">
                          {clienteId
                            ? (() => {
                                const clienteSelecionado = clientes.find((c) => c.id === clienteId);
                                if (!clienteSelecionado) return "Selecione o cliente";
                                return `${clienteSelecionado.nomeFantasia || "Sem nome"}${
                                  clienteSelecionado.codigoInterno
                                    ? ` (Cód: ${clienteSelecionado.codigoInterno})`
                                    : ""
                                }`;
                              })()
                            : "Selecione o cliente"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      className="w-[var(--radix-popover-trigger-width)] p-0"
                    >
                      <Command>
                        <CommandInput placeholder="Pesquisar por nome, código ou e-mail..." />
                        <CommandList>
                          <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                          <CommandGroup>
                            {clientes.map((c) => (
                              <CommandItem
                                key={c.id}
                                value={`${c.nomeFantasia || ""} ${c.codigoInterno || ""} ${c.email || ""}`}
                                onSelect={() => {
                                  setClienteId(c.id);
                                  setClienteSelectOpen(false);
                                }}
                              >
                                <Check
                                  className={`h-4 w-4 ${clienteId === c.id ? "opacity-100" : "opacity-0"}`}
                                />
                                <div className="min-w-0">
                                  <p className="truncate font-medium">{c.nomeFantasia || "Sem nome"}</p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    Cód: {c.codigoInterno || "—"}
                                    {c.email ? ` • ${c.email}` : ""}
                                  </p>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </FormField>

                <FormField label="Data do manifesto *">
                  <DatePicker
                    value={dataManifesto}
                    onChange={setDataManifesto}
                    placeholder="Selecione uma data"
                  />
                </FormField>
              </div>

              <div className="rounded-lg border bg-muted/20 p-4">
                <h3 className="mb-3 font-semibold">Dados extraídos do PDF</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField label="Código da transportadora">
                    <Input value={transportadoraCodigo} onChange={(e) => setTransportadoraCodigo(e.target.value)} />
                  </FormField>
                  <FormField label="Transportadora">
                    <Input value={transportadoraNome} onChange={(e) => setTransportadoraNome(e.target.value)} />
                  </FormField>
                  <FormField label="Código do veículo">
                    <Input value={veiculoCodigo} onChange={(e) => setVeiculoCodigo(e.target.value)} />
                  </FormField>
                  <FormField label="Placa do veículo">
                    <Input value={placaVeiculo} onChange={(e) => setPlacaVeiculo(e.target.value.toUpperCase())} />
                  </FormField>
                  <FormField label="Modelo do veículo">
                    <Input value={modeloVeiculo} onChange={(e) => setModeloVeiculo(e.target.value)} />
                  </FormField>
                  <FormField label="Romaneios">
                    <Input value={romaneios} onChange={(e) => setRomaneios(e.target.value)} />
                  </FormField>
                  <div className="sm:col-span-2">
                    <FormField label="Notas fiscais / séries">
                      <Input value={notasFiscais} onChange={(e) => setNotasFiscais(e.target.value)} />
                    </FormField>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Produtos</h3>

                {produtosPendentesPdf.length > 0 && (
                  <div className="mb-4 space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                      Produtos não associados automaticamente
                    </p>
                    {produtosPendentesPdf.map((pendente, index) => (
                      <div key={`${pendente.romaneio}-${pendente.item}-${index}`} className="rounded-md border bg-background p-3">
                        <p className="mb-2 text-sm font-medium">{pendente.codigo} - {pendente.descricao}</p>
                        <p className="mb-2 text-xs text-muted-foreground">
                          {pendente.quantidade} un × {formatBRL(pendente.valorUnitario)} = {formatBRL(pendente.valorTotal)}
                        </p>
                        <div className="flex gap-2">
                          <Select
                            value={pendente.produtoId}
                            onValueChange={(value) =>
                              setProdutosPendentesPdf((atuais) =>
                                atuais.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, produtoId: value } : item,
                                ),
                              )
                            }
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Selecione o produto cadastrado" />
                            </SelectTrigger>
                            <SelectContent>
                              {produtos.map((produto) => (
                                <SelectItem key={produto.id} value={produto.id}>
                                  {produto.nome} {produto.codigoInterno ? `(Cód: ${produto.codigoInterno})` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button type="button" variant="outline" onClick={() => resolverProdutoPendente(index)}>
                            Associar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Produto + Tipo na mesma linha */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <FormField label="Produto *">
                    <Select value={currentProdutoId} onValueChange={setCurrentProdutoId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {produtos.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            Nenhum produto cadastrado
                          </div>
                        ) : (
                          produtos.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nome} {p.codigoInterno ? `(Cód: ${p.codigoInterno})` : ""}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </FormField>

                  <FormField label="Tipo de manifesto">
                    <Select value={currentProdutoTipo || ""} onValueChange={(v) => setCurrentProdutoTipo(v as unknown as TipoManifesto | "")}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Bonificação - Lebrinha">Bonificação - Lebrinha</SelectItem>
                        <SelectItem value="Acertar c/ Lebrinha">Acertar c/ Lebrinha</SelectItem>
                        <SelectItem value="Receber c/ Cliente">Receber c/ Cliente</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <FormField label="Quantidade (un) *">
                    <Input
                      type="number"
                      min="1"
                      value={currentQuantidade}
                      onChange={(e) => setCurrentQuantidade(e.target.value)}
                      placeholder="0"
                    />
                  </FormField>
                  <FormField label="Valor Unitário *">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={currentValorUnitario}
                      onChange={(e) => setCurrentValorUnitario(e.target.value)}
                      placeholder="0,00"
                    />
                  </FormField>
                  <div className="flex items-end">
                    <Button type="button" onClick={handleAddProduct} size="sm" variant="outline" className="w-full">
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                </div>

                {produtosForm.length > 0 && (
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    {produtosForm.map((p, idx) => {
                      const prod = produtos.find((pr) => pr.id === p.produtoId);
                      // Badge individual por produto (fallback para o tipo do manifesto)
                      const produtoTipo = p.tipoManifesto ?? tipoManifesto;
                      const colors: Record<TipoManifesto, string> = {
                        "Bonificação - Lebrinha": "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300",
                        "Acertar c/ Lebrinha": "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
                        "Receber c/ Cliente": "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
                      };
                      return (
                        <div key={idx} className="flex justify-between items-center p-2 bg-background rounded border border-border">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{prod?.nome || "—"}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.quantidade} un × {formatBRL(p.valorUnitario)} = {formatBRL(p.valorTotal)}
                            </p>
                          </div>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ml-2 shrink-0 ${colors[produtoTipo]}`}>
                            {produtoTipo}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveProduct(idx)}
                            className="flex h-6 w-6 items-center justify-center rounded text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-500/20 ml-2 shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                    <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                      <span>Total:</span>
                      <span className="text-emerald-600 dark:text-emerald-400">{formatBRL(totalManifesto)}</span>
                    </div>
                  </div>
                )}
              </div>

              <FormField label="Anexar PDF">
                {pdfFile ? (
                  <div className="flex items-center justify-between p-4 rounded-lg border-2 border-green-200 bg-green-50 dark:border-green-500/30 dark:bg-green-500/10">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400">
                        <Upload className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-sm text-green-900 dark:text-green-100">{pdfFile.name}</p>
                        <p className="text-xs text-green-700 dark:text-green-300">{(pdfFile.size / 1024).toFixed(2)} KB</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemovePdf}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-500/20"
                      title="Remover PDF"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : existingPdfUrl ? (
                  <div className="flex items-center justify-between gap-3 p-4 rounded-lg border-2 border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-sm text-blue-900 dark:text-blue-100">
                          PDF vinculado ao manifesto
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          O arquivo será mantido ao salvar as alterações
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setPdfPreview({
                            url: existingPdfUrl,
                            title: `PDF do manifesto ${editingManifesto?.id ?? ""}`,
                          })
                        }
                        title="Visualizar PDF vinculado"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <label
                        className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                        title="Substituir PDF"
                      >
                        Substituir
                        <input
                          type="file"
                          accept=".pdf,application/pdf"
                          onChange={handlePdfChange}
                          className="sr-only"
                        />
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleRemovePdf}
                        className="text-red-600 hover:bg-red-100 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/20"
                        title="Remover PDF vinculado"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
                      dragActive
                        ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-500/10"
                        : "border-border bg-muted/50 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:border-blue-400 dark:hover:bg-blue-500/5"
                    }`}
                  >
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handlePdfChange}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-center font-medium text-sm text-foreground">
                      Clique aqui ou arraste para adicionar PDF
                    </p>
                    <p className="text-center text-xs text-muted-foreground mt-1">
                      Apenas arquivos PDF são aceitos
                    </p>
                  </div>
                )}
              </FormField>

              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving ? "Salvando..." : editingManifesto ? "Salvar alterações" : "Cadastrar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* View Dialog */}
        <Dialog open={!!viewingManifesto} onOpenChange={(open) => !open && setViewingManifesto(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Detalhes do Manifesto
              </DialogTitle>
            </DialogHeader>
            {viewingManifesto && (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                  <InfoRow
                    label="Cliente"
                    value={(() => {
                      const cliente = clientes.find((c) => c.id === viewingManifesto.clienteId);
                      if (!cliente) return "—";
                      return `${cliente.nomeFantasia || "—"}${cliente.codigoInterno ? ` - ${cliente.codigoInterno}` : ""}`;
                    })()}
                  />
                  {(viewingManifesto.transportadoraNome || viewingManifesto.placaVeiculo || viewingManifesto.romaneios) && (
                    <>
                      <InfoRow label="Transportadora" value={`${viewingManifesto.transportadoraCodigo ?? ""}${viewingManifesto.transportadoraCodigo && viewingManifesto.transportadoraNome ? " - " : ""}${viewingManifesto.transportadoraNome ?? "—"}`} />
                      <InfoRow label="Veículo" value={`${viewingManifesto.placaVeiculo ?? ""}${viewingManifesto.modeloVeiculo ? ` - ${viewingManifesto.modeloVeiculo}` : ""}` || "—"} />
                      <InfoRow label="Romaneios" value={viewingManifesto.romaneios || "—"} />
                      <InfoRow label="Notas fiscais" value={viewingManifesto.notasFiscais || "—"} />
                    </>
                  )}
                  
                  <div className="border-t border-border pt-3 mt-3">
                    <p className="font-semibold text-sm mb-2">Produtos ({(viewingManifesto.produtos ?? []).length})</p>
                    <div className="space-y-2">
                      {(viewingManifesto.produtos ?? []).map((p, idx) => {
                        const prod = produtos.find((pr) => pr.id === p.produtoId);
                        // Badge individual por produto (fallback para o tipo do manifesto)
                        const produtoTipo = p.tipoManifesto ?? viewingManifesto.tipoManifesto;
                        const colors: Record<TipoManifesto, string> = {
                          "Bonificação - Lebrinha": "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300",
                          "Acertar c/ Lebrinha": "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
                          "Receber c/ Cliente": "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
                        };
                        return (
                          <div key={idx} className="text-sm bg-background p-2 rounded border border-border">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium">
                                {prod
                                  ? `${prod.nome || "—"}${prod.codigoInterno ? ` - ${prod.codigoInterno}` : ""}`
                                  : "—"}
                              </p>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${colors[produtoTipo]}`}>
                                {produtoTipo}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {p.quantidade} un × {formatBRL(p.valorUnitario)} = {formatBRL(p.valorTotal)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border-t border-border pt-3 mt-3">
                    <InfoRow
                      label="Valor Total"
                      value={formatBRL((viewingManifesto.produtos ?? []).reduce((sum, p) => sum + p.valorTotal, 0))}
                      highlight
                    />
                  </div>

                  <div className="border-t border-border pt-3 mt-3">
                    <InfoRow
                      label="Data do manifesto"
                      value={formatDate(viewingManifesto.dataManifesto || viewingManifesto.createdAt)}
                    />
                  </div>

                  {viewingManifesto.pdfUrl && (
                    <div className="border-t border-border pt-3 mt-3">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            const link = document.createElement("a");
                            link.href = viewingManifesto.pdfUrl!;
                            link.download = `manifesto_${viewingManifesto.id}.pdf`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                          className="flex-1"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Baixar PDF
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setPdfPreview({
                              url: viewingManifesto.pdfUrl!,
                              title: `PDF do manifesto ${viewingManifesto.id}`,
                            });
                          }}
                          className="flex-1"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Visualizar PDF
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* PDF Preview */}
        <Dialog
          open={!!pdfPreview}
          onOpenChange={(open) => !open && setPdfPreview(null)}
        >
          <DialogContent className="h-[95vh] w-[95vw] max-w-[95vw] p-0 overflow-hidden flex flex-col sm:max-w-[95vw]">
            <DialogHeader className="px-5 py-4 border-b border-border shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {pdfPreview?.title ?? "Visualizar PDF"}
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 min-h-0 bg-muted/30">
              {pdfPreview && (
                <object
                  data={pdfPreview.url}
                  type="application/pdf"
                  className="w-full h-full"
                  aria-label={pdfPreview.title}
                >
                  <div className="h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Não foi possível exibir o PDF neste navegador.</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Você ainda pode baixar o arquivo para visualizá-lo.
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = pdfPreview.url;
                        link.download = `${pdfPreview.title.replace(/[^a-z0-9_-]+/gi, "_")}.pdf`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Baixar PDF
                    </Button>
                  </div>
                </object>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este manifesto? Esta ação não pode
                ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
