# Correção de agrupamento dos produtos por cliente — V17

Regra aplicada em Romaneios:

- VASILHAME continua sempre separado e nunca é agrupado com os demais produtos.
- Produtos que NÃO são vasilhame ficam contíguos quando pertencem ao mesmo cliente.
- Os produtos não são somados nem mesclados: quantidade, valor unitário, total, NF/série e cobrança permanecem individuais.
- A ordem interna dos produtos de cada cliente é preservada.
- A regra é aplicada na conferência da importação, na gravação individual, na importação em massa, na inspeção e na edição manual.

Exemplo validado:

Ordem lida:
1. TONINHO — GARRAFÃO 20 LT
2. STARGAS — GARRAFÃO 20 LT
3. TONINHO — COPO 200 ML C/4
4. TONINHO — GAS 500 ML C/12
5. TONINHO — 437 ML C/12
6. TONINHO — GARRAFÃO 20 LT
7. STARGAS — GARRAFÃO 20 LT

Ordem exibida/gravada:
1. TONINHO — GARRAFÃO 20 LT
2. TONINHO — COPO 200 ML C/4
3. TONINHO — GAS 500 ML C/12
4. TONINHO — 437 ML C/12
5. TONINHO — GARRAFÃO 20 LT
6. STARGAS — GARRAFÃO 20 LT
7. STARGAS — GARRAFÃO 20 LT

Vasilhames permanecem como linhas independentes.
