import { useState, useEffect } from "react";
import {
  type Fechamento,
  type Motorista,
  type Local,
  type ViagemFechamento,
} from "@/lib/store";
import { formatBRL } from "@/lib/exportUtils";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";

interface FechamentoFormProps {
  open: boolean;
  onClose: () => void;
  motoristas: Motorista[];
  locais: Local[];
  editingFechamento: Fechamento | null;
  onCreate: (
    motoristaId: string,
    dataInicio: string,
    dataFim: string,
    viagens: ViagemFechamento[],
    locais: Local[]
  ) => Promise<unknown>;
  onUpdate: (
    id: string,
    motoristaId: string,
    dataInicio: string,
    dataFim: string,
    viagens: ViagemFechamento[],
    locais: Local[]
  ) => Promise<unknown>;
}

export default function FechamentoForm({
  open,
  onClose,
  motoristas,
  locais,
  editingFechamento,
  onCreate,
  onUpdate,
}: FechamentoFormProps) {
  const [motoristaId, setMotoristaId] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [viagens, setViagens] = useState<ViagemFechamento[]>([]);
  const [saving, setSaving] = useState(false);

  const motoristasDisponiveis = motoristas.filter(
    (motorista) =>
      motorista.status === "ATIVO" ||
      motorista.id === editingFechamento?.motoristaId
  );

  useEffect(() => {
    if (editingFechamento) {
      setMotoristaId(editingFechamento.motoristaId);
      setDataInicio(editingFechamento.dataInicio);
      setDataFim(editingFechamento.dataFim);
      setViagens(editingFechamento.viagens);
    } else {
      setMotoristaId("");
      setDataInicio("");
      setDataFim("");
      setViagens([]);
    }
  }, [editingFechamento, open]);

  const addViagem = () => {
    if (locais.length === 0) {
      toast.error("Cadastre locais antes de criar um fechamento.");
      return;
    }
    setViagens([...viagens, { localId: "", quantidade: 1 }]);
  };

  const updateViagem = (index: number, updates: Partial<ViagemFechamento>) => {
    setViagens(
      viagens.map((v, i) => (i === index ? { ...v, ...updates } : v))
    );
  };

  const removeViagem = (index: number) => {
    setViagens(viagens.filter((_, i) => i !== index));
  };

  const valorTotal = viagens.reduce((sum, v) => {
    const local = locais.find((l) => l.id === v.localId);
    return sum + (local ? local.valorComissao * v.quantidade : 0);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!motoristaId) {
      toast.error("Selecione um motorista.");
      return;
    }
    if (!dataInicio || !dataFim) {
      toast.error("Selecione as datas de início e fim.");
      return;
    }
    if (viagens.length === 0 || viagens.some((v) => !v.localId)) {
      toast.error("Adicione pelo menos uma viagem com local selecionado.");
      return;
    }

    setSaving(true);
    try {
      if (editingFechamento) {
        await onUpdate(
          editingFechamento.id,
          motoristaId,
          dataInicio,
          dataFim,
          viagens,
          locais
        );
        toast.success("Fechamento atualizado com sucesso!");
      } else {
        await onCreate(motoristaId, dataInicio, dataFim, viagens, locais);
        toast.success("Fechamento criado com sucesso!");
      }
      onClose();
    } catch (error: any) {
      console.error("Falha ao salvar fechamento.", error);
      toast.error(error?.response?.data?.message ?? "Não foi possível salvar o fechamento.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingFechamento ? "Editar Fechamento" : "Novo Fechamento"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Motorista selection */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Motorista</Label>
            <Select value={motoristaId} onValueChange={setMotoristaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um motorista" />
              </SelectTrigger>
              <SelectContent>
                {motoristasDisponiveis.length === 0 ? (
                  <SelectItem value="_empty" disabled>
                    Nenhum motorista cadastrado
                  </SelectItem>
                ) : (
                  motoristasDisponiveis.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome} — {m.cpf}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Data Início</Label>
              <DatePicker value={dataInicio} onChange={setDataInicio} placeholder="Selecione uma data" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Data Fim</Label>
              <DatePicker value={dataFim} onChange={setDataFim} placeholder="Selecione uma data" />
            </div>
          </div>

          {/* Viagens */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Viagens por Local</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addViagem}
                disabled={locais.length === 0}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Adicionar
              </Button>
            </div>

            {locais.length === 0 && (
              <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                Cadastre locais antes de adicionar viagens.
              </p>
            )}

            {viagens.length > 0 && (
              <div className="space-y-2">
                {viagens.map((viagem, index) => {
                  const local = locais.find((l) => l.id === viagem.localId);
                  const subtotal = local
                    ? local.valorComissao * viagem.quantidade
                    : 0;
                  return (
                    <div
                      key={index}
                      className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400">
                        <MapPin className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <Select
                          value={viagem.localId}
                          onValueChange={(val) =>
                            updateViagem(index, { localId: val })
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Selecione o local" />
                          </SelectTrigger>
                          <SelectContent>
                            {locais.map((l) => (
                              <SelectItem key={l.id} value={l.id}>
                                {l.cidade} — {formatBRL(l.valorComissao)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-20">
                        <Input
                          type="number"
                          min={1}
                          value={viagem.quantidade}
                          onChange={(e) =>
                            updateViagem(index, {
                              quantidade: Math.max(1, parseInt(e.target.value) || 1),
                            })
                          }
                          className="h-9 text-center"
                          placeholder="Qtd"
                        />
                      </div>
                      <div className="w-24 text-right text-sm font-medium text-foreground">
                        {formatBRL(subtotal)}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeViagem(index)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Total */}
          <div className="flex items-center justify-between rounded-lg bg-primary/5 p-4">
            <span className="text-sm font-semibold text-muted-foreground">
              Valor Total da Comissão
            </span>
            <span className="font-display text-2xl font-bold text-primary">
              {formatBRL(valorTotal)}
            </span>
          </div>

          <DialogFooter>
            <Button type="submit" className="w-full sm:w-auto" disabled={saving}>
              {saving
                ? "Salvando..."
                : editingFechamento
                  ? "Salvar alterações"
                  : "Criar fechamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
