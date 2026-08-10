import { useMemo, useState, type ReactNode } from "react";
import { useMotoristas, type Motorista, type StatusMotorista } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DataTable from "./DataTable";
import { Plus, User, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";

interface FormState {
  nome: string;
  cpf: string;
  salarioBase: string;
}

type StatusFilter = "TODOS" | StatusMotorista;

const emptyForm: FormState = { nome: "", cpf: "", salarioBase: "" };

export default function MotoristaTab() {
  const { items, create, update } = useMotoristas();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("TODOS");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalizeSearch(query).trim();
    return items.filter((item) => {
      const matchesStatus = statusFilter === "TODOS" || item.status === statusFilter;
      const matchesQuery = !normalizedQuery || normalizeSearch([item.nome, item.cpf, item.salarioBase, item.status].join(" ")).includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    });
  }, [items, query, statusFilter]);

  const ativos = items.filter((item) => item.status === "ATIVO").length;
  const demitidos = items.length - ativos;

  const handleOpenCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setOpen(true);
  };

  const handleOpenEdit = (item: Motorista) => {
    setForm({
      nome: item.nome,
      cpf: item.cpf,
      salarioBase: String(item.salarioBase),
    });
    setEditingId(item.id);
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!form.nome.trim() || !form.cpf.trim()) {
      toast.error("Preencha nome e CPF.");
      return;
    }
    const salarioBase = parseFloat(form.salarioBase) || 0;

    setSaving(true);
    try {
      if (editingId) {
        await update(editingId, { nome: form.nome, cpf: form.cpf, salarioBase });
        toast.success("Motorista atualizado com sucesso!");
      } else {
        await create({
          nome: form.nome,
          cpf: form.cpf,
          salarioBase,
          status: "ATIVO",
        });
        toast.success("Motorista cadastrado com sucesso!");
      }
      setOpen(false);
    } catch (error) {
      console.error("Falha ao salvar motorista.", error);
      toast.error((error as any)?.response?.data?.message ?? "Não foi possível salvar o motorista.");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (item: Motorista) => {
    const nextStatus: StatusMotorista =
      item.status === "ATIVO" ? "DEMITIDO" : "ATIVO";
    const action = nextStatus === "DEMITIDO" ? "demitir" : "reativar";

    if (
      !window.confirm(
        `Deseja realmente ${action} o motorista ${item.nome}?`
      )
    ) {
      return;
    }

    try {
      await update(item.id, { status: nextStatus });
      toast.success(
        nextStatus === "DEMITIDO"
          ? "Motorista marcado como demitido."
          : "Motorista reativado com sucesso."
      );
    } catch (error) {
      console.error("Falha ao alterar o status do motorista.", error);
      toast.error("Não foi possível alterar o status do motorista.");
    }
  };

  const columns = [
    {
      key: "nome",
      label: "Nome",
      render: (item: Motorista) => (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
            <User className="h-4 w-4" />
          </div>
          <span className="font-medium">{item.nome}</span>
        </div>
      ),
    },
    { key: "cpf", label: "CPF" },
    {
      key: "salarioBase",
      label: "Salário Base",
      render: (item: Motorista) => (
        <span className="font-medium">
          R$ {item.salarioBase.toFixed(2).replace(".", ",")}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (item: Motorista) => (
        <span
          className={
            item.status === "ATIVO"
              ? "inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700 dark:bg-green-500/15 dark:text-green-400"
              : "inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-400"
          }
        >
          {item.status === "ATIVO" ? "Ativo" : "Demitido"}
        </span>
      ),
    },
    {
      key: "situacao",
      label: "Situação",
      render: (item: Motorista) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleStatusChange(item)}
          className={
            item.status === "ATIVO"
              ? "border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-500/30 dark:hover:bg-red-500/10"
              : "border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700 dark:border-green-500/30 dark:hover:bg-green-500/10"
          }
        >
          {item.status === "ATIVO" ? (
            <UserX className="mr-1.5 h-4 w-4" />
          ) : (
            <UserCheck className="mr-1.5 h-4 w-4" />
          )}
          {item.status === "ATIVO" ? "Demitir" : "Reativar"}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm text-muted-foreground">
              {items.length} motorista(s): {ativos} ativo(s) e {demitidos} demitido(s)
            </p>
          </div>
          <div className="w-full sm:w-72">
            <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pesquisar</Label>
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, CPF ou status..." />
          </div>
          <div className="w-full sm:w-44">
            <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Filtrar status
            </Label>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos</SelectItem>
                <SelectItem value="ATIVO">Ativos</SelectItem>
                <SelectItem value="DEMITIDO">Demitidos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={handleOpenCreate} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Novo Motorista
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filteredItems}
        onEdit={handleOpenEdit}
        emptyMessage="Nenhum motorista encontrado para a pesquisa ou filtro selecionado."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Motorista" : "Novo Motorista"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Nome">
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Nome completo"
              />
            </FormField>
            <FormField label="CPF">
              <Input
                value={form.cpf}
                onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                placeholder="000.000.000-00"
              />
            </FormField>
            <FormField label="Salário Base (R$)">
              <Input
                type="number"
                step="0.01"
                value={form.salarioBase}
                onChange={(e) =>
                  setForm({ ...form, salarioBase: e.target.value })
                }
                placeholder="0,00"
              />
            </FormField>
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function normalizeSearch(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}
