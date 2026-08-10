import { describe, expect, it } from "vitest";
import { buildManifestoDedupeKey } from "./manifestos.service";

describe("proteção contra romaneio duplicado", () => {
  it("considera a mesma lista de romaneios duplicada mesmo em outra ordem", () => {
    const first = buildManifestoDedupeKey({ romaneios: "170033, 170076" });
    const second = buildManifestoDedupeKey({ romaneios: "170076 / 170033" });
    expect(first).toBe(second);
  });

  it("usa data, placa e notas quando não há número de romaneio", () => {
    const first = buildManifestoDedupeKey({
      dataManifesto: "2026-04-17",
      placaVeiculo: "RAQ5F96",
      produtos: [{ notaFiscal: "056844", serieNf: "099" }],
    });
    const second = buildManifestoDedupeKey({
      dataManifesto: new Date("2026-04-17T00:00:00.000Z"),
      placaVeiculo: "RAQ-5F96",
      produtos: [{ notaFiscal: "056844", serieNf: "099" }],
    });
    expect(first).toBe(second);
  });
});
