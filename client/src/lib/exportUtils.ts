import type { Fechamento, Motorista, Local } from "./store";

/**
 * Format currency in BRL
 */
export function formatBRL(value: number | string | null | undefined): string {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(",", "."))
        : Number.NaN;

  const safeValue = Number.isFinite(numericValue) ? numericValue : 0;

  return safeValue.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Format date from ISO string to dd/mm/yyyy
 * Preserves the exact date without timezone conversion
 */
export function formatDate(iso: string): string {
  if (!iso) return "—";
  // Handle ISO date format (YYYY-MM-DD) directly without timezone conversion
  if (iso.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = iso.split("-");
    return `${day}/${month}/${year}`;
  }
  // Timestamps include a timezone. Display their date in the user's local
  // timezone so the table and date filters refer to the same calendar day.
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
}

/**
 * Export fechamentos to CSV
 */
export function exportToCSV(
  fechamentos: Fechamento[],
  motoristas: Motorista[],
  locais: Local[]
): void {
  const headers = [
    "Motorista",
    "CPF",
    "Data Início",
    "Data Fim",
    "Locais Visitados",
    "Total de Viagens",
    "Valor Total",
  ];

  const rows = fechamentos.map((f) => {
    const motorista = motoristas.find((m) => m.id === f.motoristaId);
    const locaisStr = f.viagens
      .map((v) => {
        const local = locais.find((l) => l.id === v.localId);
        const nome = local ? local.cidade : "—";
        return `${nome} (${v.quantidade}x)`;
      })
      .join("; ");
    const totalViagens = f.viagens.reduce((sum, v) => sum + v.quantidade, 0);
    return [
      motorista?.nome || "—",
      motorista?.cpf || "—",
      formatDate(f.dataInicio),
      formatDate(f.dataFim),
      locaisStr,
      String(totalViagens),
      formatBRL(f.valorTotal),
    ];
  });

  const csv = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const hoje = new Date().toLocaleDateString("pt-BR").replaceAll("/", "-");
  link.download = `fechamentos_${hoje}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export fechamentos to PDF using window.print with a styled HTML
 */
export function exportToPDF(
  fechamentos: Fechamento[],
  motoristas: Motorista[],
  locais: Local[]
): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const rows = fechamentos
    .map((f) => {
      const motorista = motoristas.find((m) => m.id === f.motoristaId);
      const locaisStr = f.viagens
        .map((v) => {
          const local = locais.find((l) => l.id === v.localId);
          return `<tr><td style="padding:4px 8px;border:1px solid #ddd;">${
            local ? local.cidade : "—"
          }</td><td style="padding:4px 8px;border:1px solid #ddd;text-align:center;">${
            v.quantidade
          }</td><td style="padding:4px 8px;border:1px solid #ddd;text-align:right;">${
            local ? formatBRL(local.valorComissao) : "—"
          }</td><td style="padding:4px 8px;border:1px solid #ddd;text-align:right;">${
            local ? formatBRL(local.valorComissao * v.quantidade) : "—"
          }</td></tr>`;
        })
        .join("");
      const totalViagens = f.viagens.reduce(
        (sum, v) => sum + v.quantidade,
        0
      );
      return `
        <div style="margin-bottom:24px;padding:16px;border:1px solid #ddd;border-radius:8px;">
          <h3 style="margin:0 0 8px;color:#0062B1;">${motorista?.nome || "—"}</h3>
          <p style="margin:0 0 4px;font-size:13px;color:#555;">CPF: ${motorista?.cpf || "—"}</p>
          <p style="margin:0 0 12px;font-size:13px;color:#555;">Período: ${formatDate(f.dataInicio)} a ${formatDate(f.dataFim)}</p>
          <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px;">
            <thead>
              <tr style="background:#f4f6f9;">
                <th style="padding:4px 8px;border:1px solid #ddd;text-align:left;">Local</th>
                <th style="padding:4px 8px;border:1px solid #ddd;text-align:center;">Qtd</th>
                <th style="padding:4px 8px;border:1px solid #ddd;text-align:right;">Valor Unit.</th>
                <th style="padding:4px 8px;border:1px solid #ddd;text-align:right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>${locaisStr}</tbody>
          </table>
          <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:bold;color:#0062B1;">
            <span>Total de viagens: ${totalViagens}</span>
            <span>Valor Total: ${formatBRL(f.valorTotal)}</span>
          </div>
        </div>
      `;
    })
    .join("");

  printWindow.document.write(`
    <!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <title>Fechamentos de Comissão</title>
      <style>
        * { font-family: 'Inter', Arial, sans-serif; }
        body { padding: 32px; color: #0A0E21; }
        h1 { color: #0062B1; font-size: 24px; margin-bottom: 4px; }
        h2 { font-size: 14px; color: #555; font-weight: normal; margin-top: 0; margin-bottom: 24px; }
        @media print {
          body { padding: 16px; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <h1>Fechamentos de Comissão</h1>
      <h2>Relatório gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}</h2>
      ${fechamentos.length === 0 ? "<p style='color:#999;'>Nenhum fechamento no período selecionado.</p>" : rows}
      <div class="no-print" style="margin-top:24px;text-align:center;">
        <button onclick="window.print()" style="background:#0062B1;color:#fff;border:none;padding:10px 24px;border-radius:8px;cursor:pointer;font-size:14px;">Imprimir / Salvar PDF</button>
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
}
