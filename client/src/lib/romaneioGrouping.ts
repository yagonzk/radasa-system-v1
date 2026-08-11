export function isVasilhameName(value: unknown) {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, "");

  return (
    normalized.includes("VASILHAME") ||
    normalized.includes("VASILEAME") ||
    /^VASI[A-Z0-9]{2,8}AME/.test(normalized) ||
    /VASI[A-Z0-9]{0,5}H[A-Z0-9]{0,3}ME/.test(normalized)
  );
}

export type OrderedRomaneioEntry<T> = {
  item: T;
  originalIndex: number;
};

/**
 * Regra de exibição/gravação dos itens do romaneio:
 *
 * - VASILHAME nunca entra no agrupamento de carga. Cada linha de vasilhame
 *   continua sendo uma linha independente.
 * - Todo produto que NÃO é vasilhame deve ficar junto dos demais produtos do
 *   mesmo cliente, mesmo quando o PDF alterna o cliente entre as linhas.
 * - Os produtos não são somados nem mesclados. Apenas ficam contíguos, mantendo
 *   quantidade, preço, NF, cobrança e a ordem relativa das linhas daquele cliente.
 * - A ordem dos grupos é definida pela primeira aparição de cada cliente.
 *
 * originalIndex é preservado para que telas de edição possam atualizar/remover
 * a posição correta do array original mesmo exibindo a lista agrupada.
 */
export function orderRomaneioItemsByClient<T>(
  items: readonly T[],
  getClientKey: (item: T, index: number) => unknown,
  getProductName: (item: T, index: number) => unknown,
): OrderedRomaneioEntry<T>[] {
  const result: OrderedRomaneioEntry<T>[] = [];
  const groupedClients = new Set<string>();

  const clientKeyAt = (item: T, index: number) => {
    const raw = String(getClientKey(item, index) ?? "").trim();
    return raw || `__SEM_CLIENTE_${index}`;
  };

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];

    if (isVasilhameName(getProductName(item, index))) {
      result.push({ item, originalIndex: index });
      continue;
    }

    const clientKey = clientKeyAt(item, index);
    if (groupedClients.has(clientKey)) continue;
    groupedClients.add(clientKey);

    for (let candidateIndex = index; candidateIndex < items.length; candidateIndex += 1) {
      const candidate = items[candidateIndex];
      if (isVasilhameName(getProductName(candidate, candidateIndex))) continue;
      if (clientKeyAt(candidate, candidateIndex) !== clientKey) continue;
      result.push({ item: candidate, originalIndex: candidateIndex });
    }
  }

  return result;
}
