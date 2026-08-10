import { useEffect, useRef, useState } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, LoaderCircle, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";

function digits(value: string) { return value.replace(/\D/g, ""); }
function formatCpf(value: string) {
  return digits(value).slice(0, 11).replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1-$2");
}
function formatTelefone(value: string) {
  const number = digits(value).slice(0, 11);
  if (number.length <= 10) return number.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return number.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}
function isValidCpf(value: string) {
  const cpf = digits(value);
  if (!cpf) return true;
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (length + 1 - i);
    const result = (sum * 10) % 11;
    return result === 10 ? 0 : result;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

export default function Perfil() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [fotoPerfil, setFotoPerfil] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    setName(user.name || ""); setEmail(user.email || ""); setTelefone(formatTelefone(user.telefone || "")); setCpf(formatCpf(user.cpf || "")); setFotoPerfil(user.fotoPerfil || null);
  }, [user]);

  const handleImage = (file?: File) => {
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) return toast.error("Use uma imagem JPG, PNG ou WEBP.");
    if (file.size > 5 * 1024 * 1024) return toast.error("A imagem deve possuir no máximo 5 MB.");
    const reader = new FileReader();
    reader.onload = () => setFotoPerfil(String(reader.result));
    reader.onerror = () => toast.error("Não foi possível ler a imagem.");
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return toast.error("Informe seu nome.");
    if (!email.trim()) return toast.error("Informe seu e-mail.");
    if (!isValidCpf(cpf)) return toast.error("Informe um CPF válido.");
    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), email: email.trim(), telefone: digits(telefone), cpf: digits(cpf), fotoPerfil });
      toast.success("Perfil atualizado com sucesso.");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível atualizar o perfil.");
    } finally { setSaving(false); }
  };

  const initials = (name || user?.username || "U").trim().split(/\s+/).slice(0,2).map((part) => part[0]).join("").toUpperCase();

  return (
    <Layout>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6"><h1 className="font-display text-2xl font-bold">Meu perfil</h1><p className="mt-1 text-sm text-muted-foreground">Atualize seus dados pessoais. O nome de usuário não pode ser alterado.</p></div>
        <form onSubmit={handleSubmit} className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-8 flex flex-col items-center gap-4 sm:flex-row">
            <div className="relative h-28 w-28 overflow-hidden rounded-full border-4 border-background bg-primary text-primary-foreground shadow">
              {fotoPerfil ? <img src={fotoPerfil} alt="Foto de perfil" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-3xl font-bold">{initials}</div>}
            </div>
            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleImage(e.target.files?.[0])} />
              <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}><Camera className="mr-2 h-4 w-4" />Alterar foto</Button>
              {fotoPerfil && <Button type="button" variant="outline" onClick={() => setFotoPerfil(null)}><Trash2 className="mr-2 h-4 w-4" />Remover</Button>}
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2"><Label>Nome de usuário</Label><Input value={user?.username || ""} disabled className="bg-muted" /><p className="text-xs text-muted-foreground">Este campo é permanente.</p></div>
            <div className="space-y-2"><Label>Nome completo</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></div>
            <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} /></div>
            <div className="space-y-2"><Label>Telefone</Label><Input value={telefone} onChange={(e) => setTelefone(formatTelefone(e.target.value))} placeholder="(00) 00000-0000" /></div>
            <div className="space-y-2"><Label>CPF</Label><Input value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} placeholder="000.000.000-00" /></div>
            <div className="space-y-2"><Label>Perfil de acesso</Label><Input value={user?.role || ""} disabled className="bg-muted" /></div>
          </div>
          <div className="mt-8 flex justify-end"><Button type="submit" disabled={saving}>{saving ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : <><UserRound className="mr-2 h-4 w-4" />Salvar perfil</>}</Button></div>
        </form>
      </div>
    </Layout>
  );
}
