import { useState, useMemo } from "react";
import Layout from "@/components/Layout";
import {
  useFechamentos,
  useMotoristas,
  useLocais,
  type Fechamento,
} from "@/lib/store";
import { formatBRL, formatDate, exportToCSV, exportToPDF } from "@/lib/exportUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, FileDown, FileText, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import FechamentoForm from "@/components/fechamentos/FechamentoForm";
import DetalheFechamento from "@/components/fechamentos/DetalheFechamento";

export default function Fechamentos() {
  const { items: fechamentos, create, update, remove } = useFechamentos();
  const { items: motoristas } = useMotoristas();
  const { items: locais } = useLocais();

  const [formOpen, setFormOpen] = useState(false);
  const [editingFechamento, setEditingFechamento] = useState<Fechamento | null>(null);
  const [detalheFechamento, setDetalheFechamento] = useState<Fechamento | null>(null);

  // Filters
  const [filterMotorista, setFilterMotorista] = useState("todos");
  const [filterInicio, setFilterInicio] = useState("");
  const [filterFim, setFilterFim] = useState("");

  const motoristasAtivos = useMemo(
    () => motoristas.filter((motorista) => motorista.status === "ATIVO"),
    [motoristas]
  );

  const filteredFechamentos = useMemo(() => {
    return fechamentos.filter((f) => {
      if (filterMotorista !== "todos" && f.motoristaId !== filterMotorista) return false;
      if (filterInicio && f.dataInicio < filterInicio) return false;
      if (filterFim && f.dataFim > filterFim) return false;
      return true;
    });
  }, [fechamentos, filterMotorista, filterInicio, filterFim]);

  const handleOpenCreate = () => {
    if (motoristasAtivos.length === 0) {
      toast.error("Cadastre ou reative pelo menos um motorista antes de criar um fechamento.");
      return;
    }
    if (locais.length === 0) {
      toast.error("Cadastre pelo menos um local antes de criar um fechamento.");
      return;
    }
    setEditingFechamento(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (f: Fechamento) => {
    setDetalheFechamento(null);
    setEditingFechamento(f);
    setFormOpen(true);
  };

  const handleDelete = async (f: Fechamento) => {
    try {
      await remove(f.id);
      toast.success("Fechamento excluído com sucesso!");
    } catch (error: any) {
      console.error("Falha ao excluir fechamento.", error);
      toast.error(error?.response?.data?.message ?? "Não foi possível excluir o fechamento.");
    }
  };

  const handleExportCSV = () => {
    if (filteredFechamentos.length === 0) {
      toast.error("Nenhum fechamento para exportar.");
      return;
    }
    exportToCSV(filteredFechamentos, motoristas, locais);
    toast.success("CSV exportado com sucesso!");
  };

  const handleExportPDF = () => {
    if (filteredFechamentos.length === 0) {
      toast.error("Nenhum fechamento para exportar.");
      return;
    }
    exportToPDF(filteredFechamentos, motoristas, locais);
    toast.success("PDF gerado com sucesso!");
  };

  const handleClearFilters = () => {
    setFilterMotorista("todos");
    setFilterInicio("");
    setFilterFim("");
  };

  return (
    <Layout>
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              Cálculo de Comissão
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Selecione o motorista, adicione os locais visitados e calcule a
              comissão do período.
            </p>
          </div>
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Novo Fechamento
          </Button>
        </div>

        {/* Filters + Export */}
        <div className="mb-6 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Motorista
                </Label>
                <Select value={filterMotorista} onValueChange={setFilterMotorista}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Todos os motoristas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os motoristas</SelectItem>
                    {[...motoristas]
                      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
                      .map((motorista) => (
                        <SelectItem key={motorista.id} value={motorista.id}>
                          {motorista.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Filtrar de
                </Label>
                <DatePicker
                  value={filterInicio}
                  onChange={setFilterInicio}
                  className="w-44"
                  placeholder="Selecione uma data"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Filtrar até
                </Label>
                <DatePicker
                  value={filterFim}
                  onChange={setFilterFim}
                  className="w-44"
                  placeholder="Selecione uma data"
                />
              </div>
              {(filterMotorista !== "todos" || filterInicio || filterFim) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-9"
                >
                  Limpar filtros
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <FileDown className="mr-1.5 h-4 w-4" />
                Exportar CSV
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF}>
                <FileText className="mr-1.5 h-4 w-4" />
                Exportar PDF
              </Button>
            </div>
          </div>
        </div>

        {/* Fechamentos table */}
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                    Motorista
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                    Período
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground">
                    Viagens
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                    Valor Total
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground">
                    Detalhes
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredFechamentos.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      Nenhum fechamento encontrado. Clique em "Novo Fechamento"
                      para começar.
                    </td>
                  </tr>
                ) : (
                  filteredFechamentos.map((f) => {
                    const motorista = motoristas.find(
                      (m) => m.id === f.motoristaId
                    );
                    const totalViagens = f.viagens.reduce(
                      (sum, v) => sum + v.quantidade,
                      0
                    );
                    return (
                      <tr
                        key={f.id}
                        className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                      >
                        <td className="px-4 py-3 font-medium text-card-foreground">
                          {motorista?.nome || "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(f.dataInicio)} — {formatDate(f.dataFim)}
                        </td>
                        <td className="px-4 py-3 text-center text-card-foreground">
                          {totalViagens}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-primary">
                          {formatBRL(f.valorTotal)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setDetalheFechamento(f)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                            title="Ver detalhes"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {filteredFechamentos.length > 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            {filteredFechamentos.length} fechamento(s) nos filtros selecionados.
          </p>
        )}
      </div>

      {/* Form dialog */}
      <FechamentoForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        motoristas={motoristas}
        locais={locais}
        editingFechamento={editingFechamento}
        onCreate={create}
        onUpdate={update}
      />

      {/* Detail dialog */}
      <DetalheFechamento
        fechamento={detalheFechamento}
        motoristas={motoristas}
        locais={locais}
        onClose={() => setDetalheFechamento(null)}
        onEdit={handleOpenEdit}
        onDelete={handleDelete}
      />
    </Layout>
  );
}
