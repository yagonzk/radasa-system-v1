import { describe, expect, it } from "vitest";
import { interpretarTextoManifestoPdf } from "./manifesto-pdf.service.js";

const OCR_TOTVS_PRINT_TO_PDF = `
SIGA /FATRU41/v.12 ROMANEIO DE FRETE DT.Ref.: 05/08/2026
Emissão: 05/08/2026
TRANSPORTADORA : 001103-D BARBIERO E CI Cod Veiculo : 00002092 PLACA VEICULO : RAQ5F96 - IVECO/TECTOR 310E30C Periodo: Todos
CLIENTE : 001237/01-STARGAS
175513 05/08/26 Ol 00308-GARRAFAO 20 LT 146,00 4,46 651,16 Incluso NF - Acertar c/Lebrinha060630/004
CLIENTE ; 001833/01-DISTRIBUIDORA TONINHO
175513 05/08/26 03 00312-COPO 200ML C/4 60,00 2,16 129,60 Receber c/ Cliente 060631/004
`;


const MULTIPLOS_PRODUTOS_MESMO_CLIENTE = `
SIGA /FATRU41/v.12 ROMANEIO DE FRETE DT.Ref.: 07/08/2026
Emissão: 07/08/2026
TRANSPORTADORA : 001103-D BARBIERO E CI Cod Veiculo : 00002174 PLACA VEICULO : RAX6E36 - VW / 30.330 CRC 8X2 Periodo: Todos
CLIENTE : 094020/01-MANGO GAS COLNIZA
175646 07/08/26 02 00316-GAS 500ML C/12 10,00 1,62 16,20 Receber c/ Cliente 060774/004
175646 07/08/26 01 00317-497ML C/12 20,00 1,08 21,60 Receber c/ Cliente 060774/004
`;


const CLIENTES_REPETIDOS_E_VASILHAMES_ZERO = `
SIGA /FATRU41/v.12 ROMANEIO DE FRETE DT.Ref.: 07/08/2026
Emissão: 07/08/2026
TRANSPORTADORA : 001103-D BARBIERO E CI Cod Veiculo : 00002174 PLACA VEICULO : RAX6E36 - VW / 30.330 CRC 8X2 Periodo: Todos
CLIENTE : 094020/01-MANGO GAS COLNIZA
175646 07/08/26 01 09060-VASILHAME 20 L 35,00 0,00 0,00 -- x -- 057063/099
CLIENTE : 093546/01-SUPER GAS TERRA NOVA
175646 07/08/26 01 09060-VASILHAME 20 L 31,00 0,00 0,00 -- x -- 057064/099
175646 07/08/26 02 09060-VASILHAME 20 L 3,00 0,00 0,00 -- x -- 057064/099
CLIENTE : 094020/01-MANGO GAS COLNIZA
175646 07/08/26 02 00316-GAS 500ML C/12 10,00 1,62 16,20 Receber c/ Cliente 060774/004
175646 07/08/26 01 00317-497ML C/12 20,00 1,08 21,60 Receber c/ Cliente 060774/004
CLIENTE : 094020/01-MANGO GAS COLNIZA
175646 07/08/26 01 09060-VASILHAME 20 L 950,00 0,00 0,00 -- x -- 060781/004
CLIENTE : 094020/01-MANGO GAS COLNIZA
175648 07/08/26 01 00308-GARRAFAO 20 LT 922,00 9,72 8.961,84 Receber c/ Cliente 060779/004
CLIENTE : 094020/01-MANGO GAS COLNIZA
175648 07/08/26 01 00308-GARRAFAO 20 LT 28,00 9,72 272,16 Bonificacao- Acertar c/Lebrinha 060800/004
`;

const OCR_CLIENTE_COLADO_NO_ITEM_ANTERIOR = `
SIGA /FATRU41/v.12 ROMANEIO DE FRETE DT.Ref.: 07/08/2026
Emissão: 07/08/2026
TRANSPORTADORA : 001103-D BARBIERO E CI Cod Veiculo : 00002174 PLACA VEICULO : RAX6E36 - VW / 30.330 CRC 8X2 Periodo: Todos
CLIENTE : 094020/01-MANGO GAS COLNIZA
175646 07/08/26 01 09060-VASILHAME 20 L 950,00 0,00 0,00 -- x -- 060781/004 CLIENTE : 094020/01-MANGO GAS COLNIZA
175648 07/08/26 01 00308-GARRAFAO 20 LT 922,00 9,72 8.961,84 Receber c/ Cliente 060779/004
`;



const OCR_VASILHAME_COLUNAS_COLADAS = `
CLIENTE : 094020/01-MANGO GAS COLNIZA
175646 07/08/26 01 09060-VASILHAME 20 L 950,000,000,00 -- x -- 060781/004 CLIENTE : 094020/01-MANGO GAS COLNIZA
175648 07/08/26 01 00308-GARRAFAO 20 LT 922,00 9,72 8.961,84 Receber c/ Cliente 060779/004
`;

const LINHA_REPETIDA_POR_LEITURA_ALTERNATIVA = `
CLIENTE : 094020/01-MANGO GAS COLNIZA
175646 07/08/26 01 09060-VASILHAME 20 L 950,00 0,00 0,00 -- x -- 060781/004
CLIENTE : 094020/01-MANGO GAS COLNIZA
175648 07/08/26 01 00308-GARRAFAO 20 LT 922,00 9,72 8.961,84 Receber c/ Cliente 060779/004
CLIENTE : 094020/01-MANGO GAS COLNIZA
175648 07/08/26 01 00308-GARRAFAO 20 LT 922,00 9,72 8.961,84 Receber c/ Cliente 060779/004
`;


const OCR_REAL_FRETE_4 = `
CLIENTE 094020/01-MANGO GAS COLNIZA
175646 07/08/26 01 09060-VASILEAME 20 L 35,00 oo 0,00 -- x —— 057063/099
CLIENTE : 093546/01-SUPER GAS TERRA NOVA
75646 07/08/26 01 09060-VASILHAME 20 L 31,00 0,00 0,00 -- x 057064/099
75646 07/08/26 02 09060-VASILHAME 20 L 3,00 0,00 0,00 -- x 057064/099
CLIENTE : 094020/01-MANGO GAS 1 COLNIZA
175646 07/08/26 02 00316-GAS 500ML C/12 10,00 1,62 16,20 c/ Cliente 060774/004
175646 07/08/26 01 00317-497ML C/12 20,00 1,08 21,60 r c/ Cliente 060774/004
ENTE : 094020/01-MANGO GAS COLNIZA
75646 07/08/26 01 09060-VASILHAME 20 L 950,00 0,00 00 -- x 060781/004
CLIENTE 094020/01-MANGO GAS COLNIZA
175648 07/08/26 01 00308-GARRAFAO 20 LT 922,00 9,72 8.961,84 c/ Cliente 060779/004
CLIENTE : 094020/01-MANGO GAS COLNIZA
175648 07/08/26 01 00308-GARRAFAO 20 LT 28,0 9,72 272,16 Bonificacao- Acertar c/Lebrinha060800/004
`;


const CABECALHO_FRAGMENTADO_COM_DADOS_VALIDOS = `
SIGA /FATRU41/v.12 ROMANEIO DE FRETE
T R A N S P O R T A D O R A : 001103-D BARBIERO E CI
Cod Veiculo : 00002174
PLACA VEICULO : RAX6E36 - VW / 30.330 CRC 8X2 Periodo: Todos
Emissão: 07/08/2026
CLIENTE : 094020/01-MANGO GAS COLNIZA
175648 07/08/26 01 00308-GARRAFAO 20 LT 28,00 9,72 272,16 Bonificacao- Acertar c/Lebrinha 060800/004
`;


const FRETE3_TOTAL_RESUMO_OCR_CORROMPIDO = `
SIGA /FATRU41/v.12 ROMANEIO DE FRETE DT.Ref.: 05/08/2026
Emissão: 05/08/2026
TRANSPORTADORA : 001103-D BARBIERO E CI Cod Veiculo : 00002092 PLACA VEICULO : RAQ5F96 - IVECO/TECTOR 310E30C Periodo: Todos
CLIENTE : 001833/01-DISTRIBUIDORA TONINHO
175513 05/08/26 01 00308-GARRAFAO 20 LT 653,00 5,40 3.526,20 Receber c/ Cliente 060628/004
CLIENTE : 001237/01-STARGAS
175513 05/08/26 01 00308-GARRAFAO 20 LT 146,00 4,46 651,16 Incluso NF - Acertar c/Lebrinha 060630/004
CLIENTE : 001833/01-DISTRIBUIDORA TONINHO
175513 05/08/26 03 00312-COPO 200ML C/4 60,00 2,16 129,60 Receber c/ Cliente 060631/004
175513 05/08/26 02 00316-GAS 500ML C/12 30,00 1,08 32,40 Receber c/ Cliente 060631/004
175513 05/08/26 01 00317-497ML C/12 50,00 1,08 54,00 Receber c/ Cliente 060631/004
CLIENTE : 001833/01-DISTRIBUIDORA TONINHO
175513 05/08/26 01 00308-GARRAFAO 20 LT 97,00 5,40 523,80 Bonificacao- Acertar c/Lebrinha 060632/004
CLIENTE : 001237/01-STARGAS
175513 05/08/26 01 00308-GARRAFAO 20 LT 4,00 4,46 17,84 Bonificacao- Acertar c/Lebrinha 060633/004
RESUMO
Total ........................................................ 49.350,00
`;

describe("interpretarTextoManifestoPdf com OCR", () => {

  it("ignora total absurdo do RESUMO quando a soma validada dos itens fecha", () => {
    const result = interpretarTextoManifestoPdf(FRETE3_TOTAL_RESUMO_OCR_CORROMPIDO);

    expect(result.produtos).toHaveLength(7);
    expect(result.valorTotal).toBeCloseTo(4935, 2);
    expect(result.avisos.some((aviso) => aviso.includes("foi ignorado"))).toBe(true);
  });

  it("recupera linhas quando o PDF.js entrega cada caractere separado por espaços", () => {
    const base = `
SIGA /FATRU41/v.12 ROMANEIO DE FRETE DT.Ref.: 21/07/2026
Emissão: 21/07/2026
TRANSPORTADORA : 001103-D BARBIERO E CI Cod Veiculo : 00002106 PLACA VEICULO : RAU3I63 - VW / 30.280 CRM 8 X 2 Periodo: Todos
CLIENTE : 092807/01-QUEIROZ GAS - LUCAS DO RIO VERDE
174594 20/07/26 01 00308-GARRAFAO 20 LT 100,00 3,78 378,00 Incluso NF - Acertar c/Lebrinha 059532/004
CLIENTE : 094793/02-SUL NORTE SUPERMERCADO - INDUSTRIARIO IV
174594 20/07/26 01 00308-GARRAFAO 20 LT 100,00 4,82 482,00 Incluso NF - Acertar c/Lebrinha 059544/004
174594 20/07/26 03 00315-1500ML C/6 15,00 2,08 31,20 Incluso NF - Acertar c/Lebrinha 059544/004
174594 20/07/26 02 00316-GAS 500ML C/12 50,00 1,43 71,50 Incluso NF - Acertar c/Lebrinha 059544/004
`;
    const glyphSpaced = base
      .split("\n")
      .map((line) => line ? Array.from(line).join(" ") : "")
      .join("\n");

    const result = interpretarTextoManifestoPdf(glyphSpaced);
    expect(result.produtos).toHaveLength(4);
    expect(result.produtos.map((item) => [item.codigo, item.quantidade, item.valorUnitario, item.valorTotal])).toEqual([
      ["00308", 100, 3.78, 378],
      ["00308", 100, 4.82, 482],
      ["00315", 15, 2.08, 31.2],
      ["00316", 50, 1.43, 71.5],
    ]);
  });

  it("recupera transportadora, código do veículo, placa e modelo mesmo com cabeçalho fragmentado", () => {
    const result = interpretarTextoManifestoPdf(CABECALHO_FRAGMENTADO_COM_DADOS_VALIDOS);

    expect(result.transportadoraCodigo).toBe("001103");
    expect(result.transportadoraNome).toBe("D BARBIERO E CI");
    expect(result.veiculoCodigo).toBe("00002174");
    expect(result.placaVeiculo).toBe("RAX6E36");
    expect(result.modeloVeiculo).toBe("VW / 30.330 CRC 8 X 2");
  });

  it("recupera campos estruturais e separa embalagem C/4 da quantidade", () => {
    const result = interpretarTextoManifestoPdf(OCR_TOTVS_PRINT_TO_PDF);

    expect(result.dataEmissao).toBe("2026-08-05");
    expect(result.transportadoraNome).toBe("D BARBIERO E CI");
    expect(result.placaVeiculo).toBe("RAQ5F96");
    expect(result.clientes).toEqual([
      { codigo: "001237/01", nome: "STARGAS" },
      { codigo: "001833/01", nome: "DISTRIBUIDORA TONINHO" },
    ]);
    expect(result.produtos).toHaveLength(2);
    expect(result.produtos[0]).toMatchObject({
      item: "01",
      quantidade: 146,
      valorTotal: 651.16,
      tipoManifesto: "Acertar c/ Lebrinha",
    });
    expect(result.produtos[1]).toMatchObject({
      descricao: "COPO 200 ML C/4",
      quantidade: 60,
      valorTotal: 129.6,
      tipoManifesto: "Receber c/ Cliente",
    });
    expect(result.valorTotal).toBeCloseTo(780.76, 2);
    expect(result.avisos).toEqual([]);
  });
  it("mantém mais de um produto vendido para o mesmo cliente", () => {
    const result = interpretarTextoManifestoPdf(MULTIPLOS_PRODUTOS_MESMO_CLIENTE);

    expect(result.clientes).toEqual([
      { codigo: "094020/01", nome: "MANGO GAS COLNIZA" },
    ]);
    expect(result.produtos).toHaveLength(2);
    expect(result.produtos.map((item) => item.codigo)).toEqual(["00316", "00317"]);
    expect(result.produtos.every((item) => item.clienteCodigo === "094020/01")).toBe(true);
    expect(result.produtos.map((item) => item.quantidade)).toEqual([10, 20]);
    expect(result.valorTotal).toBeCloseTo(37.8, 2);
  });

  it("preserva cada bloco CLIENTE e lança VASILHAME sempre com valor unitário zero", () => {
    const result = interpretarTextoManifestoPdf(CLIENTES_REPETIDOS_E_VASILHAMES_ZERO);

    expect(result.produtos).toHaveLength(8);
    expect(result.produtos.filter((item) => item.clienteCodigo === "094020/01")).toHaveLength(6);
    expect(result.produtos.map((item) => item.blocoCliente)).toEqual([1, 2, 2, 3, 3, 4, 5, 6]);

    const vasilhames = result.produtos.filter((item) => item.descricao.toUpperCase().includes("VASILHAME"));
    expect(vasilhames).toHaveLength(4);
    expect(vasilhames.every((item) => item.valorUnitario === 0)).toBe(true);
    expect(vasilhames.every((item) => item.valorTotal === 0)).toBe(true);

    const vasilhame950 = result.produtos.find((item) => item.descricao.toUpperCase().includes("VASILHAME") && item.quantidade === 950);
    const garrafao922 = result.produtos.find((item) => item.codigo === "00308" && item.quantidade === 922);
    expect(vasilhame950).toMatchObject({ valorUnitario: 0, valorTotal: 0, notaFiscal: "060781", serie: "004" });
    expect(garrafao922).toMatchObject({ valorUnitario: 9.72, valorTotal: 8961.84, notaFiscal: "060779", serie: "004" });
    expect(result.produtos.indexOf(vasilhame950!)).toBeLessThan(result.produtos.indexOf(garrafao922!));
  });

  it("não deixa um CLIENTE colado contaminar o produto anterior", () => {
    const result = interpretarTextoManifestoPdf(OCR_CLIENTE_COLADO_NO_ITEM_ANTERIOR);

    expect(result.produtos).toHaveLength(2);
    expect(result.produtos[0]).toMatchObject({
      descricao: "VASILHAME 20 L",
      quantidade: 950,
      valorUnitario: 0,
      valorTotal: 0,
    });
    expect(result.produtos[1]).toMatchObject({
      descricao: "GARRAFAO 20 LT",
      quantidade: 922,
      valorUnitario: 9.72,
      valorTotal: 8961.84,
    });
  });


  it("recupera vasilhame mesmo quando OCR cola quantidade, unitário e total", () => {
    const result = interpretarTextoManifestoPdf(OCR_VASILHAME_COLUNAS_COLADAS);

    expect(result.produtos).toHaveLength(2);
    expect(result.produtos[0]).toMatchObject({
      descricao: "VASILHAME 20 L",
      quantidade: 950,
      valorUnitario: 0,
      valorTotal: 0,
      notaFiscal: "060781",
      serie: "004",
    });
    expect(result.produtos[1]).toMatchObject({
      descricao: "GARRAFAO 20 LT",
      quantidade: 922,
      valorUnitario: 9.72,
      valorTotal: 8961.84,
    });
  });

  it("não duplica a mesma linha física reconstruída por mais de uma estratégia", () => {
    const result = interpretarTextoManifestoPdf(LINHA_REPETIDA_POR_LEITURA_ALTERNATIVA);

    expect(result.produtos).toHaveLength(2);
    expect(result.produtos.filter((item) => item.codigo === "00308" && item.quantidade === 922)).toHaveLength(1);
    expect(result.produtos.filter((item) => item.descricao.toUpperCase().includes("VASILHAME"))).toHaveLength(1);
  });


  it("interpreta o OCR real do FRETE 4 sem perder vasilhames, sem acumular blocos e na ordem do PDF", () => {
    const result = interpretarTextoManifestoPdf(OCR_REAL_FRETE_4);

    expect(result.produtos).toHaveLength(8);
    expect(result.produtos.map((item) => item.blocoCliente)).toEqual([1, 2, 2, 3, 3, 4, 5, 6]);
    expect(result.produtos.map((item) => item.quantidade)).toEqual([35, 31, 3, 10, 20, 950, 922, 28]);
    expect(result.produtos.map((item) => item.romaneio)).toEqual([
      "175646", "175646", "175646", "175646", "175646", "175646", "175648", "175648",
    ]);

    const vasilhames = result.produtos.filter((item) => item.descricao.includes("VASILHAME"));
    expect(vasilhames).toHaveLength(4);
    expect(vasilhames.every((item) => item.valorUnitario === 0 && item.valorTotal === 0)).toBe(true);
    expect(result.produtos.filter((item) => item.quantidade === 922)).toHaveLength(1);
    expect(result.valorTotal).toBeCloseTo(9271.8, 2);
  });

});
