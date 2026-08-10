import { FormEvent, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Moon, Sun, Truck, User, Mail, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

function getApiMessage(error: any, fallback: string) {
  return error?.response?.data?.message || error?.response?.data?.error || fallback;
}

export default function Auth() {
  const { login, register } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loginData, setLoginData] = useState({ identifier: "", password: "" });
  const [registerData, setRegisterData] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await login(loginData.identifier, loginData.password);
      toast.success("Login realizado com sucesso.");
    } catch (error) {
      toast.error(getApiMessage(error, "Não foi possível entrar."));
    } finally {
      setSubmitting(false);
    }
  };

  const submitRegister = async (event: FormEvent) => {
    event.preventDefault();
    if (registerData.password !== registerData.confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setSubmitting(true);
    try {
      await register({
        name: registerData.name,
        username: registerData.username,
        email: registerData.email,
        password: registerData.password,
      });
      toast.success("Conta criada com sucesso.");
    } catch (error) {
      toast.error(getApiMessage(error, "Não foi possível criar sua conta."));
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "h-12 w-full rounded-xl border border-input bg-transparent pl-11 pr-10 text-sm shadow-none outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.10),transparent_35%)]" />

      <button
        type="button"
        onClick={toggleTheme}
        className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition hover:text-primary"
        aria-label="Alternar tema"
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <section className="relative z-10 w-full max-w-[520px] rounded-[24px] border border-border bg-card px-6 py-6 shadow-[0_24px_80px_rgba(15,23,42,0.13)] sm:px-9 sm:py-7 dark:shadow-[0_24px_90px_rgba(0,0,0,0.34)]">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-500/20">
            <Truck className="h-8 w-8 text-white" strokeWidth={1.8} />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-[30px]">Radasa System</h1>
          <p className="mt-1 text-sm text-muted-foreground">Faça login ou crie sua conta</p>
        </div>

        <div className="mt-6 grid grid-cols-2 border-b border-border">
          <button type="button" onClick={() => setMode("login")} className={cn("relative flex h-11 items-center justify-center gap-2 text-sm font-semibold transition", mode === "login" ? "text-primary" : "text-muted-foreground")}>
            <User className="h-5 w-5" /> Entrar
            {mode === "login" && <span className="absolute inset-x-0 bottom-[-1px] h-0.5 bg-primary" />}
          </button>
          <button type="button" onClick={() => setMode("register")} className={cn("relative flex h-11 items-center justify-center gap-2 text-sm font-semibold transition", mode === "register" ? "text-primary" : "text-muted-foreground")}>
            <UserPlus className="h-5 w-5" /> Criar conta
            {mode === "register" && <span className="absolute inset-x-0 bottom-[-1px] h-0.5 bg-primary" />}
          </button>
        </div>

        {mode === "login" ? (
          <form onSubmit={submitLogin} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold">Usuário ou e-mail</span>
              <span className="relative block">
                <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input className={inputClass} value={loginData.identifier} onChange={(e) => setLoginData(v => ({ ...v, identifier: e.target.value }))} placeholder="Digite seu usuário ou email" autoComplete="username" required />
              </span>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold">Senha</span>
              <span className="relative block">
                <LockKeyhole className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input className={inputClass} type={showPassword ? "text" : "password"} value={loginData.password} onChange={(e) => setLoginData(v => ({ ...v, password: e.target.value }))} placeholder="Digite sua senha" autoComplete="current-password" required />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </span>
              <button type="button" onClick={() => toast.info("A recuperação de senha será disponibilizada em breve.")} className="mt-2 block w-full text-right text-xs font-semibold text-primary hover:underline">Esqueceu sua senha?</button>
            </label>

            <button disabled={submitting} className="h-12 w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-base font-bold text-white shadow-lg shadow-blue-500/20 transition hover:brightness-105 disabled:opacity-60">
              {submitting ? "Entrando..." : "Entrar"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitRegister} className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold">Nome completo</span>
              <span className="relative block"><User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input className={inputClass} value={registerData.name} onChange={(e) => setRegisterData(v => ({ ...v, name: e.target.value }))} placeholder="Digite seu nome" autoComplete="name" required /></span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold">Usuário</span>
              <span className="relative block"><User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input className={inputClass} value={registerData.username} onChange={(e) => setRegisterData(v => ({ ...v, username: e.target.value.toLowerCase() }))} placeholder="Crie um usuário" autoComplete="username" required /></span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold">E-mail</span>
              <span className="relative block"><Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input className={inputClass} type="email" value={registerData.email} onChange={(e) => setRegisterData(v => ({ ...v, email: e.target.value }))} placeholder="Digite seu e-mail" autoComplete="email" required /></span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold">Senha</span>
              <span className="relative block"><LockKeyhole className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input className={inputClass} type={showPassword ? "text" : "password"} value={registerData.password} onChange={(e) => setRegisterData(v => ({ ...v, password: e.target.value }))} placeholder="Mínimo de 8 caracteres" autoComplete="new-password" minLength={8} required /></span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold">Confirmar senha</span>
              <span className="relative block"><LockKeyhole className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input className={inputClass} type={showPassword ? "text" : "password"} value={registerData.confirmPassword} onChange={(e) => setRegisterData(v => ({ ...v, confirmPassword: e.target.value }))} placeholder="Repita sua senha" autoComplete="new-password" minLength={8} required /></span>
            </label>
            <button disabled={submitting} className="h-12 w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-base font-bold text-white shadow-lg shadow-blue-500/20 transition hover:brightness-105 disabled:opacity-60 sm:col-span-2">
              {submitting ? "Criando conta..." : "Criar conta"}
            </button>
          </form>
        )}

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" /><span>ou continue com</span><span className="h-px flex-1 bg-border" /></div>
        <button type="button" onClick={() => toast.info("O login com Google será disponibilizado em breve.")} className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-input bg-transparent text-sm font-semibold transition hover:bg-accent/60">
          <span className="text-lg font-extrabold text-blue-500">G</span> Entrar com Google
        </button>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          {mode === "login" ? "Não tem uma conta? " : "Já possui uma conta? "}
          <button type="button" onClick={() => setMode(mode === "login" ? "register" : "login")} className="font-semibold text-primary hover:underline">
            {mode === "login" ? "Crie uma conta agora." : "Entre agora."}
          </button>
        </p>
      </section>
    </main>
  );
}
