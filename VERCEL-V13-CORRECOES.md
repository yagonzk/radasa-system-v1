# V13 - CORS + compatibilidade Neon

Correções aplicadas em 2026-08-11:

- Corrige erro 500 `Origem não permitida pelo CORS` nos endpoints de interpretação de romaneios.
- Aceita a origem configurada em `CLIENT_ORIGIN`, o mesmo host da requisição, aliases do projeto `radasa-system-v1` na Vercel e `radasa.com.br` / `www.radasa.com.br`.
- Uma origem recusada não é mais transformada em exceção 500 pelo middleware CORS.
- Inclui `NEON-COMPATIBILIDADE-V13.sql`, reunindo as correções de schema necessárias para login, clientes, produtos, `manifestos` e `manifesto_produtos` sem apagar registros.
- O diagnóstico final do SQL lista qualquer coluna ainda ausente. O resultado esperado é zero linhas.
