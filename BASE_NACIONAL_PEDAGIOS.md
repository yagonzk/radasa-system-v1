# Base nacional local de pedágios

A tela **PEDÁGIOS** não consome API comercial por consulta.

## Como funciona

1. O navegador calcula a rota com OSRM/OpenStreetMap.
2. O backend recebe a geometria da rota.
3. A geometria é cruzada com a base local `LOCAL_TOLL_PLAZAS`.
4. Praças com tarifa validada são calculadas pelo número de eixos.
5. Praças conhecidas sem tarifa validada aparecem como **Tarifa pendente** e não entram no total, evitando inventar valores.

## Atualizar as localizações nacionais

Execute na raiz do projeto:

`ATUALIZAR_PEDAGIOS_BRASIL.bat`

ou:

`pnpm pedagios:atualizar`

O atualizador usa gratuitamente:

- Portal de Dados Abertos da ANTT, para praças de rodovias federais concedidas;
- OpenStreetMap/Overpass, para complementar praças e pórticos Free Flow.

O resultado é gravado em `server/data/pedagios-nacional.generated.ts` e passa a fazer parte do bundle no próximo deploy. Nenhuma consulta de rota consome crédito.

## Tarifas

As tarifas confirmadas ficam em `server/data/pedagios-brasil.ts` com fonte e data. O sistema **não adivinha tarifa** para uma praça recém-descoberta. Isso é intencional, pois uma localização errada é inconveniente, mas uma tarifa inventada pode causar cálculo financeiro incorreto.

Fontes oficiais devem ser priorizadas: ANTT/concessionárias para concessões federais e agências/DERs estaduais para concessões estaduais.

## Tarifas federais automáticas

Na mesma atualização, o script tenta consultar as páginas públicas de **Tarifas de Pedágio** das concessões federais da ANTT e interpretar as tabelas de caminhões por eixo. Quando a tabela é reconhecida com segurança, a tarifa é gravada no snapshot local. Quando não é possível interpretar com segurança, a praça permanece cadastrada como **Tarifa pendente**, em vez de o sistema inventar um valor.

## Cobertura estadual

As praças estaduais e pórticos que existirem no OpenStreetMap entram como complemento de localização. Para tarifas estaduais, use entradas validadas em `server/data/pedagios-brasil.ts` com a fonte oficial do DER/agência/concessionária. A arquitetura já aceita quantas praças forem necessárias sem custo por cálculo.

## Cadastro manual persistente

A tela **PEDÁGIOS** possui o botão **Editar Pedágios**. Com o modo de edição aberto:

1. clique no mapa para definir latitude/longitude;
2. informe o nome da praça e o valor por eixo;
3. opcionalmente informe rodovia, km, cidade, UF e concessionária;
4. salve o cadastro.

Esses registros são gravados na tabela `pedagios` do PostgreSQL e têm prioridade sobre registros automáticos próximos. Atualizações da base ANTT/OSM não apagam nem substituem correções manuais.

O snapshot incluído nesta versão foi obtido do conjunto **Praça de Pedágio** da ANTT, com última atualização informada em 29/07/2026, e contém 277 registros ativos com coordenadas válidas.

Após atualizar esta versão em uma instalação já existente, aplique as migrations com `pnpm db:deploy` para criar a tabela `pedagios`.
