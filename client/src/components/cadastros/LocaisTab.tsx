import { useMemo, useState, type ReactNode } from "react";
import { useLocais, type Local } from "@/lib/store";
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
import DataTable from "./DataTable";
import { Plus, MapPin } from "lucide-react";
import { toast } from "sonner";

interface FormState {
  cidade: string;
  valorComissao: string;
}

const emptyForm: FormState = { cidade: "", valorComissao: "" };

export default function LocaisTab() {
  const { items, create, update, remove } = useLocais();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalizeSearch(query).trim();
    if (!normalizedQuery) return items;
    return items.filter((item) => normalizeSearch([item.cidade, item.valorComissao].join(" ")).includes(normalizedQuery));
  }, [items, query]);

  const handleOpenCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setOpen(true);
  };

  const handleOpenEdit = (item: Local) => {
    setForm({
      cidade: item.cidade,
      valorComissao: String(item.valorComissao),
    });
    setEditingId(item.id);
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!form.cidade.trim()) {
      toast.error("Preencha o nome da cidade.");
      return;
    }
    const valorComissao = parseFloat(form.valorComissao) || 0;

    setSaving(true);
    try {
      if (editingId) {
        await update(editingId, { cidade: form.cidade, valorComissao });
        toast.success("Local atualizado com sucesso!");
      } else {
        await create({ cidade: form.cidade, valorComissao });
        toast.success("Local cadastrado com sucesso!");
      }
      setOpen(false);
    } catch (error: any) {
      console.error("Falha ao salvar local.", error);
      toast.error(error?.response?.data?.message ?? "Não foi possível salvar o local.");
    } finally {
      setSaving(false);
    }
  };

  const columns: { key: string; label: string; render?: (item: Local) => ReactNode }[] = [
    {
      key: "cidade",
      label: "Cidade",
      render: (item: Local) => (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400">
            <MapPin className="h-4 w-4" />
          </div>
          <span className="font-medium">{item.cidade}</span>
        </div>
      ),
    },
    {
      key: "valorComissao",
      label: "Valor de Comissão",
      render: (item: Local) => (
        <span className="font-medium">
          R$ {item.valorComissao.toFixed(2).replace(".", ",")}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex w-full flex-col gap-3 sm:max-w-xl">
          <p className="text-sm text-muted-foreground">{items.length} local(s) cadastrado(s)</p>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar por cidade ou valor..." />
        </div>
        <Button onClick={handleOpenCreate} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Novo Local
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filteredItems}
        onEdit={handleOpenEdit}
        onDelete={(item) => remove(item.id)}
        emptyMessage="Nenhum local encontrado para a pesquisa informada."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Local" : "Novo Local"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Nome da Cidade">
              <Input
                value={form.cidade}
                onChange={(e) =>
                  setForm({ ...form, cidade: e.target.value })
                }
                placeholder="Nome da cidade"
              />
            </FormField>
            <FormField label="Valor de Comissão (R$)">
              <Input
                type="number"
                step="0.01"
                value={form.valorComissao}
                onChange={(e) =>
                  setForm({ ...form, valorComissao: e.target.value })
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
