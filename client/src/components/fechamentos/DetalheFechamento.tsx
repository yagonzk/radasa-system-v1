import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { type Fechamento, type Motorista, type Local } from "@/lib/store";
import { formatBRL, formatDate } from "@/lib/exportUtils";
import { Edit3, Trash2 } from "lucide-react";

interface DetalheFechamentoProps {
  fechamento: Fechamento | null;
  motoristas: Motorista[];
  locais: Local[];
  onClose: () => void;
  onEdit: (f: Fechamento) => void;
  onDelete: (f: Fechamento) => void;
}

export default function DetalheFechamento({
  fechamento,
  motoristas,
  locais,
  onClose,
  onEdit,
  onDelete,
}: DetalheFechamentoProps) {
  if (!fechamento) return null;

  const motorista = motoristas.find((m) => m.id === fechamento.motoristaId);

  return (
    <Dialog open={Boolean(fechamento)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Detalhes do Fechamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Motorista info */}
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Motorista
            </p>
            <p className="mt-1 text-lg font-bold text-foreground">
              {motorista?.nome || "—"}
            </p>
          </div>

          {/* Período */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Data Início
              </p>
              <p className="mt-1 text-lg font-bold text-foreground">
                {formatDate(fechamento.dataInicio)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Data Fim
              </p>
              <p className="mt-1 text-lg font-bold text-foreground">
                {formatDate(fechamento.dataFim)}
              </p>
            </div>
          </div>

          {/* Viagens */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Viagens
            </p>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {fechamento.viagens.map((viagem, index) => {
                const local = locais.find((l) => l.id === viagem.localId);
                const subtotal = local
                  ? local.valorComissao * viagem.quantidade
                  : 0;
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {local?.cidade || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {viagem.quantidade}x {formatBRL(local?.valorComissao || 0)}
                      </p>
                    </div>
                    <p className="font-bold text-primary">{formatBRL(subtotal)}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between rounded-lg bg-primary/5 p-4">
            <span className="text-sm font-semibold text-muted-foreground">
              Valor Total
            </span>
            <span className="font-display text-2xl font-bold text-primary">
              {formatBRL(fechamento.valorTotal)}
            </span>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onEdit(fechamento);
              onClose();
            }}
          >
            <Edit3 className="mr-1.5 h-4 w-4" />
            Editar
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onDelete(fechamento);
              onClose();
            }}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
