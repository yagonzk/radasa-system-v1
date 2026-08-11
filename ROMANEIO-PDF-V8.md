# Romaneios PDF - v8

Correção de leitura para PDFs SIGA/FATRU41 com camada de texto parcial.

- Detecta quando o PDF contém apenas cabeçalho/totais pesquisáveis e força OCR.
- OCR usa PSM SINGLE_BLOCK, adequado ao relatório tabular fixo.
- Renderização OCR elevada para até 330 DPI no primeiro OCR e 400 DPI no retry de alta precisão.
- Placa lida por OCR é vinculada apenas a placa já cadastrada, com correção conservadora de até 2 erros de OCR quando o melhor vínculo é único.
- Confere a soma dos itens contra o TOTAL impresso do resumo quando disponível.
- Parser: 2026.08.11.01.

Amostra FRETE 1 (1).pdf validada: 3 itens, total R$ 7.780,00, cliente 094054/01 e transportadora 001103.
