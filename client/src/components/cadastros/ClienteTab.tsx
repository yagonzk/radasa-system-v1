import { useMemo, useRef, useState, type ReactNode } from "react";
import * as XLSX from "xlsx";
import { useClientes, type Cliente } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import DataTable from "./DataTable";
import { Plus, Building2, Upload, Download, FileSpreadsheet, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface FormState {
  nomeFantasia: string;
  razaoSocial: string;
  codigoInterno: string;
  cnpj: string;
  email: string;
  telefone: string;
  enderecoFiscal: string;
}

interface ImportRow extends FormState {
  rowNumber: number;
  status: "new" | "update" | "unchanged" | "invalid";
  existingId?: string;
  changes?: Partial<FormState>;
  error?: string;
}

const emptyForm: FormState = {
  nomeFantasia: "",
  razaoSocial: "",
  codigoInterno: "",
  cnpj: "",
  email: "",
  telefone: "",
  enderecoFiscal: "",
};

const HEADER_ALIASES: Record<keyof FormState, string[]> = {
  nomeFantasia: ["nome fantasia", "fantasia", "cliente", "nome"],
  razaoSocial: ["razão social", "razao social", "nome empresarial", "razão", "razao"],
  codigoInterno: [
    "codigo interno",
    "código interno",
    "codigo",
    "código",
    "cod cliente",
    "cod. cliente",
    "codcliente",
  ],
  cnpj: ["cnpj", "cnpj cliente", "documento", "documento fiscal"],
  email: ["email", "e-mail", "correio eletrônico", "correio eletronico"],
  telefone: ["telefone", "fone", "celular", "whatsapp", "whats app"],
  enderecoFiscal: [
    "endereco fiscal",
    "endereço fiscal",
    "endereco",
    "endereço",
    "logradouro",
  ],
};

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatCnpj(value: string) {
  const digits = onlyDigits(value).slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function isValidCnpj(value: string) {
  const cnpj = onlyDigits(value);
  if (!cnpj) return true;
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

  const digit = (length: 12 | 13) => {
    const weights =
      length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const total = cnpj
      .slice(0, length)
      .split("")
      .reduce((sum, number, index) => sum + Number(number) * weights[index], 0);
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return Number(cnpj[12]) === digit(12) && Number(cnpj[13]) === digit(13);
}

function findValue(row: Record<string, unknown>, field: keyof FormState) {
  const aliases = HEADER_ALIASES[field].map(normalizeHeader);
  const key = Object.keys(row).find((item) => aliases.includes(normalizeHeader(item)));
  return key ? normalizeValue(row[key]) : "";
}


function normalizedEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizedCode(value: string) {
  return normalizeHeader(value);
}

function hasRecognizedColumns(row: Record<string, unknown>) {
  const headers = Object.keys(row).map(normalizeHeader);
  return Object.values(HEADER_ALIASES).some((aliases) =>
    aliases.map(normalizeHeader).some((alias) => headers.includes(alias)),
  );
}

function nonEmptyPatch(row: FormState): Partial<FormState> {
  return Object.fromEntries(
    Object.entries(row).filter(([, value]) => String(value ?? "").trim() !== ""),
  ) as Partial<FormState>;
}

function changedPatch(existing: Cliente, row: FormState): Partial<FormState> {
  const patch = nonEmptyPatch(row);
  return Object.fromEntries(
    Object.entries(patch).filter(([key, value]) => {
      const current = String(existing[key as keyof Cliente] ?? "").trim();
      const incoming = String(value ?? "").trim();
      if (key === "cnpj") return onlyDigits(current) !== onlyDigits(incoming);
      if (key === "email") return normalizedEmail(current) !== normalizedEmail(incoming);
      return current !== incoming;
    }),
  ) as Partial<FormState>;
}

function spreadsheetErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  if (normalized.includes("password") || normalized.includes("encrypted")) {
    return "A planilha está protegida por senha. Remova a proteção e tente novamente.";
  }
  if (normalized.includes("zip") || normalized.includes("corrupt")) {
    return "O arquivo parece estar corrompido ou não é um Excel válido.";
  }
  if (normalized.includes("unsupported") || normalized.includes("format")) {
    return "O formato da planilha é incompatível. Salve novamente como .xlsx ou .xls.";
  }
  return message
    ? `Erro ao ler a planilha: ${message}`
    : "Não foi possível ler a planilha.";
}

function normalizeSearch(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

export default function ClienteTab() {
  const { items, create, update, remove } = useClientes();
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalizeSearch(query).trim();
    if (!normalizedQuery) return items;
    return items.filter((item) => normalizeSearch([item.nomeFantasia,item.razaoSocial,item.codigoInterno,item.cnpj,item.email,item.telefone,item.enderecoFiscal].join(" ")).includes(normalizedQuery));
  }, [items, query]);

  const handleOpenCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setOpen(true);
  };

  const handleOpenImport = () => {
    setImportRows([]);
    setFileName("");
    setImportProgress({ current: 0, total: 0 });
    if (fileInputRef.current) fileInputRef.current.value = "";
    setImportOpen(true);
  };

  const handleOpenEdit = (item: Cliente) => {
    setForm({
      nomeFantasia: item.nomeFantasia,
      razaoSocial: item.razaoSocial || "",
      codigoInterno: item.codigoInterno,
      cnpj: item.cnpj || "",
      email: item.email,
      telefone: item.telefone,
      enderecoFiscal: item.enderecoFiscal,
    });
    setEditingId(item.id);
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const cnpj = onlyDigits(form.cnpj);
    if (cnpj && !isValidCnpj(cnpj)) {
      toast.error("Informe um CNPJ válido.");
      return;
    }

    if (
      cnpj &&
      items.some(
        (item) => item.id !== editingId && onlyDigits(item.cnpj || "") === cnpj,
      )
    ) {
      toast.error("Já existe um cliente cadastrado com este CNPJ.");
      return;
    }

    const payload = { ...form, cnpj };

    setSaving(true);
    try {
      if (editingId) {
        await update(editingId, payload);
        toast.success("Cliente atualizado com sucesso!");
      } else {
        await create(payload);
        toast.success("Cliente cadastrado com sucesso!");
      }
      setOpen(false);
    } catch (error: any) {
      console.error("Falha ao salvar cliente.", error);
      toast.error(error?.response?.data?.message ?? "Não foi possível salvar o cliente.");
    } finally {
      setSaving(false);
    }
  };

  const downloadTemplate = () => {
    const worksheet = XLSX.utils.json_to_sheet([
      {
        "Nome Fantasia": "Cliente Exemplo",
        "Razão Social": "Cliente Exemplo Comércio e Serviços Ltda.",
        "Código Interno": "1001",
        CNPJ: "15.209.274/0001-62",
        Email: "cliente@exemplo.com",
        Telefone: "(65) 99999-9999",
        "Endereço Fiscal": "Rua Exemplo, 123 - Cuiabá/MT",
      },
    ]);
    worksheet["!cols"] = [
      { wch: 30 },
      { wch: 40 },
      { wch: 18 },
      { wch: 22 },
      { wch: 30 },
      { wch: 20 },
      { wch: 45 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Clientes");
    XLSX.writeFile(workbook, "modelo-importacao-clientes.xlsx");
  };

  const handleFile = async (file?: File) => {
    if (!file) return;

    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      toast.error("Selecione uma planilha Excel no formato .xlsx ou .xls.");
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, {
        type: "array",
        cellDates: false,
        dense: true,
      });

      if (!workbook.SheetNames.length) {
        toast.error("Nenhuma aba foi encontrada na planilha.");
        return;
      }

      let rawRows: Record<string, unknown>[] = [];
      let selectedSheet = "";

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
          raw: false,
          blankrows: false,
        });

        if (rows.length && rows.some(hasRecognizedColumns)) {
          rawRows = rows;
          selectedSheet = sheetName;
          break;
        }
      }

      if (!rawRows.length) {
        toast.error(
          "Não foi possível localizar uma aba com colunas reconhecidas. Use Nome Fantasia, Razão Social, CNPJ, Código, E-mail, Telefone ou Endereço.",
        );
        return;
      }

      const byCnpj = new Map(
        items
          .filter((item) => onlyDigits(item.cnpj || ""))
          .map((item) => [onlyDigits(item.cnpj || ""), item]),
      );
      const byCode = new Map(
        items
          .filter((item) => normalizedCode(item.codigoInterno))
          .map((item) => [normalizedCode(item.codigoInterno), item]),
      );
      const byEmail = new Map(
        items
          .filter((item) => normalizedEmail(item.email || ""))
          .map((item) => [normalizedEmail(item.email || ""), item]),
      );

      const parsed: ImportRow[] = [];
      const rowsByIdentity = new Map<string, number>();

      rawRows.forEach((raw, index) => {
        const row: FormState = {
          nomeFantasia: findValue(raw, "nomeFantasia"),
          razaoSocial: findValue(raw, "razaoSocial"),
          codigoInterno: findValue(raw, "codigoInterno"),
          cnpj: onlyDigits(findValue(raw, "cnpj")),
          email: findValue(raw, "email"),
          telefone: findValue(raw, "telefone"),
          enderecoFiscal: findValue(raw, "enderecoFiscal"),
        };

        const rowNumber = index + 2;
        const code = normalizedCode(row.codigoInterno);
        const cnpj = onlyDigits(row.cnpj);
        const email = normalizedEmail(row.email);
        const errors: string[] = [];

        if (row.cnpj && !isValidCnpj(row.cnpj)) errors.push("CNPJ inválido");
        if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
          errors.push("E-mail inválido");
        }

        const existing =
          (cnpj ? byCnpj.get(cnpj) : undefined) ??
          (code ? byCode.get(code) : undefined) ??
          (email ? byEmail.get(email) : undefined);

        if (!existing && !row.nomeFantasia) {
          errors.push("Nome Fantasia obrigatório para novo cliente");
        }
        if (!existing && !row.codigoInterno) {
          errors.push("Código Interno obrigatório para novo cliente");
        }
        if (!existing && !cnpj && !code && !email) {
          errors.push("Informe CNPJ, Código Interno ou E-mail");
        }

        if (errors.length) {
          parsed.push({
            ...row,
            rowNumber,
            status: "invalid",
            error: errors.join("; "),
          });
          return;
        }

        if (existing) {
          const patch = changedPatch(existing, row);
          parsed.push({
            ...row,
            rowNumber,
            existingId: existing.id,
            changes: patch,
            status: Object.keys(patch).length ? "update" : "unchanged",
          });
          return;
        }

        // Linhas repetidas dentro da própria planilha são mescladas.
        const identity = cnpj
          ? `cnpj:${cnpj}`
          : code
            ? `code:${code}`
            : `email:${email}`;

        const previousIndex = rowsByIdentity.get(identity);
        if (previousIndex !== undefined) {
          const previous = parsed[previousIndex];
          const merged = {
            ...previous,
            ...Object.fromEntries(
              Object.entries(row).filter(([, value]) => String(value).trim() !== ""),
            ),
          } as ImportRow;
          parsed[previousIndex] = merged;
          return;
        }

        rowsByIdentity.set(identity, parsed.length);
        parsed.push({
          ...row,
          rowNumber,
          status: "new",
        });
      });

      setFileName(`${file.name} — aba: ${selectedSheet}`);
      setImportRows(parsed);
      setImportProgress({ current: 0, total: 0 });
      toast.success(`${parsed.length} cliente(s) analisado(s).`);
    } catch (error) {
      console.error(error);
      toast.error(spreadsheetErrorMessage(error));
    }
  };

  const handleImport = async () => {
    const actionable = importRows.filter(
      (row) => row.status === "new" || row.status === "update",
    );

    if (!actionable.length) {
      toast.error("Não existem clientes novos ou alterações para sincronizar.");
      return;
    }

    setImporting(true);
    setImportProgress({ current: 0, total: actionable.length });

    let created = 0;
    let updated = 0;
    let failed = 0;

    for (let index = 0; index < actionable.length; index += 1) {
      const row = actionable[index];

      try {
        if (row.status === "update" && row.existingId) {
          await Promise.resolve(update(row.existingId, row.changes ?? {}));
          updated += 1;
        } else {
          await Promise.resolve(
            create({
              nomeFantasia: row.nomeFantasia,
              razaoSocial: row.razaoSocial,
              codigoInterno: row.codigoInterno,
              cnpj: onlyDigits(row.cnpj),
              email: row.email,
              telefone: row.telefone,
              enderecoFiscal: row.enderecoFiscal,
            }),
          );
          created += 1;
        }
      } catch (error) {
        console.error(`Erro na linha ${row.rowNumber}:`, error);
        failed += 1;
      } finally {
        setImportProgress({ current: index + 1, total: actionable.length });
        if ((index + 1) % 25 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
    }

    setImporting(false);

    const unchanged = importRows.filter((row) => row.status === "unchanged").length;
    const invalid = importRows.filter((row) => row.status === "invalid").length;

    toast.success(
      `${created} criado(s), ${updated} atualizado(s), ${unchanged} sem alteração, ${invalid + failed} com erro.`,
    );

    if (!failed) setImportOpen(false);
  };

  const newCount = importRows.filter((row) => row.status === "new").length;
  const updateCount = importRows.filter((row) => row.status === "update").length;
  const unchangedCount = importRows.filter((row) => row.status === "unchanged").length;
  const invalidCount = importRows.filter((row) => row.status === "invalid").length;
  const actionableCount = newCount + updateCount;

  const columns: { key: string; label: string; render?: (item: Cliente) => ReactNode }[] = [
    {
      key: "nomeFantasia",
      label: "Nome Fantasia",
      render: (item: Cliente) => (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
            <Building2 className="h-4 w-4" />
          </div>
          <span className="font-medium">{item.nomeFantasia || "—"}</span>
        </div>
      ),
    },
    {
      key: "razaoSocial",
      label: "Razão Social",
      render: (item: Cliente) => item.razaoSocial || "—",
    },
    { key: "codigoInterno", label: "Código Interno" },
    {
      key: "cnpj",
      label: "CNPJ",
      render: (item: Cliente) => item.cnpj ? formatCnpj(item.cnpj) : "—",
    },
    { key: "email", label: "Email" },
    { key: "telefone", label: "Telefone" },
    { key: "enderecoFiscal", label: "Endereço Fiscal" },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{items.length} cliente(s) cadastrado(s)</p>
          <div className="flex items-center gap-2">
          <Button onClick={handleOpenImport} size="sm" variant="outline">
            <Upload className="mr-1.5 h-4 w-4" />
            Importar
          </Button>
          <Button onClick={handleOpenCreate} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            Novo Cliente
          </Button>
          </div>
        </div>
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar por nome, razão social, código, CNPJ, e-mail, telefone ou endereço..." />
      </div>

      <DataTable
        columns={columns}
        data={filteredItems}
        onEdit={handleOpenEdit}
        onDelete={(item) => remove(item.id)}
        emptyMessage="Nenhum cliente encontrado para a pesquisa informada."
      />

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar clientes por Excel</DialogTitle>
            <DialogDescription>
              Clientes existentes são encontrados por CNPJ, Código Interno ou E-mail.
              Somente células preenchidas atualizam o cadastro; células vazias preservam os dados atuais.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={downloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Baixar modelo
              </Button>
              <Button type="button" onClick={() => fileInputRef.current?.click()}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Selecionar planilha
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={(event) => void handleFile(event.target.files?.[0])}
              />
              {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
            </div>

            {!!importRows.length && (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border p-3">
                    <p className="text-sm text-muted-foreground">Novos</p>
                    <p className="text-2xl font-semibold text-emerald-600">{newCount}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-sm text-muted-foreground">Serão atualizados</p>
                    <p className="text-2xl font-semibold text-blue-600">{updateCount}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-sm text-muted-foreground">Sem alterações</p>
                    <p className="text-2xl font-semibold text-amber-600">{unchangedCount}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-sm text-muted-foreground">Com erro</p>
                    <p className="text-2xl font-semibold text-destructive">{invalidCount}</p>
                  </div>
                </div>

                <div className="max-h-[420px] overflow-auto rounded-md border">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th className="p-2 text-left">Linha</th>
                        <th className="p-2 text-left">Nome Fantasia</th>
                        <th className="p-2 text-left">Razão Social</th>
                        <th className="p-2 text-left">Código</th>
                        <th className="p-2 text-left">E-mail</th>
                        <th className="p-2 text-left">Telefone</th>
                        <th className="p-2 text-left">Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.slice(0, 200).map((row) => (
                        <tr key={`${row.rowNumber}-${row.codigoInterno}`} className="border-t">
                          <td className="p-2">{row.rowNumber}</td>
                          <td className="p-2">{row.nomeFantasia || "—"}</td>
                          <td className="p-2">{row.razaoSocial || "—"}</td>
                          <td className="p-2">{row.codigoInterno || "—"}</td>
                          <td className="p-2">{row.email || "—"}</td>
                          <td className="p-2">{row.telefone || "—"}</td>
                          <td className="p-2">
                            {row.status === "new" && (
                              <span className="text-emerald-600">Novo cliente</span>
                            )}
                            {row.status === "update" && (
                              <span className="text-blue-600">
                                Atualizar: {Object.keys(row.changes ?? {}).join(", ")}
                              </span>
                            )}
                            {row.status === "unchanged" && (
                              <span className="text-amber-600">Sem alterações</span>
                            )}
                            {row.status === "invalid" && (
                              <span className="text-destructive">{row.error}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importRows.length > 200 && (
                  <p className="text-xs text-muted-foreground">
                    A prévia mostra as primeiras 200 linhas. Todas as linhas válidas serão importadas.
                  </p>
                )}
              </>
            )}
          </div>

          {importing && importProgress.total > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Sincronizando clientes...</span>
                <span>
                  {importProgress.current} / {importProgress.total}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${Math.round(
                      (importProgress.current / importProgress.total) * 100,
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!actionableCount || importing}
              onClick={() => void handleImport()}
            >
              {importing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                `Sincronizar ${actionableCount} cliente(s)`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Cliente" : "Novo Cliente"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Nome Fantasia">
                <Input
                  value={form.nomeFantasia}
                  onChange={(e) => setForm({ ...form, nomeFantasia: e.target.value })}
                  placeholder="Nome fantasia"
                />
              </FormField>
              <FormField label="Razão Social">
                <Input
                  value={form.razaoSocial}
                  onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })}
                  placeholder="Nome empresarial completo"
                />
              </FormField>
            </div>
            <FormField label="Código Interno">
              <Input
                value={form.codigoInterno}
                onChange={(e) => setForm({ ...form, codigoInterno: e.target.value })}
                placeholder="Ex: 1001"
              />
            </FormField>
            <FormField label="CNPJ">
              <Input
                value={formatCnpj(form.cnpj)}
                onChange={(e) =>
                  setForm({ ...form, cnpj: onlyDigits(e.target.value).slice(0, 14) })
                }
                placeholder="00.000.000/0000-00"
                inputMode="numeric"
                maxLength={18}
              />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Email">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </FormField>
              <FormField label="Telefone">
                <Input
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </FormField>
            </div>
            <FormField label="Endereço Fiscal">
              <Input
                value={form.enderecoFiscal}
                onChange={(e) => setForm({ ...form, enderecoFiscal: e.target.value })}
                placeholder="Endereço fiscal completo"
              />
            </FormField>
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}
