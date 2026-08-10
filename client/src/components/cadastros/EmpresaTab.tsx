import { useMemo, useRef, useState, type ReactNode } from "react";
import { Building2, FileKey2, LoaderCircle, Plus, Search, ShieldCheck } from "lucide-react";
import { useEmpresa, type Empresa } from "@/lib/store";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import DataTable from "./DataTable";
import { toast } from "sonner";

interface CnpjLookupResponse {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  inscricaoEstadual: string;
  email: string;
  telefone: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  situacaoCadastral: string;
  dataAbertura: string;
  naturezaJuridica: string;
  atividadePrincipal: string;
}

interface FormState {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual: string;
  rntrc: string;
  antt: string;
  email: string;
  telefone: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  certificadoArquivo: string;
  certificadoSenha: string;
  certificadoValidade: string;
  ativa: boolean;
  empresaPadrao: boolean;
}

const emptyForm: FormState = {
  razaoSocial: "",
  nomeFantasia: "",
  cnpj: "",
  inscricaoEstadual: "",
  rntrc: "",
  antt: "",
  email: "",
  telefone: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  certificadoArquivo: "",
  certificadoSenha: "",
  certificadoValidade: "",
  ativa: true,
  empresaPadrao: false,
};

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

function formatCep(value: string) {
  return onlyDigits(value)
    .slice(0, 8)
    .replace(/^(\d{5})(\d)/, "$1-$2");
}

function isValidCnpj(value: string) {
  const cnpj = onlyDigits(value);

  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) {
    return false;
  }

  const calculateDigit = (length: 12 | 13) => {
    const weights =
      length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    const total = cnpj
      .slice(0, length)
      .split("")
      .reduce(
        (sum, number, index) => sum + Number(number) * weights[index],
        0,
      );

    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return (
    Number(cnpj[12]) === calculateDigit(12) &&
    Number(cnpj[13]) === calculateDigit(13)
  );
}

function certificateName(value?: string) {
  if (!value) return "Nenhum certificado";

  if (value.startsWith("data:")) {
    return "Certificado anexado";
  }

  return value.split(/[\\/]/).pop() || "Certificado anexado";
}

export default function EmpresaTab() {
  const { items, create, update, remove } = useEmpresa();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [consultingCnpj, setConsultingCnpj] = useState(false);
  const certificateInputRef = useRef<HTMLInputElement>(null);

  const filteredItems = useMemo(() => {
    const normalized = query
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLocaleLowerCase("pt-BR");

    if (!normalized) return items;

    return items.filter((item) =>
      [
        item.razaoSocial,
        item.nomeFantasia,
        item.cnpj,
        item.rntrc,
        item.cidade,
        item.uf,
      ]
        .filter(Boolean)
        .join(" ")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR")
        .includes(normalized),
    );
  }, [items, query]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    if (certificateInputRef.current) {
      certificateInputRef.current.value = "";
    }
    setOpen(true);
  };

  const handleOpenEdit = (item: Empresa) => {
    setEditingId(item.id);
    setForm({
      razaoSocial: item.razaoSocial || "",
      nomeFantasia: item.nomeFantasia || "",
      cnpj: item.cnpj || "",
      inscricaoEstadual: item.inscricaoEstadual || "",
      rntrc: item.rntrc || "",
      antt: item.antt || "",
      email: item.email || "",
      telefone: item.telefone || "",
      cep: item.cep || "",
      logradouro: item.logradouro || "",
      numero: item.numero || "",
      complemento: item.complemento || "",
      bairro: item.bairro || "",
      cidade: item.cidade || "",
      uf: item.uf || "",
      certificadoArquivo: item.certificadoArquivo || "",
      certificadoSenha: "",
      certificadoValidade: item.certificadoValidade
        ? item.certificadoValidade.slice(0, 10)
        : "",
      ativa: item.ativa,
      empresaPadrao: item.empresaPadrao,
    });

    if (certificateInputRef.current) {
      certificateInputRef.current.value = "";
    }

    setOpen(true);
  };

  const handleConsultCnpj = async () => {
    const cnpj = onlyDigits(form.cnpj);

    if (cnpj.length !== 14 || !isValidCnpj(cnpj)) {
      toast.error("Informe um CNPJ válido antes de consultar.");
      return;
    }

    setConsultingCnpj(true);

    try {
      const { data } = await api.get<CnpjLookupResponse>(`/cnpj/${cnpj}`);

      setForm((current) => ({
        ...current,
        cnpj: data.cnpj || current.cnpj,
        razaoSocial: data.razaoSocial || current.razaoSocial,
        nomeFantasia: data.nomeFantasia || current.nomeFantasia,
        inscricaoEstadual:
          data.inscricaoEstadual || current.inscricaoEstadual,
        email: data.email || current.email,
        telefone: data.telefone || current.telefone,
        cep: data.cep || current.cep,
        logradouro: data.logradouro || current.logradouro,
        numero: data.numero || current.numero,
        complemento: data.complemento || current.complemento,
        bairro: data.bairro || current.bairro,
        cidade: data.cidade || current.cidade,
        uf: data.uf || current.uf,
      }));

      const details = [
        data.situacaoCadastral
          ? `Situação: ${data.situacaoCadastral}`
          : "",
        data.atividadePrincipal
          ? `Atividade: ${data.atividadePrincipal}`
          : "",
      ]
        .filter(Boolean)
        .join(" • ");

      toast.success(
        details
          ? `Empresa encontrada. ${details}`
          : "Empresa encontrada e formulário preenchido.",
      );
    } catch (error: any) {
      console.error(error);
      toast.error(
        error?.response?.data?.message ||
          "Não foi possível consultar este CNPJ.",
      );
    } finally {
      setConsultingCnpj(false);
    }
  };

  const handleCertificate = async (file?: File) => {
    if (!file) return;

    if (!/\.(pfx|p12)$/i.test(file.name)) {
      toast.error("Selecione um certificado no formato .pfx ou .p12.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("O certificado deve possuir no máximo 5 MB.");
      return;
    }

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Falha ao ler o certificado."));
      reader.readAsDataURL(file);
    });

    setForm((current) => ({
      ...current,
      certificadoArquivo: base64,
    }));

    toast.success(`${file.name} anexado.`);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;

    const cnpj = onlyDigits(form.cnpj);

    if (!form.razaoSocial.trim()) {
      toast.error("Informe a razão social.");
      return;
    }

    if (!isValidCnpj(cnpj)) {
      toast.error("Informe um CNPJ válido.");
      return;
    }

    if (
      items.some(
        (item) =>
          item.id !== editingId && onlyDigits(item.cnpj || "") === cnpj,
      )
    ) {
      toast.error("Já existe uma empresa cadastrada com este CNPJ.");
      return;
    }

    const payload = {
      ...form,
      cnpj,
      cep: onlyDigits(form.cep),
      uf: form.uf.toUpperCase(),
      certificadoSenha:
        form.certificadoSenha || undefined,
      certificadoValidade:
        form.certificadoValidade || undefined,
    };

    setSaving(true);

    try {
      if (form.empresaPadrao) {
        const currentDefault = items.find(
          (item) => item.empresaPadrao && item.id !== editingId,
        );

        if (currentDefault) {
          await update(currentDefault.id, { empresaPadrao: false });
        }
      }

      if (editingId) {
        await update(editingId, payload);
        toast.success("Empresa atualizada com sucesso.");
      } else {
        await create(payload);
        toast.success("Empresa cadastrada com sucesso.");
      }

      setOpen(false);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message ?? "Não foi possível salvar a empresa.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: Empresa) => {
    if (item.empresaPadrao) {
      toast.error("A empresa padrão não pode ser excluída.");
      return;
    }

    try {
      await remove(item.id);
      toast.success("Empresa excluída.");
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível excluir a empresa.");
    }
  };

  const columns: {
    key: string;
    label: string;
    render?: (item: Empresa) => ReactNode;
  }[] = [
    {
      key: "razaoSocial",
      label: "Empresa",
      render: (item) => (
        <div className="flex min-w-56 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <p className="font-medium">{item.razaoSocial}</p>
            <p className="text-xs text-muted-foreground">
              {item.nomeFantasia || "Sem nome fantasia"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "cnpj",
      label: "CNPJ",
      render: (item) => formatCnpj(item.cnpj),
    },
    {
      key: "rntrc",
      label: "RNTRC",
      render: (item) => item.rntrc || "—",
    },
    {
      key: "cidade",
      label: "Localização",
      render: (item) =>
        item.cidade
          ? `${item.cidade}${item.uf ? `/${item.uf}` : ""}`
          : "—",
    },
    {
      key: "certificadoArquivo",
      label: "Certificado",
      render: (item) => (
        <div className="flex items-center gap-2">
          <FileKey2
            className={`h-4 w-4 ${
              item.certificadoArquivo
                ? "text-emerald-600"
                : "text-muted-foreground"
            }`}
          />
          <span>
            {item.certificadoArquivo
              ? "Configurado"
              : "Não configurado"}
          </span>
        </div>
      ),
    },
    {
      key: "empresaPadrao",
      label: "Situação",
      render: (item) => (
        <div className="flex flex-wrap gap-2">
          {item.empresaPadrao && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              Padrão
            </span>
          )}
          <span
            className={`rounded-full px-2 py-1 text-xs font-medium ${
              item.ativa
                ? "bg-blue-500/10 text-blue-700 dark:text-blue-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {item.ativa ? "Ativa" : "Inativa"}
          </span>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {items.length} empresa(s) cadastrada(s)
          </p>
          <p className="text-xs text-muted-foreground">
            A empresa padrão será utilizada como contratante no CIOT.
          </p>
        </div>

        <Button onClick={handleOpenCreate} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Nova Empresa
        </Button>
      </div>

      <div className="mb-4 rounded-xl border bg-card p-4">
        <div className="relative max-w-2xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar por razão social, fantasia, CNPJ, RNTRC ou cidade..."
            className="pl-9"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredItems}
        onEdit={handleOpenEdit}
        onDelete={handleDelete}
        emptyMessage="Nenhuma empresa cadastrada. Clique em 'Nova Empresa' para começar."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[94vh] w-[96vw] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Empresa" : "Nova Empresa"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Section title="Dados cadastrais">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Razão Social">
                  <Input
                    value={form.razaoSocial}
                    onChange={(event) =>
                      setForm({ ...form, razaoSocial: event.target.value })
                    }
                    placeholder="Nome empresarial completo"
                  />
                </FormField>

                <FormField label="Nome Fantasia">
                  <Input
                    value={form.nomeFantasia}
                    onChange={(event) =>
                      setForm({ ...form, nomeFantasia: event.target.value })
                    }
                    placeholder="Nome fantasia"
                  />
                </FormField>

                <FormField label="CNPJ">
                  <div className="flex gap-2">
                    <Input
                      value={formatCnpj(form.cnpj)}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          cnpj: onlyDigits(event.target.value).slice(0, 14),
                        })
                      }
                      placeholder="00.000.000/0000-00"
                      inputMode="numeric"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleConsultCnpj();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title="Consultar CNPJ"
                      aria-label="Consultar CNPJ"
                      disabled={
                        consultingCnpj || onlyDigits(form.cnpj).length !== 14
                      }
                      onClick={() => void handleConsultCnpj()}
                    >
                      {consultingCnpj ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Digite o CNPJ e clique na lupa para preencher os dados
                    encontrados automaticamente.
                  </p>
                </FormField>

                <FormField label="Inscrição Estadual">
                  <Input
                    value={form.inscricaoEstadual}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        inscricaoEstadual: event.target.value,
                      })
                    }
                  />
                </FormField>

                <FormField label="RNTRC">
                  <Input
                    value={form.rntrc}
                    onChange={(event) =>
                      setForm({ ...form, rntrc: event.target.value })
                    }
                    placeholder="Registro Nacional de Transportadores"
                  />
                </FormField>

                <FormField label="ANTT">
                  <Input
                    value={form.antt}
                    onChange={(event) =>
                      setForm({ ...form, antt: event.target.value })
                    }
                  />
                </FormField>

                <FormField label="E-mail">
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm({ ...form, email: event.target.value })
                    }
                    placeholder="empresa@exemplo.com"
                  />
                </FormField>

                <FormField label="Telefone">
                  <Input
                    value={form.telefone}
                    onChange={(event) =>
                      setForm({ ...form, telefone: event.target.value })
                    }
                    placeholder="(00) 00000-0000"
                  />
                </FormField>
              </div>
            </Section>

            <Section title="Endereço">
              <div className="grid gap-4 md:grid-cols-4">
                <FormField label="CEP">
                  <Input
                    value={formatCep(form.cep)}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        cep: onlyDigits(event.target.value).slice(0, 8),
                      })
                    }
                    placeholder="00000-000"
                  />
                </FormField>

                <div className="md:col-span-2">
                  <FormField label="Logradouro">
                    <Input
                      value={form.logradouro}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          logradouro: event.target.value,
                        })
                      }
                    />
                  </FormField>
                </div>

                <FormField label="Número">
                  <Input
                    value={form.numero}
                    onChange={(event) =>
                      setForm({ ...form, numero: event.target.value })
                    }
                  />
                </FormField>

                <div className="md:col-span-2">
                  <FormField label="Complemento">
                    <Input
                      value={form.complemento}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          complemento: event.target.value,
                        })
                      }
                    />
                  </FormField>
                </div>

                <FormField label="Bairro">
                  <Input
                    value={form.bairro}
                    onChange={(event) =>
                      setForm({ ...form, bairro: event.target.value })
                    }
                  />
                </FormField>

                <FormField label="Cidade">
                  <Input
                    value={form.cidade}
                    onChange={(event) =>
                      setForm({ ...form, cidade: event.target.value })
                    }
                  />
                </FormField>

                <FormField label="UF">
                  <Input
                    value={form.uf}
                    maxLength={2}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        uf: event.target.value
                          .replace(/[^a-zA-Z]/g, "")
                          .toUpperCase()
                          .slice(0, 2),
                      })
                    }
                  />
                </FormField>
              </div>
            </Section>

            <Section title="Certificado Digital">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <FormField label="Arquivo .PFX ou .P12">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => certificateInputRef.current?.click()}
                      >
                        <FileKey2 className="mr-2 h-4 w-4" />
                        Selecionar certificado
                      </Button>

                      <span className="text-sm text-muted-foreground">
                        {certificateName(form.certificadoArquivo)}
                      </span>

                      <input
                        ref={certificateInputRef}
                        type="file"
                        accept=".pfx,.p12,application/x-pkcs12"
                        className="hidden"
                        onChange={(event) =>
                          void handleCertificate(event.target.files?.[0])
                        }
                      />
                    </div>
                  </FormField>
                </div>

                <FormField label="Validade">
                  <Input
                    type="date"
                    value={form.certificadoValidade}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        certificadoValidade: event.target.value,
                      })
                    }
                  />
                </FormField>

                <div className="md:col-span-2">
                  <FormField label="Senha do certificado">
                    <Input
                      type="password"
                      value={form.certificadoSenha}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          certificadoSenha: event.target.value,
                        })
                      }
                      placeholder={
                        editingId
                          ? "Deixe vazio para manter a senha atual"
                          : "Senha do certificado"
                      }
                    />
                  </FormField>
                </div>

                <div className="flex items-end">
                  <div className="flex w-full items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm">
                      {form.certificadoArquivo
                        ? "Certificado anexado"
                        : "Aguardando certificado"}
                    </span>
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Configurações">
              <div className="grid gap-3 md:grid-cols-2">
                <CheckboxField
                  checked={form.ativa}
                  onChange={(checked) =>
                    setForm({ ...form, ativa: checked })
                  }
                  label="Empresa ativa"
                  description="Permite utilizar esta empresa nas operações do sistema."
                />

                <CheckboxField
                  checked={form.empresaPadrao}
                  onChange={(checked) =>
                    setForm({ ...form, empresaPadrao: checked })
                  }
                  label="Empresa padrão"
                  description="Será utilizada automaticamente como contratante no CIOT."
                />
              </div>
            </Section>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>

              <Button type="submit" disabled={saving}>
                {saving
                  ? "Salvando..."
                  : editingId
                    ? "Salvar alterações"
                    : "Cadastrar empresa"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h3 className="mb-4 font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}

function CheckboxField({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition hover:bg-muted/30">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-border"
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-1 block text-xs text-muted-foreground">
          {description}
        </span>
      </span>
    </label>
  );
}
