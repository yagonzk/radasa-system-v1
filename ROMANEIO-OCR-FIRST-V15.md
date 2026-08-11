# Romaneios — OCR-first v15

Versão do parser: `2026.08.11.07`.

## Mudança principal

Os PDFs de Romaneio não são mais interpretados primeiro pela camada de texto interna do arquivo.
O navegador agora:

1. abre a página inteira do PDF;
2. detecta automaticamente a área que possui conteúdo impresso, sem corte fixo;
3. rasteriza essa área em alta resolução (alvo de 500 DPI);
4. executa Tesseract em modo de coluna única (PSM 4), adequado ao relatório SIGA;
5. envia ao backend apenas o texto OCR marcado como fonte primária;
6. o backend interpreta CLIENTE + produto + quantidade + unitário + total na mesma linha OCR;
7. valida os valores pela relação quantidade × valor unitário = total;
8. aplica correções conservadoras de códigos/NF/romaneio quando o OCR insere caracteres extras.

A camada de texto parcial do PDF não é misturada às linhas do OCR no modo Romaneios, evitando deslocamento de colunas.

## Regressões validadas

### FRETE 1 (1).pdf
- 3 itens
- 920 × 7,78 = 7.157,60
- 80 × 7,78 = 622,40
- total: R$ 7.780,00

### FRETE 3 (1).pdf
- 11 itens
- 653 × 5,40 = 3.526,20
- 146 × 4,46 = 651,16
- 60 × 2,16 = 129,60
- 30 × 1,08 = 32,40
- 50 × 1,08 = 54,00
- 97 × 5,40 = 523,80
- 4 × 4,46 = 17,84
- total: R$ 4.935,00

A importação em massa usa OCR sequencial para reduzir consumo de memória e priorizar precisão.
