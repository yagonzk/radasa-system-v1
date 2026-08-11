import assert from "node:assert/strict";
import { interpretarTextoManifestoPdf } from "../server/services/manifesto-pdf.service.js";

const ocrText = `
SIGA /FATRU41/v.12 ROMANEIO DE FRETE DT.Ref.: 07/08/2026
Hora...: 09:27:09 - Grupo de empresa: Grupo Lebrinha / Filial: Filial (Ipiranga) Emissão: 07/08/2026
Roman. Emissao It Produto Qtde Prc.Unit Tot.Frete Instrucao de Cobranca Frete N.F./Serie
TRANSPORTADORA : 001103-D BARBIERO E CI Cod Veiculo : 00002106 PLACA VEICULO : RAU3T63 - VW 30.280 CRM 8X2 Periodo: Todos
CLIENTE : 094054/01-KERO GAS MORAES
175474 07/08/26 01 09060-VASILHAME 20 L 1.000,00 0,00 0,00 .. x == 060707/004
CLIENTE : 094054/Q1I-KERO GAS MORAES
175601 07/08/26 01 00308-GARRAFAO 20 LT 920,00 7,78 7.157,60 Receber c/ Cliente 060708/004
CLIENTE : 094054/01-KERO CAS MORAES
175602 07/08/26 01 00308-GARRAFAC 20 LIT 80,00 7,78 622,40 Incluso NF - Acertar :/Lebrinha060709/004
RESUMO
Frete - Incluso NF - Acertar c/Lebrinha................ 622,40
Frete - Receber c/ Cliente............................ 7.157,60
Total ................................................ 7.780,00
`;

const result = interpretarTextoManifestoPdf(ocrText);

assert.equal(result.parserVersion, "2026.08.11.03");
assert.equal(result.produtos.length, 3);
assert.deepEqual(result.romaneios, ["175474", "175601", "175602"]);
assert.deepEqual(result.notasFiscais, ["060707/004", "060708/004", "060709/004"]);
assert.equal(result.transportadoraCodigo, "001103");
assert.equal(result.veiculoCodigo, "00002106");
assert.equal(result.valorTotal, 7780);
assert.equal(result.produtos[0].valorUnitario, 0);
assert.equal(result.produtos[1].quantidade, 920);
assert.equal(result.produtos[1].valorUnitario, 7.78);
assert.equal(result.produtos[1].valorTotal, 7157.6);
assert.equal(result.produtos[2].quantidade, 80);
assert.equal(result.produtos[2].valorTotal, 622.4);

console.log("ROMANEIO_V8_OK: 3 itens, 3 NFs, total 7780,00.");
