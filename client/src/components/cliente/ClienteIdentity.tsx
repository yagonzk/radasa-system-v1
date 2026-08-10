import type { Cliente } from "@/lib/store";

interface ClienteIdentityProps {
  cliente?: Cliente | null;
  align?: "left" | "right";
  className?: string;
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatDocument(value?: string) {
  const digits = onlyDigits(value ?? "");

  if (digits.length === 14) {
    return digits
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  if (digits.length === 11) {
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }

  return value?.trim() || "";
}

export default function ClienteIdentity({
  cliente,
  align = "left",
  className = "",
}: ClienteIdentityProps) {
  if (!cliente) {
    return (
      <span
        className={`text-sm text-muted-foreground ${
          align === "right" ? "text-right" : "text-left"
        } ${className}`}
      >
        Cliente não encontrado
      </span>
    );
  }

  const primaryName =
    cliente.nomeFantasia?.trim() ||
    cliente.razaoSocial?.trim() ||
    "Cliente sem nome";

  const secondaryName =
    cliente.nomeFantasia?.trim() && cliente.razaoSocial?.trim()
      ? cliente.razaoSocial.trim()
      : "";

  const document = formatDocument(cliente.cnpj);
  const internalCode = cliente.codigoInterno?.trim();

  return (
    <div
      className={`min-w-0 ${
        align === "right" ? "text-right" : "text-left"
      } ${className}`}
    >
      <p className="truncate font-medium">{primaryName}</p>

      {secondaryName && (
        <p className="truncate text-xs text-muted-foreground">
          {secondaryName}
        </p>
      )}

      {(document || internalCode) && (
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {[document, internalCode ? `Cód. ${internalCode}` : ""]
            .filter(Boolean)
            .join(" • ")}
        </p>
      )}
    </div>
  );
}
