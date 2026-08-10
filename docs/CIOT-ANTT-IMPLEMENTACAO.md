# Integração CIOT / ANTT — base de homologação

Esta entrega cria a camada real de comunicação mTLS com certificado A1 e o gerador do leiaute DCS PEF v1.1.

## O que já funciona

- lê o PFX/P12 salvo em `Empresa.certificadoArquivo` (Data URL/Base64);
- usa a senha salva em `Empresa.certificadoSenha`;
- abre conexão HTTPS TLS 1.2 com autenticação mútua;
- valida configuração local e, quando habilitado, consulta a situação do transportador;
- converte o CIOT local para o formato `DeclaracaoOperacaoTransporte` do DCS v1.1;
- lista campos oficiais que ainda não estão no cadastro local;
- salva o payload oficial e as pendências em `payloadAntt`;
- bloqueia a emissão enquanto houver campos obrigatórios faltantes;
- possui rota de emissão em homologação;
- grava protocolo, CIOT, código verificador, mensagem e status retornados.

## Rotas adicionadas

- `GET /api/ciots/antt/diagnostico?empresaId=...`
- `POST /api/ciots/:id/antt/preparar`
- `POST /api/ciots/:id/antt/emitir`

O corpo de `preparar` e `emitir` aceita campos complementares:

```json
{
  "distanciaPercorrida": 850,
  "codigoMunicipioOrigem": 5100250,
  "codigoMunicipioDestino": 1503606,
  "codigoNaturezaCarga": 1234,
  "codigoTipoCarga": 5,
  "numeroEixos": 4,
  "tipoPagamento": 6,
  "cpfCnpjCreditado": "15209274000162",
  "chavePix": "...",
  "identificadorPix": "...",
  "indAltoDesempenho": false,
  "indRetornoVazio": false,
  "composicaoVeicular": false
}
```

## Ativação segura

1. Instale os arquivos e rode `pnpm exec tsc --noEmit`.
2. Mantenha `ANTT_CIOT_ENABLE_NETWORK=false`.
3. Cadastre uma empresa com CNPJ, RNTRC, certificado A1 e senha.
4. Gere um CIOT e clique em **Preparar emissão**.
5. Confira a lista `pendencias` no JSON.
6. Preencha os campos complementares faltantes.
7. Teste `GET /api/ciots/antt/diagnostico`.
8. Somente depois habilite `ANTT_CIOT_ENABLE_NETWORK=true` em homologação.
9. Nunca altere para produção antes da aprovação interna dos testes.

## Limitação desta entrega

O projeto atual não possui campos próprios para distância, código IBGE, código da natureza/tipo da carga, número de eixos e dados bancários completos. Por isso, a integração os recebe como campos complementares e recusa a emissão quando faltarem. A próxima fase é adicionar esses campos de forma visual ao wizard do CIOT.

A chamada real não foi executada aqui porque depende do certificado e da senha da Radasa, que não devem ser enviados pelo chat nem incluídos no Git.
