import Layout from "@/components/Layout";
import { useMotoristas, useChapas, useClientes, useLocais, useProdutos, useRomaneios, usePneuGestao } from "@/lib/store";
import { Link } from "wouter";
import { Truck, Users, Building2, MapPin, ArrowRight, FileText, Package, ClipboardList, AlertTriangle } from "lucide-react";
import { useEffect } from "react";

export default function Dashboard() {
  const { items: motoristas } = useMotoristas();
  const { items: chapas } = useChapas();
  const { items: clientes } = useClientes();
  const { items: locais } = useLocais();
  const { items: produtos } = useProdutos();
  const { items: romaneios } = useRomaneios();
  const { alerts, loadAlerts } = usePneuGestao();
  useEffect(() => { void loadAlerts(); }, [loadAlerts]);

  const metrics = [
    {
      label: "MOTORISTAS",
      value: motoristas.length,
      icon: <Truck className="h-5 w-5" />,
      iconBg: "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
    },
    {
      label: "CHAPAS",
      value: chapas.length,
      icon: <Users className="h-5 w-5" />,
      iconBg: "bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400",
    },
    {
      label: "CLIENTES",
      value: clientes.length,
      icon: <Building2 className="h-5 w-5" />,
      iconBg: "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
    },
    {
      label: "PRODUTOS",
      value: produtos.length,
      icon: <Package className="h-5 w-5" />,
      iconBg: "bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400",
    },
    {
      label: "LOCAIS",
      value: locais.length,
      icon: <MapPin className="h-5 w-5" />,
      iconBg: "bg-yellow-100 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400",
    },
    {
      label: "ROMANEIOS",
      value: romaneios.length,
      icon: <ClipboardList className="h-5 w-5" />,
      iconBg: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400",
    },
  ];

  return (
    <Layout>
      <div className="mx-auto max-w-7xl">
        {/* Top section: Hero + Next step card */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
          {/* Hero */}
          <div className="rounded-2xl border border-border bg-card p-8">
            <span className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
              Visão administrativa
            </span>
            <h1 className="mt-4 font-display text-3xl font-bold leading-tight text-foreground lg:text-4xl">
              Comissões claras. Operação no ritmo certo.
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
              Centralize seus cadastros, organize cada rota, gerencie romaneios
              e prepare fechamentos de comissão com uma visão objetiva da operação.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/cadastros"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Gerenciar cadastros
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/romaneios"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Novo romaneio
              </Link>
              <Link
                href="/fechamentos"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Novo fechamento
              </Link>
            </div>
          </div>

          {/* Next step card (dark navy) */}
          <div className="relative overflow-hidden rounded-2xl bg-[#0A0E21] p-8">
            {/* Abstract shapes */}
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-blue-500/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-blue-400/10 blur-xl" />

            <p className="text-xs font-medium text-slate-400">Próximo passo</p>
            <h3 className="mt-3 font-display text-lg font-bold leading-snug text-white">
              Cadastre a operação antes de gerar o primeiro fechamento.
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Motoristas e locais são utilizados diretamente no cálculo da
              comissão.
            </p>
            <div className="mt-6 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-400" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                Ambiente administrativo
              </span>
            </div>
          </div>
        </div>

        {/* Metric cards */}
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="rounded-xl border border-border bg-card p-5"
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${m.iconBg}`}
              >
                {m.icon}
              </div>
              <p className="mt-4 font-display text-3xl font-bold text-foreground">
                {m.value}
              </p>
              <p className="mt-1 text-xs font-semibold tracking-wide text-muted-foreground">
                {m.label}
              </p>
            </div>
          ))}
        </div>

        {alerts.length > 0 && <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><AlertTriangle className="h-5 w-5 text-amber-500"/><div><h2 className="font-semibold">Alertas de pneus</h2><p className="text-sm text-muted-foreground">{alerts.length} alerta(s) precisam de atenção.</p></div></div><Link href="/pneus" className="text-sm font-semibold text-primary">Ver alertas</Link></div><div className="mt-3 grid gap-2 md:grid-cols-2">{alerts.slice(0,4).map(a=><div key={a.id} className="rounded-lg border bg-card p-3"><p className="text-sm font-medium">{a.title}</p><p className="text-xs text-muted-foreground">{a.detail}</p></div>)}</div></div>}

        {/* Fechamentos section */}
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-card p-8">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="max-w-md">
              <h2 className="font-display text-xl font-bold text-foreground">
                Fechamentos de comissão
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Quando os cadastros estiverem prontos, registre as viagens por
                local e selecione o intervalo de datas do fechamento.
              </p>
            </div>
            <Link
              href="/fechamentos"
              className="inline-flex items-center gap-2 rounded-lg bg-muted px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Ir para cálculo de comissão
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
