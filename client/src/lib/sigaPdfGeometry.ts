export type SigaPdfTextItem = {
  str?: string;
  transform?: number[];
  width?: number;
  hasEOL?: boolean;
};

/**
 * Reconstrói ROMANEIO DE FRETE do SIGA exclusivamente pelas coordenadas do PDF.
 *
 * Esses relatórios frequentemente armazenam cada caractere como um TextItem
 * separado. A ordem lógica/hasEOL do PDF.js pode variar entre navegador/build,
 * mas as coordenadas X/Y continuam representando a linha impressa. Para o SIGA
 * não precisamos recriar espaços: o parser do backend já entende a forma
 * compacta. Basta preservar as linhas físicas e a ordem horizontal.
 */
export function extrairTextoGeometricoSiga(items: SigaPdfTextItem[]): string | null {
  const positioned = items
    .map((item, originalIndex) => {
      const transform = item.transform;
      if (!transform || transform.length < 6) return null;
      const text = String(item.str ?? "").replace(/\s+/g, "");
      if (!text) return null;
      return {
        text,
        x: Number(transform[4]) || 0,
        y: Number(transform[5]) || 0,
        width: Math.abs(Number(item.width) || 0),
        originalIndex,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (positioned.length < 20) return null;

  // Agrupa por baseline. Em relatórios SIGA os glifos de uma mesma linha usam
  // exatamente (ou quase exatamente) o mesmo Y. A tolerância de 1.75 pt absorve
  // pequenas diferenças de renderização sem unir linhas vizinhas (~9-20 pt).
  const sortedByY = [...positioned].sort((a, b) => b.y - a.y || a.x - b.x || a.originalIndex - b.originalIndex);
  const lines: Array<{ y: number; items: typeof positioned }> = [];

  for (const item of sortedByY) {
    let best: { line: (typeof lines)[number]; distance: number } | null = null;
    for (const line of lines) {
      const distance = Math.abs(line.y - item.y);
      if (distance <= 1.75 && (!best || distance < best.distance)) {
        best = { line, distance };
      }
    }
    if (best) {
      best.line.items.push(item);
      // Média incremental simples para estabilizar o baseline do grupo.
      best.line.y = (best.line.y * (best.line.items.length - 1) + item.y) / best.line.items.length;
    } else {
      lines.push({ y: item.y, items: [item] });
    }
  }

  const physicalLines = lines
    .sort((a, b) => b.y - a.y)
    .map((line) => {
      const ordered = line.items
        .sort((a, b) => a.x - b.x || a.originalIndex - b.originalIndex);
      let output = "";
      let previousEnd = Number.NEGATIVE_INFINITY;
      for (const item of ordered) {
        const gap = item.x - previousEnd;
        // Mantém os espaços visuais entre colunas/palavras. Em PDFs que
        // entregam um glifo por TextItem, width + X fazem gap≈0 e os caracteres
        // continuam unidos; entre colunas o gap é grande e vira separador.
        if (output && Number.isFinite(gap) && gap > 1.25) output += " ";
        output += item.text;
        previousEnd = Math.max(previousEnd, item.x + item.width);
      }
      return output;
    })
    .filter(Boolean);

  const text = physicalLines.join("\n");
  const compact = text.replace(/\s+/g, "").toUpperCase();

  // Só ativa esse caminho para o relatório conhecido. Assim outras telas que
  // reutilizam pdfText.ts não têm a extração alterada.
  // Mesmo quando CLIENTE/produto estão rasterizados (imagem), a camada
  // digital ainda contém cabeçalho, quantidade, total e NF. Preservamos essa
  // geometria parcial: o OCR visual será combinado com ela depois.
  const isSigaRomaneio =
    compact.includes("ROMANEIODEFRETE") &&
    compact.includes("TRANSPORTADORA");

  return isSigaRomaneio ? text : null;
}
