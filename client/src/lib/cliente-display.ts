import type { Cliente } from "@/lib/store";

export function formatClienteResumo(cliente: Cliente) {
  const nome =
    cliente.nomeFantasia?.trim() ||
    cliente.razaoSocial?.trim() ||
    "Cliente sem nome";

  const documento = cliente.cnpj?.trim();
  const codigo = cliente.codigoInterno?.trim();

  return [nome, documento, codigo ? `Cód. ${codigo}` : ""]
    .filter(Boolean)
    .join(" • ");
}

export function clienteSearchText(cliente: Cliente) {
  return [
    cliente.nomeFantasia,
    cliente.razaoSocial,
    cliente.codigoInterno,
    cliente.cnpj,
    cliente.email,
    cliente.telefone,
    cliente.enderecoFiscal,
  ]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
