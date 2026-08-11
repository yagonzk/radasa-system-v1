import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { Truck, Users, LayoutDashboard, Moon, Sun, ClipboardList, HandCoins, LogOut, KeyRound, ScrollText, Fuel, CircleDotDashed, Boxes, FileBadge2, ChevronDown, ChevronRight, FilePlus2, History, UserRound, Settings2, BadgeDollarSign, ScanText } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link, useLocation } from "wouter";
import { type ReactNode, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  matchPaths: string[];
}

const navItems: NavItem[] = [
  {
    label: "Visão geral",
    href: "/",
    icon: <LayoutDashboard className="h-[18px] w-[18px]" />,
    matchPaths: ["/"],
  },
  {
    label: "Cadastros",
    href: "/cadastros",
    icon: <Users className="h-[18px] w-[18px]" />,
    matchPaths: ["/cadastros"],
  },
  {
    label: "Viagens",
    href: "/viagens",
    icon: <Truck className="h-[18px] w-[18px]" />,
    matchPaths: ["/viagens"],
  },
  {
    label: "Pedágios",
    href: "/pedagios",
    icon: <BadgeDollarSign className="h-[18px] w-[18px]" />,
    matchPaths: ["/pedagios"],
  },
  {
    label: "Romaneios",
    href: "/romaneios",
    icon: <ClipboardList className="h-[18px] w-[18px]" />,
    matchPaths: ["/romaneios", "/manifestos"],
  },
  {
    label: "OCR",
    href: "/ocr",
    icon: <ScanText className="h-[18px] w-[18px]" />,
    matchPaths: ["/ocr"],
  },
  {
    label: "Comissões",
    href: "/fechamentos",
    icon: <HandCoins className="h-[18px] w-[18px]" />,
    matchPaths: ["/fechamentos"],
  },
  {
    label: "Abastecimento",
    href: "/abastecimentos",
    icon: <Fuel className="h-[18px] w-[18px]" />,
    matchPaths: ["/abastecimentos"],
  },
  {
    label: "Estoque",
    href: "/estoque",
    icon: <Boxes className="h-[18px] w-[18px]" />,
    matchPaths: ["/estoque"],
  },
  {
    label: "Pneus",
    href: "/pneus",
    icon: <CircleDotDashed className="h-[18px] w-[18px]" />,
    matchPaths: ["/pneus"],
  },
];

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [ciotOpen, setCiotOpen] = useState(() => location.startsWith("/ciot"));
  const isDark = theme === "dark";
  const initials = user?.name?.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "U";

  const isActive = (item: NavItem) =>
    item.matchPaths.some((p) =>
      p === "/" ? location === "/" : location.startsWith(p)
    );

  return (
    <div className={cn("flex min-h-screen bg-background", isDark && "dark")}>
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-30 flex h-screen w-[220px] flex-col border-r border-sidebar-border bg-sidebar shadow-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Truck className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-[14px] font-bold text-sidebar-foreground leading-tight">
            Radasa System
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-150",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <span className={cn("transition-colors", active ? "text-primary" : "text-muted-foreground")}>
                  {item.icon}
                </span>
                {item.label}
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
              </Link>
            );
          })}

          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setCiotOpen((current) => !current)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-150",
                location.startsWith("/ciot")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
              aria-expanded={ciotOpen}
            >
              <span
                className={cn(
                  "transition-colors",
                  location.startsWith("/ciot") ? "text-primary" : "text-muted-foreground",
                )}
              >
                <FileBadge2 className="h-[18px] w-[18px]" />
              </span>
              CIOT
              {ciotOpen ? (
                <ChevronDown className="ml-auto h-4 w-4" />
              ) : (
                <ChevronRight className="ml-auto h-4 w-4" />
              )}
            </button>

            {ciotOpen && (
              <div className="ml-4 space-y-1 border-l border-sidebar-border pl-3">
                <Link
                  href="/ciot/gerar"
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium transition-colors",
                    location.startsWith("/ciot/gerar")
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  )}
                >
                  <FilePlus2 className="h-4 w-4" />
                  Gerar CIOTs
                </Link>

                <Link
                  href="/ciot/gerados"
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium transition-colors",
                    location.startsWith("/ciot/gerados")
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  )}
                >
                  <History className="h-4 w-4" />
                  CIOTs gerados
                </Link>

                <Link
                  href="/ciot/configuracao"
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium transition-colors",
                    location.startsWith("/ciot/configuracao")
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  )}
                >
                  <Settings2 className="h-4 w-4" />
                  Configuração ANTT
                </Link>
              </div>
            )}
          </div>
        </nav>

        {/* User profile */}
        <div className="border-t border-sidebar-border px-4 py-4 bg-sidebar">
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xs font-bold text-primary-foreground transition hover:ring-2 hover:ring-primary/30" aria-label="Abrir opções do perfil">{user?.fotoPerfil ? <img src={user.fotoPerfil} alt="Foto de perfil" className="h-full w-full object-cover" /> : initials}</button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-48">
                <DropdownMenuItem asChild><Link href="/perfil" className="flex cursor-pointer items-center gap-2"><UserRound className="h-4 w-4"/>Meu perfil</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/alterar-senha" className="flex cursor-pointer items-center gap-2"><KeyRound className="h-4 w-4"/>Alterar senha</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/logs" className="flex cursor-pointer items-center gap-2"><ScrollText className="h-4 w-4"/>Ver logs</Link></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-sidebar-foreground">
                {user?.name}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                @{user?.username}
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
              aria-label="Sair da conta"
              title="Sair da conta"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="ml-[220px] flex min-h-screen flex-1 flex-col">
        <main className="flex-1 p-6 lg:p-8 min-h-0">{children}</main>

        {/* Footer with theme toggle */}
        <footer className="flex items-center justify-end px-6 py-3 lg:px-8 border-t border-border/50">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-accent-foreground hover:border-primary/30 active:scale-95"
            aria-label="Alternar tema"
            title={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
          >
            {isDark ? (
              <>
                <Sun className="h-3.5 w-3.5 text-amber-500" />
                <span>Modo claro</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5 text-slate-500" />
                <span>Modo escuro</span>
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
