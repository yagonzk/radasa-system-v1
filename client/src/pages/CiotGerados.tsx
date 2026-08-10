import { useMemo, useState } from "react";
import {
  Download,
  Eye,
  FileBadge2,
  Printer,
  Search,
} from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type Ciot,
  type StatusCiot,
  useCiots,
  useMotoristas,
  useVeiculos,
} from "@/lib/store";

const generatedStatuses: StatusCiot[] = [
  "AUTORIZADO",
  "CANCELADO",
  "ENCERRADO",
];

const labels: Record<StatusCiot, string> = {
  RASCUNHO: "Rascunho",
  PRONTO_ENVIO: "Pronto para envio",
  PROCESSANDO: "Processando",
  AUTORIZADO: "Autorizado",
  REJEITADO: "Rejeitado",
  CANCELADO: "Cancelado",
  ENCERRADO: "Encerrado",
};

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function printCiot(item: Ciot) {
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
      <head>
        <title>CIOT #${item.idSequencial}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 32px; color: #111827; }
          h1 { margin-bottom: 8px; }
          .muted { color: #6b7280; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; margin-top: 24px; }
          .field { border-bottom: 1px solid #d1d5db; padding: 8px 0; }
          .label { font-size: 12px; color: #6b7280; display: block; }
          .value { font-weight: 600; }
        </style>
      </head>
      <body>
        <h1>Comprovante CIOT</h1>
        <p class="muted">Documento interno do Radasa System</p>
        <div class="grid">
          <div class="field"><span class="label">ID interno</span><span class="value">#${item.idSequencial}</span></div>
          <div class="field"><span class="label">Número CIOT ANTT</span><span class="value">${item.numeroCiot ?? "—"}</span></div>
          <div class="field"><span class="label">Código verificador</span><span class="value">${item.codigoVerificador ?? "—"}</span></div>
          <div class="field"><span class="label">Protocolo</span><span class="value">${item.protocolo ?? "—"}</span></div>
          <div class="field"><span class="label">Status</span><span class="value">${labels[item.status]}</span></div>
          <div class="field"><span class="label">Contratante</span><span class="value">${item.contratanteRazaoSocial || "—"} • ${item.contratanteCnpj || "—"}</span></div>
          <div class="field"><span class="label">Contratado</span><span class="value">${item.contratadoRazaoSocial || "—"} • ${item.contratadoCnpj || "—"}</span></div>
          <div class="field"><span class="label">Origem</span><span class="value">${item.origemCidade}/${item.origemUf}</span></div>
          <div class="field"><span class="label">Destino</span><span class="value">${item.destinoCidade}/${item.destinoUf}</span></div>
          <div class="field"><span class="label">Valor do frete</span><span class="value">${formatMoney(item.valorFrete)}</span></div>
          <div class="field"><span class="label">RNTRC</span><span class="value">${item.rntrc}</span></div>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function downloadCiot(item: Ciot) {
  const text = [
    "COMPROVANTE CIOT",
    `ID interno: #${item.idSequencial}`,
    `Número CIOT ANTT: ${item.numeroCiot ?? "—"}`,
    `Código verificador: ${item.codigoVerificador ?? "—"}`,
    `Protocolo: ${item.protocolo ?? "—"}`,
    `Status: ${labels[item.status]}`,
    `Contratante: ${item.contratanteRazaoSocial || "—"} • ${item.contratanteCnpj || "—"}`,
    `Contratado: ${item.contratadoRazaoSocial || "—"} • ${item.contratadoCnpj || "—"}`,
    `Origem: ${item.origemCidade}/${item.origemUf}`,
    `Destino: ${item.destinoCidade}/${item.destinoUf}`,
    `RNTRC: ${item.rntrc}`,
    `Valor do frete: ${formatMoney(item.valorFrete)}`,
  ].join("\n");

  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `ciot-${item.idSequencial}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function CiotGeradosPage() {
  const { items } = useCiots();
  const { items: motoristas } = useMotoristas();
  const { items: veiculos } = useVeiculos();
  const [query, setQuery] = useState("");

  const motoristaMap = useMemo(
    () => new Map(motoristas.map((item) => [item.id, item])),
    [motoristas],
  );
  const veiculoMap = useMemo(
    () => new Map(veiculos.map((item) => [item.id, item])),
    [veiculos],
  );

  const generated = useMemo(() => {
    const normalized = query
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR")
      .trim();

    return items.filter((item) => {
      if (!generatedStatuses.includes(item.status)) return false;

      const motorista = motoristaMap.get(item.motoristaId);
      const veiculo = veiculoMap.get(item.veiculoId);

      const haystack = [
        String(item.idSequencial),
        item.numeroCiot,
        item.codigoVerificador,
        item.protocolo,
        item.contratanteRazaoSocial,
        item.contratanteNomeFantasia,
        item.contratanteCnpj,
        item.contratadoRazaoSocial,
        item.contratadoNomeFantasia,
        item.contratadoCnpj,
        motorista?.nome,
        motorista?.cpf,
        veiculo?.placa,
        item.origemCidade,
        item.destinoCidade,
        labels[item.status],
      ]
        .filter(Boolean)
        .join(" ")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR");

      return !normalized || haystack.includes(normalized);
    });
  }, [items, motoristaMap, query, veiculoMap]);

  return (
    <Layout>
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            CIOTs gerados
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Consulte, baixe e imprima CIOTs emitidos anteriormente.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="relative max-w-2xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Pesquisar por CIOT, contratante, contratado, motorista, placa, protocolo ou rota..."
              className="pl-9"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left">ID / CIOT</th>
                  <th className="px-4 py-3 text-left">Contratado</th>
                  <th className="px-4 py-3 text-left">Motorista / veículo</th>
                  <th className="px-4 py-3 text-left">Rota</th>
                  <th className="px-4 py-3 text-left">Frete</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {generated.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      Nenhum CIOT emitido foi encontrado.
                    </td>
                  </tr>
                ) : (
                  generated.map((item) => {
                                  const motorista = motoristaMap.get(item.motoristaId);
                    const veiculo = veiculoMap.get(item.veiculoId);

                    return (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="px-4 py-3">
                          <p className="font-semibold tabular-nums">#{item.idSequencial}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.numeroCiot ? `CIOT ANTT ${item.numeroCiot}` : "CIOT ANTT sem número"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.protocolo
                              ? `Protocolo ${item.protocolo}`
                              : "Protocolo não informado"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium">
                            {item.contratadoRazaoSocial ||
                              item.contratadoNomeFantasia ||
                              "Contratado não informado"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.contratadoCnpj || "CNPJ não informado"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p>{motorista?.nome ?? "Motorista não encontrado"}</p>
                          <p className="text-xs text-muted-foreground">
                            {veiculo?.placa ?? "Placa não encontrada"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {item.origemCidade}/{item.origemUf} →{" "}
                          {item.destinoCidade}/{item.destinoUf}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {formatMoney(item.valorFrete)}
                        </td>
                        <td className="px-4 py-3">{labels[item.status]}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Visualizar"
                              onClick={() => printCiot(item)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Baixar"
                              onClick={() => downloadCiot(item)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Imprimir"
                              onClick={() => printCiot(item)}
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
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

        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-sm text-muted-foreground">
          Nesta fase os botões usam um comprovante interno. O PDF oficial da
          ANTT será armazenado após a integração da etapa 3.
        </div>
      </div>
    </Layout>
  );
}
