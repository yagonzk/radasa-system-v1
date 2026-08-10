import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import pdfParse from "pdf-parse";
import {
  interpretarManifestoPdf,
  interpretarTextoManifestoPdf,
} from "../server/services/manifesto-pdf.service";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) throw new Error("Informe o caminho do PDF de romaneio.");
  const buffer = await readFile(filePath);
  const documento = await interpretarManifestoPdf(buffer);

  if (process.argv.includes("--assert-sample")) {
    const extracted = await pdfParse(buffer);
    const withoutLineBreaks = interpretarTextoManifestoPdf(
      String(extracted.text ?? "").replace(/\r?\n/g, " "),
    );

    console.log({
      leituraNormal: documento.produtos.length,
      leituraCompactada: withoutLineBreaks.produtos.length,
    });

    for (const result of [documento, withoutLineBreaks]) {
      assert.equal(result.produtos.length, 14);
      assert.equal(result.clientes.length, 5);
      assert.equal(result.romaneios.length, 2);
      assert.equal(result.placaVeiculo, "RAQ5F96");
      assert.ok(Math.abs(result.valorTotal - 7081.4) < 0.001);
    }

    console.log(
      `PARSER_OK ${documento.parserVersion}: 14 itens em leitura normal e compactada.`,
    );
    return;
  }

  console.log(JSON.stringify(documento, null, 2));
}

void main();
