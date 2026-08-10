import { useMemo, useState, type ReactNode } from "react";
import { useProdutos, type Produto } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import DataTable from "./DataTable";
import { Plus, Package } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_CATEGORIES = ["Produtos de piscina", "Peças", "Ferramentas"];

interface FormState {
  nome: string;
  codigoInterno: string;
  categoriaEstoque: string;
}

const emptyForm: FormState = {
  nome: "",
  codigoInterno: "",
  categoriaEstoque: DEFAULT_CATEGORIES[0],
};

export default function ProdutoTab() {
  const { items, create, update, remove } = useProdutos();
  const [open, setOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [newCategory, setNewCategory] = useState("");
  const [sessionCategories, setSessionCategories] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const categories = useMemo(() => {
    const values = [
      ...DEFAULT_CATEGORIES,
      ...items.map((item) => item.categoriaEstoque).filter(Boolean),
      ...sessionCategories,
    ];
    return Array.from(new Set(values));
  }, [items, sessionCategories]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalizeSearch(query).trim();
    if (!normalizedQuery) return items;
    return items.filter((item) => normalizeSearch([item.nome, item.codigoInterno, item.categoriaEstoque].join(" ")).includes(normalizedQuery));
  }, [items, query]);

  const handleOpenCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setOpen(true);
  };

  const handleOpenEdit = (item: Produto) => {
    setForm({
      nome: item.nome,
      codigoInterno: item.codigoInterno,
      categoriaEstoque: item.categoriaEstoque || DEFAULT_CATEGORIES[0],
    });
    setEditingId(item.id);
    setOpen(true);
  };

  const handleCreateCategory = () => {
    const normalized = newCategory.trim().replace(/\s+/g, " ");
    if (!normalized) {
      toast.error("Digite o nome da categoria.");
      return;
    }

    const existing = categories.find(
      (category) => category.toLocaleLowerCase("pt-BR") === normalized.toLocaleLowerCase("pt-BR"),
    );
    const selectedCategory = existing ?? normalized;

    if (!existing) {
      setSessionCategories((current) => [...current, selectedCategory]);
    }

    setForm((current) => ({ ...current, categoriaEstoque: selectedCategory }));
    setNewCategory("");
    setCategoryOpen(false);
    toast.success(existing ? "Categoria selecionada." : "Categoria criada e selecionada.");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    try {
      if (editingId) {
        await update(editingId, { ...form });
        toast.success("Produto atualizado com sucesso!");
      } else {
        await create({ ...form });
        toast.success("Produto cadastrado com sucesso!");
      }
      setOpen(false);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível salvar o produto.");
    } finally {
      setSaving(false);
    }
  };

  const columns: { key: string; label: string; render?: (item: Produto) => ReactNode }[] = [
    {
      key: "nome",
      label: "Nome do Produto",
      render: (item: Produto) => (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400">
            <Package className="h-4 w-4" />
          </div>
          <span className="font-medium">{item.nome}</span>
        </div>
      ),
    },
    { key: "codigoInterno", label: "Código Interno" },
    {
      key: "categoriaEstoque",
      label: "Categoria",
      render: (item: Produto) => item.categoriaEstoque || DEFAULT_CATEGORIES[0],
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex w-full flex-col gap-3 sm:max-w-xl">
          <p className="text-sm text-muted-foreground">{items.length} produto(s) cadastrado(s)</p>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar por nome, código ou categoria..." />
        </div>
        <Button onClick={handleOpenCreate} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Novo Produto
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filteredItems}
        onEdit={handleOpenEdit}
        onDelete={(item) => remove(item.id)}
        emptyMessage="Nenhum produto encontrado para a pesquisa informada."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Nome do Produto">
              <Input
                required
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Nome do produto"
              />
            </FormField>
            <FormField label="Código Interno">
              <Input
                required
                value={form.codigoInterno}
                onChange={(e) => setForm({ ...form, codigoInterno: e.target.value })}
                placeholder="Ex: 2001"
              />
            </FormField>
            <FormField label="Categoria no estoque">
              <div className="flex items-center gap-2">
                <Select
                  value={form.categoriaEstoque}
                  onValueChange={(value) => setForm({ ...form, categoriaEstoque: value })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={() => setCategoryOpen(true)}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Nova categoria
                </Button>
              </div>
            </FormField>
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Nova categoria de estoque</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <FormField label="Nome da categoria">
              <Input
                autoFocus
                maxLength={80}
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleCreateCategory();
                  }
                }}
                placeholder="Ex: Produtos de limpeza"
              />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCategoryOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleCreateCategory}>
                Criar categoria
              </Button>
            </DialogFooter>
          </div>
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
