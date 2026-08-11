# Radasa Parser v12 — correção de valores absurdos

Parser: `2026.08.11.05`

Correções principais:

- não usa mais o maior número monetário encontrado na linha como total;
- preserva a ordem física Qtde / Prc.Unit / Tot.Frete;
- valida `quantidade × valor unitário = total`;
- só usa pareamento por posição entre texto digital e OCR quando as duas fontes têm exatamente a mesma quantidade de linhas;
- quando uma linha digital está incompleta, ela pode ajudar em NF/série sem substituir valores monetários válidos do OCR;
- evita inferir sequência de NF a partir de um par qualquer no meio do documento;
- corrige o caso em que OCR lê `80,00 × 7,78 = 622,40` como `20,00 × 31,12 = 622,40`, usando a quantidade da camada digital quando as linhas estão alinhadas;
- versão esperada no frontend e versão do backend foram sincronizadas em `2026.08.11.05`.

Validação realizada:

- `FRETE 1 (1).pdf`: 3 itens, total R$ 7.780,00.
- `FRETE 3 (1).pdf`: 11 itens, total R$ 4.935,00.
