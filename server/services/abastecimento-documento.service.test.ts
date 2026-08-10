import { describe, expect, it } from "vitest";
import { interpretarTextoPdfAbastecimento } from "./abastecimento-documento.service.js";

const danfeText = `
Recebemos de COMERCIO DE COMBUSTIVEIS MAE CAROLINA LTDA os produtos e/ou serviços constantes da Nota Fiscal Eletrônica indicada ao lado.
Emissão: 05/08/2026 Dest/Reme: D. BARBIERO & CIA LTDA Valor Total: 1.102,50 NF-e
Nº 000.048.135
Série 005
COMERCIO DE COMBUSTIVEIS MAE DANFE
Documento Auxiliar da
CAROLINA LTDA
CHAVE DE ACESSO
5126 0852 5013 6700 0192 5500 5000 0481 3516 9332 8627
INSCRIÇÃO ESTADUAL INSCRIÇÃO ESTADUAL DO SUBSTITUTO TRIBUTÁRIO CNPJ
140230246 52.501.367/0001-92
DESTINATÁRIO / REMETENTE
D. BARBIERO & CIA LTDA 15.209.274/0001-62 05/08/2026
DADOS DOS PRODUTOS / SERVIÇOS
CÓDIGO DESCRIÇÃO DO PRODUTO / SERVIÇO NCM/SH CST CFOP UNID. QTDE.
667  OLEO DIESEL B S10  27101921 061  5656  LT  150,0000  7,35  0,00  1.102,50  0,00  0,00
DADOS ADICIONAIS
PLACA: RAU3I63 - KM: 486517 - VEICULO: -
`;

describe("interpretação de DANFE de abastecimento", () => {
  it("extrai o emitente e os litros da linha de produto separada por espaços", async () => {
    const result = await interpretarTextoPdfAbastecimento(danfeText);

    expect(result.fornecedorCnpj).toBe("52501367000192");
    expect(result.fornecedorNome).toBe(
      "COMERCIO DE COMBUSTIVEIS MAE CAROLINA LTDA",
    );
    expect(result.produtos).toEqual([
      {
        codigo: "667",
        descricao: "OLEO DIESEL B S10",
        quantidadeLitros: 150,
        valorUnitario: 7.35,
        valorTotal: 1102.5,
      },
    ]);
  });
});
