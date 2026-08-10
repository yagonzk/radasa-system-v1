import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  FileBadge2,
  Pencil,
  Plus,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  type Ciot,
  type StatusCiot,
  type TipoOperacaoCiot,
  useCiots,
  useClientes,
  useMotoristas,
  useVeiculos,
} from "@/lib/store";

type FormState = {
  clienteId: string;
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
  dataFim: string;
  naturezaCarga: string;
  pesoKg: string;
  valorFrete: string;
  valorPedagio: string;
  observacoes: string;
};

const emptyForm: FormState = {
  clienteId: "",
  motoristaId: "",
  veiculoId: "",
  tipoOperacao: "LOTACAO",
  status: "RASCUNHO",
  rntrc: "",
  origemCidade: "",
  origemUf: "",
  destinoCidade: "",
  destinoUf: "",
  dataInicio: "",
  dataFim: "",
  naturezaCarga: "",
  pesoKg: "",
  valorFrete: "",
  valorPedagio: "",
  observacoes: "",
};

const statusLabels: Record<StatusCiot, string> = {
  RASCUNHO: "Rascunho",
  PRONTO_ENVIO: "Pronto para envio",
  PROCESSANDO: "Processando",
  AUTORIZADO: "Autorizado",
  REJEITADO: "Rejeitado",
  CANCELADO: "Cancelado",
  ENCERRADO: "Encerrado",
};

const tipoLabels: Record<TipoOperacaoCiot, string> = {
  LOTACAO: "Carga lotação",
  FRACIONADA: "Carga fracionada",
  TAC_AGREGADO: "TAC agregado",
};

function parseDecimal(value: string) {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function statusClass(status: StatusCiot) {
  const classes: Record<StatusCiot, string> = {
    RASCUNHO: "bg-muted text-muted-foreground",
    PRONTO_ENVIO: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    PROCESSANDO: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    AUTORIZADO: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    REJEITADO: "bg-destructive/10 text-destructive",
    CANCELADO: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
    ENCERRADO: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  };
  return classes[status];
}

export default function CiotPage() {
  const { items, create, update, remove } = useCiots();
  const { items: clientes } = useClientes();
  const { items: motoristas } = useMotoristas();
  const { items: veiculos } = useVeiculos();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Ciot | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusCiot | "TODOS">("TODOS");
  const [saving, setSaving] = useState(false);

  const clienteMap = useMemo(
    () => new Map(clientes.map((item) => [item.id, item])),
    [clientes],
  );
  const motoristaMap = useMemo(
    () => new Map(motoristas.map((item) => [item.id, item])),
    [motoristas],
  );
  const veiculoMap = useMemo(
    () => new Map(veiculos.map((item) => [item.id, item])),
    [veiculos],
  );

  const filteredItems = useMemo(() => {
    const normalized = query
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

    return items.filter((item) => {
      if (statusFilter !== "TODOS" && item.status !== statusFilter) return false;

      const cliente = item.clienteId ? clienteMap.get(item.clienteId) : undefined;
      const motorista = motoristaMap.get(item.motoristaId);
      const veiculo = veiculoMap.get(item.veiculoId);

      const haystack = [
        cliente?.razaoSocial,
        cliente?.nomeFantasia,
        cliente?.cnpj,
        motorista?.nome,
        motorista?.cpf,
        veiculo?.placa,
        item.rntrc,
        item.origemCidade,
        item.origemUf,
        item.destinoCidade,
        item.destinoUf,
        item.naturezaCarga,
        statusLabels[item.status],
      ]
        .filter(Boolean)
        .join(" ")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

      return !normalized || haystack.includes(normalized);
    });
  }, [
    clienteMap,
    items,
    motoristaMap,
    query,
    statusFilter,
    veiculoMap,
  ]);

  const counts = useMemo(
    () => ({
      total: items.length,
      rascunho: items.filter((item) => item.status === "RASCUNHO").length,
      pronto: items.filter((item) => item.status === "PRONTO_ENVIO").length,
      autorizado: items.filter((item) => item.status === "AUTORIZADO").length,
      rejeitado: items.filter((item) => item.status === "REJEITADO").length,
    }),
    [items],
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (item: Ciot) => {
    setEditing(item);
    setForm({
      clienteId: item.clienteId ?? "",
      motoristaId: item.motoristaId,
      veiculoId: item.veiculoId,
      tipoOperacao: item.tipoOperacao,
      status: item.status,
      rntrc: item.rntrc,
      origemCidade: item.origemCidade,
      origemUf: item.origemUf,
      destinoCidade: item.destinoCidade,
      destinoUf: item.destinoUf,
      dataInicio: item.dataInicio,
      dataFim: item.dataFim ?? "",
      naturezaCarga: item.naturezaCarga,
      pesoKg: String(item.pesoKg),
      valorFrete: String(item.valorFrete),
      valorPedagio: String(item.valorPedagio),
      observacoes: item.observacoes ?? "",
    });
    setDialogOpen(true);
  };

  const validate = () => {
    if (!form.clienteId) return "Selecione o cliente contratante.";
    if (!form.motoristaId) return "Selecione o motorista.";
    if (!form.veiculoId) return "Selecione o veículo.";
    if (!form.rntrc.trim()) return "Informe o RNTRC.";
    if (!form.origemCidade.trim() || form.origemUf.trim().length !== 2) {
      return "Informe a cidade e a UF de origem.";
    }
    if (!form.destinoCidade.trim() || form.destinoUf.trim().length !== 2) {
      return "Informe a cidade e a UF de destino.";
    }
    if (!form.dataInicio) return "Informe a data prevista de início.";
    if (!form.naturezaCarga.trim()) return "Informe a natureza da carga.";
    if (parseDecimal(form.valorFrete) <= 0) {
      return "Informe um valor de frete maior que zero.";
    }
    return "";
  };

  const save = async () => {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    const payload = {
      clienteId: form.clienteId,
      motoristaId: form.motoristaId,
      veiculoId: form.veiculoId,
      tipoOperacao: form.tipoOperacao,
      status: form.status,
      rntrc: form.rntrc.trim(),
      origemCidade: form.origemCidade.trim(),
      origemUf: form.origemUf.trim().toUpperCase(),
      destinoCidade: form.destinoCidade.trim(),
      destinoUf: form.destinoUf.trim().toUpperCase(),
      dataInicio: form.dataInicio,
      dataFim: form.dataFim || null,
      naturezaCarga: form.naturezaCarga.trim(),
      pesoKg: parseDecimal(form.pesoKg),
      valorFrete: parseDecimal(form.valorFrete),
      valorPedagio: parseDecimal(form.valorPedagio),
      outrosValores: editing?.outrosValores ?? 0,
      descontos: editing?.descontos ?? 0,
      valorLiquido:
        parseDecimal(form.valorFrete) +
        parseDecimal(form.valorPedagio) +
        (editing?.outrosValores ?? 0) -
        (editing?.descontos ?? 0),
      formaPagamento: editing?.formaPagamento ?? "",
      favorecidoPix: editing?.favorecidoPix ?? "",
      valorMercadoria: editing?.valorMercadoria ?? 0,
      cnpjsCargaFracionada: editing?.cnpjsCargaFracionada ?? "",
      observacoes: form.observacoes.trim() || null,
      numeroCiot: editing?.numeroCiot ?? null,
      codigoVerificador: editing?.codigoVerificador ?? null,
      protocolo: editing?.protocolo ?? null,
      mensagemRetorno: editing?.mensagemRetorno ?? null,
    };

    setSaving(true);
    try {
      if (editing) {
        await update(editing.id, payload);
        toast.success("CIOT atualizado com sucesso.");
      } else {
        await create(payload);
        toast.success("Rascunho de CIOT criado com sucesso.");
      }
      setDialogOpen(false);
    } catch (requestError: any) {
      toast.error(
        requestError?.response?.data?.message ??
          "Não foi possível salvar o CIOT.",
      );
    } finally {
      setSaving(false);
    }
  };

  const markReady = async (item: Ciot) => {
    try {
      await update(item.id, { status: "PRONTO_ENVIO" });
      toast.success("CIOT marcado como pronto para envio.");
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ??
          "Não foi possível atualizar o status.",
      );
    }
  };

  const deleteDraft = async (item: Ciot) => {
    if (!window.confirm("Excluir este rascunho de CIOT?")) return;

    try {
      await remove(item.id);
      toast.success("Rascunho excluído.");
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ??
          "Não foi possível excluir o rascunho.",
      );
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              CIOT
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Prepare e organize as operações antes do envio à ANTT.
            </p>
          </div>

          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Novo CIOT
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {(
            [
              ["Total", counts.total, FileBadge2],
              ["Rascunhos", counts.rascunho, Clock3],
              ["Prontos", counts.pronto, CheckCircle2],
              ["Autorizados", counts.autorizado, CheckCircle2],
              ["Rejeitados", counts.rejeitado, XCircle],
            ] as const
          ).map(([label, value, Icon]) => {
            const CardIcon = Icon as typeof FileBadge2;
            return (
              <div key={String(label)} className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <CardIcon className="h-4 w-4 text-primary" />
                </div>
                <p className="mt-2 text-2xl font-bold">{String(value)}</p>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Pesquisar por cliente, motorista, placa, rota, RNTRC ou carga..."
              className="pl-9"
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(value as StatusCiot | "TODOS")
            }
          >
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos os status</SelectItem>
              {Object.entries(statusLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-left">Motorista / veículo</th>
                  <th className="px-4 py-3 text-left">Rota</th>
                  <th className="px-4 py-3 text-left">Operação</th>
                  <th className="px-4 py-3 text-left">Frete</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      Nenhum CIOT encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const cliente = item.clienteId ? clienteMap.get(item.clienteId) : undefined;
                    const motorista = motoristaMap.get(item.motoristaId);
                    const veiculo = veiculoMap.get(item.veiculoId);

                    return (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="px-4 py-3">
                          <p className="font-medium">
                            {cliente?.razaoSocial ||
                              cliente?.nomeFantasia ||
                              "Cliente não encontrado"}
                          </p>
                          {cliente?.nomeFantasia &&
                            cliente.nomeFantasia !== cliente.razaoSocial && (
                              <p className="text-xs text-muted-foreground">
                                {cliente.nomeFantasia}
                              </p>
                            )}
                          <p className="text-xs text-muted-foreground">
                            {cliente?.cnpj || "CNPJ não informado"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium">
                            {motorista?.nome ?? "Motorista não encontrado"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {veiculo?.placa ?? "Placa não encontrada"}
                            {veiculo?.modelo ? ` • ${veiculo.modelo}` : ""}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p>
                            {item.origemCidade}/{item.origemUf}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            até {item.destinoCidade}/{item.destinoUf}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p>{tipoLabels[item.tipoOperacao]}</p>
                          <p className="text-xs text-muted-foreground">
                            Início:{" "}
                            {new Date(
                              `${item.dataInicio}T12:00:00`,
                            ).toLocaleDateString("pt-BR")}
                          </p>
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {formatMoney(item.valorFrete)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(
                              item.status,
                            )}`}
                          >
                            {statusLabels[item.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            {item.status === "RASCUNHO" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void markReady(item)}
                              >
                                Pronto
                              </Button>
                            )}
                            {["RASCUNHO", "PRONTO_ENVIO", "REJEITADO"].includes(
                              item.status,
                            ) && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openEdit(item)}
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {item.status === "RASCUNHO" && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => void deleteDraft(item)}
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar CIOT" : "Novo CIOT"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Cliente contratante</Label>
                <Select
                  value={form.clienteId}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      clienteId: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((cliente) => (
                      <SelectItem key={cliente.id} value={cliente.id}>
                        {cliente.razaoSocial || cliente.nomeFantasia}
                        {cliente.cnpj ? ` • ${cliente.cnpj}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Motorista</Label>
                <Select
                  value={form.motoristaId}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      motoristaId: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {motoristas
                      .filter((motorista) => motorista.status === "ATIVO")
                      .map((motorista) => (
                        <SelectItem key={motorista.id} value={motorista.id}>
                          {motorista.nome} • {motorista.cpf}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Veículo</Label>
                <Select
                  value={form.veiculoId}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      veiculoId: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {veiculos.map((veiculo) => (
                      <SelectItem key={veiculo.id} value={veiculo.id}>
                        {veiculo.placa}
                        {veiculo.modelo ? ` • ${veiculo.modelo}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Tipo de operação</Label>
                <Select
                  value={form.tipoOperacao}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      tipoOperacao: value as TipoOperacaoCiot,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(tipoLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>RNTRC</Label>
                <Input
                  value={form.rntrc}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      rntrc: event.target.value,
                    }))
                  }
                  placeholder="Número do RNTRC"
                  maxLength={30}
                />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      status: value as StatusCiot,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RASCUNHO">Rascunho</SelectItem>
                    <SelectItem value="PRONTO_ENVIO">
                      Pronto para envio
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Cidade de origem</Label>
                <Input
                  value={form.origemCidade}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      origemCidade: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>UF de origem</Label>
                <Input
                  value={form.origemUf}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      origemUf: event.target.value
                        .replace(/[^A-Za-z]/g, "")
                        .slice(0, 2)
                        .toUpperCase(),
                    }))
                  }
                  maxLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Data de início</Label>
                <Input
                  type="date"
                  value={form.dataInicio}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      dataInicio: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Cidade de destino</Label>
                <Input
                  value={form.destinoCidade}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      destinoCidade: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>UF de destino</Label>
                <Input
                  value={form.destinoUf}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      destinoUf: event.target.value
                        .replace(/[^A-Za-z]/g, "")
                        .slice(0, 2)
                        .toUpperCase(),
                    }))
                  }
                  maxLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Previsão de término</Label>
                <Input
                  type="date"
                  value={form.dataFim}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      dataFim: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Natureza da carga</Label>
                <Input
                  value={form.naturezaCarga}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      naturezaCarga: event.target.value,
                    }))
                  }
                  placeholder="Ex.: produtos químicos, grãos, carga seca"
                />
              </div>
              <div className="space-y-2">
                <Label>Peso (kg)</Label>
                <Input
                  value={form.pesoKg}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      pesoKg: event.target.value,
                    }))
                  }
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label>Valor do frete</Label>
                <Input
                  value={form.valorFrete}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      valorFrete: event.target.value,
                    }))
                  }
                  inputMode="decimal"
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Vale-pedágio</Label>
                <Input
                  value={form.valorPedagio}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      valorPedagio: event.target.value,
                    }))
                  }
                  inputMode="decimal"
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Observações</Label>
                <Textarea
                  value={form.observacoes}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      observacoes: event.target.value,
                    }))
                  }
                  rows={3}
                />
              </div>
            </div>

            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-muted-foreground">
              Nesta etapa o sistema apenas prepara e valida o cadastro. O envio
              oficial à ANTT será habilitado na etapa 3, após homologação e
              configuração do certificado digital.
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? "Salvando..." : "Salvar CIOT"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
