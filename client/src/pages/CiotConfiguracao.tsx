import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleOff,
  FileKey2,
  LoaderCircle,
  RadioTower,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  Truck,
} from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { useEmpresa, useVeiculos } from "@/lib/store";
import { toast } from "sonner";

type ConfigurationResponse = {
  company: {
    id: string;
    razaoSocial: string;
    nomeFantasia?: string | null;
    cnpj: string;
    rntrc: string;
    certificateConfigured: boolean;
    passwordConfigured: boolean;
    certificateValidity: string | null;
    active: boolean;
    default: boolean;
  };
  integration: {
    environment: "homologacao" | "producao";
    baseUrl: string;
    networkEnabled: boolean;
    timeoutMs: number;
  };
  certificate: { ok: boolean; message: string };
};

type DiagnosticResponse = {
  ok: boolean;
  message?: string;
  local?: Record<string, unknown>;
  antt?: unknown;
};

type TestResult = {
  title: string;
  ok: boolean;
  message: string;
  details?: unknown;
};

function formatDate(value?: string | null) {
  if (!value) return "Não informada";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR");
}

function ResultCard({ result }: { result: TestResult }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        result.ok
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-destructive/30 bg-destructive/5"
      }`}
    >
      <div className="flex items-start gap-3">
        {result.ok ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
        ) : (
          <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{result.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{result.message}</p>
          {result.details !== undefined && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                Ver retorno técnico
              </summary>
              <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-muted p-3 text-xs">
                {JSON.stringify(result.details, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CiotConfiguracaoPage() {
  const { items: empresas } = useEmpresa();
  const { items: veiculos } = useVeiculos();
  const defaultCompany = useMemo(
    () => empresas.find((item) => item.empresaPadrao) ?? empresas.find((item) => item.ativa),
    [empresas],
  );
  const [empresaId, setEmpresaId] = useState("");
  const selectedCompanyId = empresaId || defaultCompany?.id || "";
  const [configuration, setConfiguration] = useState<ConfigurationResponse | null>(null);
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  const upsertResult = (result: TestResult) => {
    setResults((current) => [result, ...current.filter((item) => item.title !== result.title)]);
  };

  const requireCompany = () => {
    if (!selectedCompanyId) {
      toast.error("Cadastre ou selecione uma empresa antes de testar a integração.");
      return false;
    }
    return true;
  };

  const loadConfiguration = async () => {
    if (!requireCompany()) return;
    setLoading("config");
    try {
      const response = await api.get<ConfigurationResponse>("/ciots/antt/configuracao", {
        params: { empresaId: selectedCompanyId },
      });
      setConfiguration(response.data);
      toast.success("Configuração ANTT carregada.");
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? "Não foi possível carregar a configuração ANTT.");
    } finally {
      setLoading(null);
    }
  };

  const testCertificate = async () => {
    if (!requireCompany()) return;
    setLoading("certificate");
    try {
      const response = await api.get<{ ok: boolean; message: string; validity?: string | null }>(
        "/ciots/antt/certificado",
        { params: { empresaId: selectedCompanyId } },
      );
      upsertResult({
        title: "Certificado A1",
        ok: response.data.ok,
        message: `${response.data.message}${response.data.validity ? ` Validade: ${formatDate(response.data.validity)}.` : ""}`,
        details: response.data,
      });
    } catch (error: any) {
      upsertResult({
        title: "Certificado A1",
        ok: false,
        message: error?.response?.data?.message ?? "Falha ao validar o certificado A1.",
        details: error?.response?.data,
      });
    } finally {
      setLoading(null);
    }
  };

  const testConnection = async () => {
    if (!requireCompany()) return;
    setLoading("connection");
    try {
      const response = await api.get<DiagnosticResponse>("/ciots/antt/diagnostico", {
        params: { empresaId: selectedCompanyId },
        timeout: 90_000,
      });
      const networkEnabled = Boolean((response.data.local as any)?.networkEnabled);
      upsertResult({
        title: "Conexão ANTT / RNTRC",
        ok: response.data.ok,
        message:
          response.data.message ??
          (networkEnabled
            ? "Comunicação com o ambiente ANTT concluída."
            : "Validação local concluída; as chamadas externas estão desativadas no servidor."),
        details: response.data,
      });
    } catch (error: any) {
      upsertResult({
        title: "Conexão ANTT / RNTRC",
        ok: false,
        message: error?.response?.data?.message ?? "A comunicação com a ANTT falhou.",
        details: error?.response?.data,
      });
    } finally {
      setLoading(null);
    }
  };

  const testFleet = async () => {
    if (!requireCompany()) return;
    const placas = veiculos.map((item) => item.placa).filter(Boolean);
    if (!placas.length) {
      toast.error("Nenhum veículo cadastrado para consultar.");
      return;
    }
    setLoading("fleet");
    try {
      const response = await api.post(
        "/ciots/antt/frota",
        { empresaId: selectedCompanyId, placas },
        { timeout: 90_000 },
      );
      upsertResult({
        title: "Frota ANTT",
        ok: true,
        message: `${placas.length} placa(s) enviada(s) para consulta da frota.`,
        details: response.data,
      });
    } catch (error: any) {
      upsertResult({
        title: "Frota ANTT",
        ok: false,
        message: error?.response?.data?.message ?? "Não foi possível consultar a frota.",
        details: error?.response?.data,
      });
    } finally {
      setLoading(null);
    }
  };

  const config = configuration;
  const certificateExpired = config?.company.certificateValidity
    ? new Date(config.company.certificateValidity).getTime() < Date.now()
    : false;

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold">Configuração ANTT</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Valide o certificado, ambiente, RNTRC e frota antes de emitir CIOTs.
            </p>
          </div>
          <Button variant="outline" onClick={loadConfiguration} disabled={loading !== null}>
            {loading === "config" ? (
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Atualizar diagnóstico
          </Button>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-2">
              <Label>Empresa transportadora</Label>
              <Select value={selectedCompanyId} onValueChange={(value) => { setEmpresaId(value); setConfiguration(null); setResults([]); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((empresa) => (
                    <SelectItem key={empresa.id} value={empresa.id}>
                      {empresa.nomeFantasia || empresa.razaoSocial} — {empresa.cnpj}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={loadConfiguration} disabled={!selectedCompanyId || loading !== null}>
              Carregar
            </Button>
          </div>
        </div>

        {config && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><FileKey2 className="h-4 w-4" /> Certificado</div>
              <p className="mt-2 font-semibold">{config.certificate.ok && !certificateExpired ? "Válido" : "Com problema"}</p>
              <p className="mt-1 text-xs text-muted-foreground">Validade: {formatDate(config.company.certificateValidity)}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4" /> RNTRC</div>
              <p className="mt-2 font-semibold">{config.company.rntrc || "Não informado"}</p>
              <p className="mt-1 text-xs text-muted-foreground">CNPJ: {config.company.cnpj}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><ServerCog className="h-4 w-4" /> Ambiente</div>
              <p className="mt-2 font-semibold capitalize">{config.integration.environment}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{config.integration.baseUrl}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><RadioTower className="h-4 w-4" /> Rede externa</div>
              <p className="mt-2 font-semibold">{config.integration.networkEnabled ? "Habilitada" : "Desabilitada"}</p>
              <p className="mt-1 text-xs text-muted-foreground">Timeout: {config.integration.timeoutMs / 1000}s</p>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <Button className="h-auto min-h-24 flex-col gap-2" variant="outline" onClick={testCertificate} disabled={loading !== null || !selectedCompanyId}>
            {loading === "certificate" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <FileKey2 className="h-5 w-5" />}
            Testar certificado A1
          </Button>
          <Button className="h-auto min-h-24 flex-col gap-2" variant="outline" onClick={testConnection} disabled={loading !== null || !selectedCompanyId}>
            {loading === "connection" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <RadioTower className="h-5 w-5" />}
            Testar conexão e RNTRC
          </Button>
          <Button className="h-auto min-h-24 flex-col gap-2" variant="outline" onClick={testFleet} disabled={loading !== null || !selectedCompanyId}>
            {loading === "fleet" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Truck className="h-5 w-5" />}
            Consultar frota ({veiculos.length})
          </Button>
        </div>

        {!config?.integration.networkEnabled && (
          <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <CircleOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">Chamadas externas desativadas</p>
              <p className="mt-1 text-sm text-muted-foreground">
                O certificado pode ser validado localmente, mas consultas reais à ANTT só ocorrerão quando ANTT_CIOT_ENABLE_NETWORK estiver habilitado no servidor.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <h2 className="font-semibold">Resultados dos testes</h2>
          {results.length ? results.map((result) => <ResultCard key={result.title} result={result} />) : (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Execute um dos testes acima para visualizar o diagnóstico.
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
