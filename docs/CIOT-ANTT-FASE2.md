# CIOT / ANTT — Fase 2

Implementado conforme o DCS PEF v1.1:

- diagnóstico mTLS do certificado A1;
- consulta de situação do transportador;
- consulta de frota por placa;
- consulta de exceção;
- preparação e validação do payload `DeclaracaoOperacaoTransporte`;
- emissão em homologação/produção controlada por variável de ambiente;
- consulta do CIOT gerado;
- retificação;
- cancelamento;
- encerramento;
- persistência dos retornos no `payloadAntt`;
- campos complementares na tela de geração.

## Atenção ao ID da operação

O DCS exige que `IdOperacaoTransporte` seja um identificador oficial de 12 dígitos gerado conforme o padrão da ANTT, por meio da biblioteca/executável oficial. O sistema não usa mais o `idSequencial` interno como se fosse o identificador oficial. Enquanto um gerador oficial não estiver integrado ao servidor/agente Windows, o campo deve ser informado na conferência do CIOT e a emissão permanece bloqueada quando estiver ausente.

## Ativação segura

Mantenha inicialmente:

```env
ANTT_CIOT_ENVIRONMENT=homologacao
ANTT_CIOT_ENABLE_NETWORK=false
```

Preencha os campos complementares, valide o payload e depois habilite apenas em homologação:

```env
ANTT_CIOT_ENABLE_NETWORK=true
```

Não altere para produção antes de concluir os testes de declaração, consulta, retificação, cancelamento e encerramento.
