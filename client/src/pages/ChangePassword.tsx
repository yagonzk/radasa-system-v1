import { useState } from "react";
import { ArrowLeft, Eye, EyeOff, KeyRound } from "lucide-react";
import { Link, useLocation } from "wouter";
import { api } from "@/lib/api";
import { toast } from "sonner";
import Layout from "@/components/Layout";

export default function ChangePassword() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [show, setShow] = useState(false); const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) return toast.error("As novas senhas não coincidem.");
    setLoading(true);
    try { await api.put("/auth/change-password", { currentPassword: form.currentPassword, newPassword: form.newPassword }); toast.success("Senha alterada com sucesso."); navigate("/"); }
    catch (error: any) { toast.error(error.response?.data?.message || "Não foi possível alterar a senha."); } finally { setLoading(false); }
  };
  return <Layout><div className="mx-auto max-w-xl"><Link href="/" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4"/>Voltar</Link><div className="rounded-2xl border border-border bg-card p-6 shadow-sm"><div className="mb-6 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><KeyRound className="h-5 w-5"/></div><div><h1 className="text-xl font-bold">Alterar senha</h1><p className="text-sm text-muted-foreground">Confirme sua senha atual e escolha uma nova.</p></div></div><form onSubmit={submit} className="space-y-4">{[["currentPassword","Senha atual"],["newPassword","Nova senha"],["confirmPassword","Confirmar nova senha"]].map(([key,label])=><label key={key} className="block text-sm font-medium">{label}<div className="relative mt-2"><input type={show?"text":"password"} value={(form as any)[key]} onChange={e=>setForm(v=>({...v,[key]:e.target.value}))} className="h-11 w-full rounded-lg border border-input bg-background px-3 pr-11 outline-none focus:border-primary" required minLength={8}/><button type="button" onClick={()=>setShow(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{show?<EyeOff className="h-4 w-4"/>:<Eye className="h-4 w-4"/>}</button></div></label>)}<button disabled={loading} className="h-11 w-full rounded-lg bg-primary font-semibold text-primary-foreground disabled:opacity-60">{loading?"Alterando...":"Alterar senha"}</button></form></div></div></Layout>;
}
