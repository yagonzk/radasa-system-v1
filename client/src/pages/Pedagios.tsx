import { useEffect, useMemo, useRef, useState } from "react";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowDownUp, Calculator, Clock3, MapPin, Pencil, Plus, ReceiptText, Route as RouteIcon, Search, Tag, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";

interface TollItem {
  id: string; type: string; name: string; address: string; city: string;
  state: { name: string; code: string }; concession: string;
  coordinates: { latitude: number; longitude: number } | null;
  price: number | null; hasTariff?: boolean; currency: string;
  serviceTypes: Array<{ serviceId?: string; name?: string }>;
  passages?: number; unitPrice?: number; road?: string; km?: string;
}
interface City { id: number; nome: string; uf: string }
interface TollCadastro {
  id: string; nome: string; rodovia: string; km: string; cidade: string; uf: string;
  concessionaria: string; latitude: number; longitude: number; raioKm: number;
  valorPorEixo: number; ativo: boolean; observacoes?: string | null;
}

type TollForm = Omit<TollCadastro, "id">;
const emptyTollForm: TollForm = {
  nome: "", rodovia: "", km: "", cidade: "", uf: "", concessionaria: "",
  latitude: -12.5, longitude: -55.7, raioKm: 1.2, valorPorEixo: 0, ativo: true, observacoes: "",
};

const vehicleOptions = [
  { value: "TRUCK_WITH_TWO_SINGLE_AXIS", label: "Caminhão - 2 eixos" },
  { value: "TRUCK_WITH_THREE_DOUBLE_AXLES", label: "Caminhão - 3 eixos" },
  { value: "TRUCK_WITH_FOUR_DOUBLE_AXLES", label: "Caminhão - 4 eixos" },
  { value: "TRUCK_WITH_FIVE_DOUBLE_AXLES", label: "Caminhão - 5 eixos" },
  { value: "TRUCK_WITH_SIX_DOUBLE_AXLES", label: "Caminhão - 6 eixos" },
  { value: "TRUCK_WITH_SEVEN_DOUBLE_AXLES", label: "Caminhão - 7 eixos" },
  { value: "TRUCK_WITH_EIGHT_DOUBLE_AXLES", label: "Caminhão - 8 eixos" },
  { value: "TRUCK_WITH_NINE_DOUBLE_AXLES", label: "Caminhão - 9 eixos" },
  { value: "TRUCK_WITH_TEN_DOUBLE_AXLES", label: "Caminhão - 10 eixos" },
] as const;

function norm(v: string) { return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
function formatBRL(v: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0); }
function formatDuration(s: number) { if (!Number.isFinite(s) || s <= 0) return "—"; const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h ? `${h}h ${String(m).padStart(2, "0")}min` : `${m} min`; }
function getVehicleLabel(value: string) { return vehicleOptions.find((option) => option.value === value)?.label || "Caminhão"; }
function getVehicleAxes(value: string) { const match = getVehicleLabel(value).match(/(\d+)\s+eixos/i); return match ? Number(match[1]) : null; }
function tollPhysicalKey(t: TollItem) { const clean = (v: string) => norm(String(v || "")).replace(/[^a-z0-9]/g, ""); return [clean(t.name), clean(`${t.road || ""}${t.km || ""}${t.address || ""}`), clean(t.concession)].join("|"); }
function mergeTollPassages(items: TollItem[]) {
  const merged = new Map<string, TollItem>();
  for (const item of items) {
    const key = tollPhysicalKey(item), current = merged.get(key);
    if (!current) { merged.set(key, { ...item, passages: 1, unitPrice: item.price ?? undefined }); continue; }
    current.passages = (current.passages || 1) + 1;
    current.price = (current.price == null || item.price == null) ? (current.price ?? item.price) : Number((current.price + item.price).toFixed(2));
  }
  return Array.from(merged.values());
}

function CityPicker({ label, value, onSelect, placeholder }: { label: string; value: City | null; onSelect: (c: City | null) => void; placeholder: string }) {
  const [query, setQuery] = useState(value ? `${value.nome} - ${value.uf}` : "");
  const [open, setOpen] = useState(false), [cities, setCities] = useState<City[]>([]), [loadingCities, setLoadingCities] = useState(false);
  useEffect(() => { if (value) setQuery(`${value.nome} - ${value.uf}`); }, [value]);
  useEffect(() => {
    let active = true; setLoadingCities(true);
    fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome").then((r) => r.json()).then((rows: any[]) => {
      if (!active) return;
      setCities(rows.map((x) => ({ id: Number(x.id), nome: String(x.nome || ""), uf: String(x.microrregiao?.mesorregiao?.UF?.sigla || x["regiao-imediata"]?.["regiao-intermediaria"]?.UF?.sigla || "") })).filter((c) => c.nome && c.uf));
    }).catch(() => toast.error("Não foi possível carregar a lista de cidades do IBGE.")).finally(() => active && setLoadingCities(false));
    return () => { active = false; };
  }, []);
  const options = useMemo(() => {
    const q = norm(query.replace(/\s*[-,]\s*[A-Z]{2}$/i, "").trim()); if (q.length < 2) return [];
    return cities.filter((c) => norm(`${c.nome} ${c.uf}`).includes(q)).sort((a, b) => Number(!norm(a.nome).startsWith(q)) - Number(!norm(b.nome).startsWith(q)) || a.nome.localeCompare(b.nome, "pt-BR")).slice(0, 15);
  }, [cities, query]);
  return <div className="relative min-w-0 space-y-1.5"><Label>{label}</Label><div className="relative"><MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input className="h-[48px] pl-9" value={query} placeholder={placeholder} autoComplete="off" onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)} onChange={(e) => { setQuery(e.target.value); onSelect(null); setOpen(true); }}/></div>{open && query.trim().length >= 2 && <div className="absolute left-0 right-0 top-full z-[2000] mt-1 max-h-72 overflow-auto rounded-md border bg-popover shadow-2xl">{loadingCities ? <div className="px-3 py-3 text-sm text-muted-foreground">Carregando cidades...</div> : options.length ? options.map((c) => <button type="button" key={c.id} className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-accent" onMouseDown={(e) => e.preventDefault()} onClick={() => { onSelect(c); setQuery(`${c.nome} - ${c.uf}`); setOpen(false); }}><span className="font-medium">{c.nome}</span><span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold">{c.uf}</span></button>) : <div className="px-3 py-3 text-sm text-muted-foreground">Nenhuma cidade encontrada.</div>}</div>}</div>;
}

function loadLeaflet(): Promise<any> { return new Promise((resolve, reject) => { const w = window as any; if (w.L) return resolve(w.L); if (!document.querySelector("link[data-leaflet]")) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; l.setAttribute("data-leaflet", "1"); document.head.appendChild(l); } const existing = document.querySelector("script[data-leaflet]") as HTMLScriptElement | null; if (existing) { existing.addEventListener("load", () => resolve((window as any).L)); existing.addEventListener("error", reject); return; } const s = document.createElement("script"); s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; s.setAttribute("data-leaflet", "1"); s.onload = () => resolve((window as any).L); s.onerror = reject; document.head.appendChild(s); }); }

export default function Pedagios() {
  const [origin, setOrigin] = useState<City | null>(null), [destination, setDestination] = useState<City | null>(null);
  const [vehicleType, setVehicleType] = useState("TRUCK_WITH_THREE_DOUBLE_AXLES"), [billingType, setBillingType] = useState<"NORMAL" | "TAG">("NORMAL"), [roundTrip, setRoundTrip] = useState(false);
  const [loading, setLoading] = useState(false), [distanceMeters, setDistanceMeters] = useState(0), [durationSeconds, setDurationSeconds] = useState(0), [tolls, setTolls] = useState<TollItem[]>([]), [totalCost, setTotalCost] = useState(0);
  const [providerConfigured, setProviderConfigured] = useState<boolean | null>(null), [mapReady, setMapReady] = useState(false), [mapError, setMapError] = useState("");
  const [manageOpen, setManageOpen] = useState(false), [cadastros, setCadastros] = useState<TollCadastro[]>([]), [editing, setEditing] = useState<TollCadastro | null>(null), [editingAutomaticId, setEditingAutomaticId] = useState<string | null>(null), [form, setForm] = useState<TollForm>(emptyTollForm), [saving, setSaving] = useState(false);
  const mapEl = useRef<HTMLDivElement>(null), mapRef = useRef<any>(null), routeLayer = useRef<any>(null), markers = useRef<any[]>([]), cadastroMarkers = useRef<any[]>([]), selectionMarker = useRef<any>(null), calculationRun = useRef(0);

  const refreshStatus = () => api.get("/pedagios/status").then((r) => setProviderConfigured(Boolean(r.data?.authenticated))).catch(() => setProviderConfigured(false));
  const loadCadastros = () => api.get("/pedagios/cadastros").then((r) => setCadastros(Array.isArray(r.data) ? r.data : [])).catch(() => toast.error("Não foi possível carregar os pedágios cadastrados."));
  useEffect(() => { void refreshStatus(); }, []);

  useEffect(() => {
    let alive = true;
    loadLeaflet().then((L) => {
      if (!alive || !mapEl.current || mapRef.current) return;
      const map = L.map(mapEl.current).setView([-14.235, -51.9253], 4);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
      map.on("click", (e: any) => {
        if (!(window as any).__radasaSelectingToll) return;
        setForm((current) => ({ ...current, latitude: Number(e.latlng.lat.toFixed(7)), longitude: Number(e.latlng.lng.toFixed(7)) }));
        if (selectionMarker.current) map.removeLayer(selectionMarker.current);
        selectionMarker.current = L.marker(e.latlng).addTo(map);
      });
      mapRef.current = map; setMapReady(true); setTimeout(() => map.invalidateSize(), 100);
    }).catch(() => setMapError("Não foi possível carregar o mapa. Verifique a conexão com a internet."));
    return () => { alive = false; mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    (window as any).__radasaSelectingToll = manageOpen;
    if (manageOpen) { void loadCadastros(); setTimeout(() => mapRef.current?.invalidateSize(), 100); }
    else if (selectionMarker.current && mapRef.current) { mapRef.current.removeLayer(selectionMarker.current); selectionMarker.current = null; }
    return () => { (window as any).__radasaSelectingToll = false; };
  }, [manageOpen]);

  useEffect(() => {
    const map = mapRef.current, L = (window as any).L; if (!map || !L) return;
    cadastroMarkers.current.forEach((m) => map.removeLayer(m)); cadastroMarkers.current = [];
    if (!manageOpen) return;
    cadastroMarkers.current = cadastros.filter((p) => p.ativo).map((p) => {
      const marker = L.marker([p.latitude, p.longitude]).addTo(map).bindPopup(`<strong>${p.nome}</strong><br>${p.rodovia}${p.km ? ` • km ${p.km}` : ""}<br>${formatBRL(p.valorPorEixo)} por eixo`);
      marker.on("click", () => { setEditing(p); setForm({ ...p }); });
      return marker;
    });
  }, [cadastros, manageOpen]);

  const clearRouteMap = () => { const map = mapRef.current; if (routeLayer.current && map) { map.removeLayer(routeLayer.current); routeLayer.current = null; } markers.current.forEach((m) => map?.removeLayer(m)); markers.current = []; };

  function openRouteTollEditor(t: TollItem) {
    const rawId = String(t.id || "").replace(/-volta$/, "");
    const databaseId = rawId.startsWith("db-") ? rawId.slice(3) : "";
    const existing = databaseId ? cadastros.find((p) => p.id === databaseId) : undefined;
    if (existing) {
      setEditing(existing);
      setEditingAutomaticId(null);
      setForm({ ...existing });
    } else {
      const axes = getVehicleAxes(vehicleType) || 1;
      const passages = Math.max(1, t.passages || 1);
      const singlePassTotal = t.unitPrice ?? (t.price == null ? 0 : t.price / passages);
      setEditing(null);
      setEditingAutomaticId(rawId || "automatico");
      setForm({
        ...emptyTollForm,
        nome: t.name || "Pedágio",
        rodovia: t.road || "",
        km: t.km || "",
        cidade: t.city || "",
        uf: t.state?.code || "",
        concessionaria: t.concession || "",
        latitude: t.coordinates?.latitude ?? emptyTollForm.latitude,
        longitude: t.coordinates?.longitude ?? emptyTollForm.longitude,
        valorPorEixo: Number((singlePassTotal / axes).toFixed(2)),
        observacoes: rawId ? `Correção manual criada a partir da base automática (${rawId}).` : "Correção manual criada pelo mapa.",
      });
    }
    setManageOpen(true);
    mapRef.current?.closePopup?.();
    setTimeout(() => document.getElementById("pedagios-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  }

  async function geocode(c: City) { const q = encodeURIComponent(`${c.nome}, ${c.uf}, Brasil`); const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${q}`, { headers: { "Accept-Language": "pt-BR" } }); const d = await r.json(); if (!d?.[0]) throw new Error(`Não foi possível localizar ${c.nome} - ${c.uf} no mapa.`); return { lat: Number(d[0].lat), lon: Number(d[0].lon) }; }

  const calculateRoute = async (roundTripOverride?: boolean) => {
    const runId = ++calculationRun.current, shouldRoundTrip = roundTripOverride ?? roundTrip;
    if (!origin || !destination) { toast.error("Selecione a cidade de origem e a cidade de destino nas listas."); return; }
    if (!mapReady || !mapRef.current) { toast.error(mapError || "O mapa ainda está carregando."); return; }
    setLoading(true); setTolls([]); setTotalCost(0); clearRouteMap();
    try {
      const [a, b] = await Promise.all([geocode(origin), geocode(destination)]);
      const rr = await fetch(`https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=polyline&steps=false`), rd = await rr.json(), route = rd?.routes?.[0];
      if (!route) throw new Error("Nenhuma rota rodoviária encontrada entre as cidades selecionadas.");
      const coords = decodePolyline(route.geometry); setDistanceMeters(Number(route.distance || 0)); setDurationSeconds(Number(route.duration || 0));
      const L = (window as any).L; routeLayer.current = L.polyline(coords, { weight: 5, opacity: .85 }).addTo(mapRef.current); mapRef.current.fitBounds(routeLayer.current.getBounds(), { padding: [30, 30] });
      const requestTolls = (routeCoords: [number, number][], from: City, to: City) => api.post("/pedagios/calcular", { points: routeCoords.map(([latitude, longitude]) => ({ latitude, longitude })), origin: { name: from.nome, uf: from.uf }, destination: { name: to.nome, uf: to.uf }, vehicleType, billingType, calculationDate: Date.now() });
      const response = await requestTolls(coords, origin, destination); let items = Array.isArray(response.data?.tolls) ? response.data.tolls : [], combinedTotal = Number(response.data?.totalCost || 0);
      if (shouldRoundTrip) { const back = await requestTolls([...coords].reverse(), destination, origin); items = [...items.map((t: TollItem) => ({ ...t, type: "IDA" })), ...(back.data?.tolls || []).map((t: TollItem) => ({ ...t, id: `${t.id}-volta`, type: "VOLTA" }))]; combinedTotal += Number(back.data?.totalCost || 0); }
      items = mergeTollPassages(items); if (runId !== calculationRun.current) return; setTolls(items); setTotalCost(combinedTotal); setProviderConfigured(true);
      const selectedVehicleLabel = getVehicleLabel(vehicleType), selectedAxes = getVehicleAxes(vehicleType);
      const tollIcon = L.divIcon({ className: "radasa-toll-marker", html: `<div style="width:34px;height:34px;border-radius:9px;background:#f59e0b;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:20px">P</div>`, iconSize: [34, 34], iconAnchor: [17, 30] });
      markers.current = items.filter((t: TollItem) => t.coordinates).map((t: TollItem) => {
        const popup = document.createElement("div");
        popup.style.minWidth = "205px";
        const title = document.createElement("div");
        title.style.display = "flex";
        title.style.alignItems = "center";
        title.style.justifyContent = "space-between";
        title.style.gap = "12px";
        const strong = document.createElement("strong");
        strong.textContent = t.name;
        const edit = document.createElement("button");
        edit.type = "button";
        edit.title = "Editar pedágio";
        edit.setAttribute("aria-label", `Editar ${t.name}`);
        edit.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
        edit.style.cssText = "display:flex;align-items:center;justify-content:center;width:30px;height:30px;border:1px solid #d1d5db;border-radius:7px;background:#fff;color:#111827;cursor:pointer;flex:0 0 auto";
        edit.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); openRouteTollEditor(t); });
        title.append(strong, edit);
        popup.appendChild(title);
        const details = document.createElement("div");
        details.style.marginTop = "5px";
        details.innerHTML = `${t.address || ""}<br>${selectedVehicleLabel}${selectedAxes ? ` (${selectedAxes} eixos)` : ""}<br><b>${t.price == null ? "Tarifa pendente" : formatBRL(t.price)}</b>`;
        popup.appendChild(details);
        return L.marker([t.coordinates!.latitude, t.coordinates!.longitude], { icon: tollIcon }).addTo(mapRef.current).bindPopup(popup);
      });
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || "Não foi possível calcular a rota."); }
    finally { if (runId === calculationRun.current) setLoading(false); }
  };

  const openNewToll = () => { setEditing(null); setEditingAutomaticId(null); const center = mapRef.current?.getCenter?.(); setForm({ ...emptyTollForm, latitude: center?.lat ?? -12.5, longitude: center?.lng ?? -55.7 }); setManageOpen(true); };
  const saveToll = async () => {
    if (!form.nome.trim()) { toast.error("Informe o nome do pedágio."); return; }
    if (!Number.isFinite(Number(form.valorPorEixo)) || Number(form.valorPorEixo) < 0) { toast.error("Informe um valor válido por eixo."); return; }
    setSaving(true);
    try {
      if (editing) await api.put(`/pedagios/cadastros/${editing.id}`, form); else await api.post("/pedagios/cadastros", form);
      toast.success(editing || editingAutomaticId ? "Alterações do pedágio salvas." : "Pedágio cadastrado."); setEditing(null); setEditingAutomaticId(null); setForm(emptyTollForm); await loadCadastros(); await refreshStatus();
    } catch (e: any) { toast.error(e?.response?.data?.message || "Não foi possível salvar o pedágio."); }
    finally { setSaving(false); }
  };
  const deleteToll = async (item: TollCadastro) => { if (!confirm(`Excluir o pedágio "${item.nome}"?`)) return; try { await api.delete(`/pedagios/cadastros/${item.id}`); toast.success("Pedágio excluído."); if (editing?.id === item.id) { setEditing(null); setEditingAutomaticId(null); setForm(emptyTollForm); } await loadCadastros(); await refreshStatus(); } catch { toast.error("Não foi possível excluir o pedágio."); } };

  const summary = useMemo(() => [
    { label: "Distância", value: distanceMeters ? `${((distanceMeters * (roundTrip ? 2 : 1)) / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km` : "—", icon: <RouteIcon className="h-4 w-4"/> },
    { label: "Tempo estimado", value: formatDuration(durationSeconds * (roundTrip ? 2 : 1)), icon: <Clock3 className="h-4 w-4"/> },
    { label: "Pedágios", value: tolls.length ? `${tolls.length} praça${tolls.length === 1 ? "" : "s"}` : "—", icon: <ReceiptText className="h-4 w-4"/> },
    { label: "Total de pedágios", value: distanceMeters ? formatBRL(totalCost) : "—", icon: <Calculator className="h-4 w-4"/> },
  ], [distanceMeters, durationSeconds, tolls.length, totalCost, roundTrip]);

  return <Layout><div className="mx-auto max-w-[1500px] space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="font-display text-2xl font-bold">Pedágios</h1><p className="mt-1 text-sm text-muted-foreground">OSRM para a rota + base própria Radasa para localizar e calcular as praças.</p></div><Button variant={manageOpen ? "default" : "outline"} onClick={() => manageOpen ? setManageOpen(false) : openNewToll()}><Pencil className="mr-2 h-4 w-4"/>{manageOpen ? "Fechar edição" : "Editar Pedágios"}</Button></div>
    <Card><CardHeader className="pb-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="text-base">Calcular rota</CardTitle><p className="mt-1 text-xs text-muted-foreground">Digite e selecione a cidade com o estado.</p></div><Badge variant={providerConfigured ? "default" : "secondary"}>{providerConfigured === null ? "Verificando pedágios..." : providerConfigured ? "Base própria ativa" : "Base indisponível"}</Badge></div></CardHeader><CardContent><div className="grid gap-4 xl:grid-cols-[minmax(260px,1.45fr)_56px_minmax(260px,1.45fr)_minmax(190px,1fr)_minmax(190px,1fr)_minmax(185px,.95fr)_minmax(180px,.9fr)] xl:items-end">
      <CityPicker label="Origem" value={origin} onSelect={setOrigin} placeholder="Digite a cidade de origem"/><div className="space-y-1.5"><Label className="invisible">Trocar</Label><Button className="h-[48px] w-full px-0" type="button" variant="outline" onClick={() => { const a = origin; setOrigin(destination); setDestination(a); }}><ArrowDownUp className="h-4 w-4 xl:rotate-90"/></Button></div><CityPicker label="Destino" value={destination} onSelect={setDestination} placeholder="Digite a cidade de destino"/>
      <div className="space-y-1.5"><Label>Veículo</Label><Select value={vehicleType} onValueChange={setVehicleType}><SelectTrigger className="h-[48px]"><SelectValue/></SelectTrigger><SelectContent>{vehicleOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1.5"><Label>Pagamento</Label><Select value={billingType} onValueChange={(v) => setBillingType(v as any)}><SelectTrigger className="h-[48px]"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="NORMAL">Normal / dinheiro</SelectItem><SelectItem value="TAG">TAG</SelectItem></SelectContent></Select></div>
      <div className="space-y-1.5"><Label>Calcular volta</Label><div className="flex h-[48px] items-center justify-between rounded-lg border px-3"><span className="text-sm font-medium">{roundTrip ? "Ativo" : "Inativo"}</span><Switch checked={roundTrip} onCheckedChange={(checked) => { setRoundTrip(checked); if (origin && destination) void calculateRoute(checked); }}/></div></div>
      <div className="space-y-1.5"><Label className="invisible">Calcular</Label><Button className="h-[48px] w-full" onClick={() => void calculateRoute()} disabled={loading}><Search className="mr-2 h-4 w-4"/>{loading ? "Calculando..." : "Calcular"}</Button></div>
    </div></CardContent></Card>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{summary.map((i) => <Card key={i.label}><CardContent className="flex items-center gap-3 p-4"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">{i.icon}</div><div><p className="text-xs text-muted-foreground">{i.label}</p><p className="text-base font-semibold">{i.value}</p></div></CardContent></Card>)}</div>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(330px,.75fr)]"><Card className="overflow-hidden"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><RouteIcon className="h-4 w-4 text-primary"/>Mapa da rota</CardTitle></CardHeader><CardContent className="relative p-0"><div ref={mapEl} className="h-[610px] w-full border-t bg-muted/20"/>{mapError && <div className="absolute inset-0 flex items-center justify-center bg-background/90 p-8 text-center text-sm text-destructive">{mapError}</div>}</CardContent></Card>
      <Card className="min-h-[610px]"><CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="flex items-center gap-2 text-base"><ReceiptText className="h-4 w-4 text-primary"/>Pedágios da rota</CardTitle>{tolls.length > 0 && <Badge variant="outline">{formatBRL(totalCost)}</Badge>}</div></CardHeader><CardContent>{!distanceMeters ? <Empty icon={<Truck/>} title="Nenhuma rota calculada" text="Selecione origem e destino para visualizar os pedágios."/> : !tolls.length ? <Empty icon={<Tag/>} title="Nenhum pedágio cadastrado nesta rota" text="Use Editar Pedágios para adicionar uma praça clicando diretamente no mapa."/> : <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">{tolls.map((t, i) => <button key={`${t.id}-${i}`} className="w-full rounded-lg border p-3 text-left hover:bg-accent/40" onClick={() => t.coordinates && mapRef.current?.setView([t.coordinates.latitude, t.coordinates.longitude], 13)}><div className="flex justify-between gap-3"><div><p className="text-sm font-semibold">{i + 1}. {t.name}</p><p className="mt-1 text-xs text-muted-foreground">{[t.city, t.state?.code].filter(Boolean).join(" / ") || t.address}</p>{t.concession && <p className="mt-1 text-[11px] text-muted-foreground">Concessionária: {t.concession}</p>}{(t.passages || 1) > 1 && t.price != null && <p className="mt-1 text-[11px] font-medium text-primary">{t.passages} passagens × {formatBRL(t.unitPrice ?? t.price / (t.passages || 1))}</p>}</div><strong className="text-sm">{t.price == null ? "Tarifa pendente" : formatBRL(t.price)}</strong></div></button>)}</div>}</CardContent></Card></div>

    {manageOpen && <Card id="pedagios-editor" className="border-primary/30"><CardHeader className="pb-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-base">Editar Pedágios</CardTitle><p className="mt-1 text-xs text-muted-foreground">Clique diretamente no mapa para posicionar a praça. Os pedágios manuais têm prioridade sobre a base automática.</p></div><Badge variant="outline">{cadastros.length} no banco</Badge></div></CardHeader><CardContent><div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]"><div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5 sm:col-span-2"><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: P5 Jangada"/></div><div className="space-y-1.5"><Label>Rodovia</Label><Input value={form.rodovia} onChange={(e) => setForm({ ...form, rodovia: e.target.value })} placeholder="BR-163"/></div><div className="space-y-1.5"><Label>KM</Label><Input value={form.km} onChange={(e) => setForm({ ...form, km: e.target.value })} placeholder="398"/></div><div className="space-y-1.5"><Label>Cidade</Label><Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })}/></div><div className="space-y-1.5"><Label>UF</Label><Input maxLength={2} value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })}/></div><div className="space-y-1.5 sm:col-span-2"><Label>Concessionária</Label><Input value={form.concessionaria} onChange={(e) => setForm({ ...form, concessionaria: e.target.value })}/></div><div className="space-y-1.5"><Label>Latitude</Label><Input type="number" step="0.0000001" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: Number(e.target.value) })}/></div><div className="space-y-1.5"><Label>Longitude</Label><Input type="number" step="0.0000001" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: Number(e.target.value) })}/></div><div className="space-y-1.5"><Label>Valor por eixo *</Label><Input type="number" min="0" step="0.01" value={form.valorPorEixo} onChange={(e) => setForm({ ...form, valorPorEixo: Number(e.target.value) })}/></div><div className="space-y-1.5"><Label>Raio de detecção (km)</Label><Input type="number" min="0.2" max="3" step="0.1" value={form.raioKm} onChange={(e) => setForm({ ...form, raioKm: Number(e.target.value) })}/></div></div><div className="flex items-center justify-between rounded-lg border p-3"><span className="text-sm">Pedágio ativo</span><Switch checked={form.ativo} onCheckedChange={(ativo) => setForm({ ...form, ativo })}/></div><div className="flex flex-wrap gap-2"><Button onClick={saveToll} disabled={saving}>{editing || editingAutomaticId ? <Pencil className="mr-2 h-4 w-4"/> : <Plus className="mr-2 h-4 w-4"/>}{saving ? "Salvando..." : editing || editingAutomaticId ? "Salvar Alterações" : "Cadastrar pedágio"}</Button>{(editing || editingAutomaticId) && <Button variant="outline" onClick={() => { setEditing(null); setEditingAutomaticId(null); setForm(emptyTollForm); }}>Novo cadastro</Button>}<span className="self-center text-xs text-muted-foreground">Posição atual: {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}</span></div></div><div><div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold">Pedágios disponíveis para edição</p><span className="text-xs text-muted-foreground">Clique para editar</span></div><div className="max-h-[430px] space-y-2 overflow-y-auto rounded-lg border p-2">{cadastros.length ? cadastros.map((p) => <div key={p.id} className={`flex items-center justify-between gap-3 rounded-md border p-3 ${editing?.id === p.id ? "bg-accent" : ""}`}><button className="min-w-0 flex-1 text-left" onClick={() => { setEditing(p); setEditingAutomaticId(null); setForm({ ...p }); mapRef.current?.setView([p.latitude, p.longitude], 15); }}><p className="truncate text-sm font-semibold">{p.nome}</p><p className="text-xs text-muted-foreground">{[p.rodovia, p.km ? `km ${p.km}` : "", p.cidade, p.uf].filter(Boolean).join(" • ")}</p><p className="mt-1 text-xs font-medium">{formatBRL(p.valorPorEixo)} / eixo</p></button><Button size="icon" variant="ghost" onClick={() => void deleteToll(p)}><Trash2 className="h-4 w-4 text-destructive"/></Button></div>) : <div className="p-8 text-center text-sm text-muted-foreground">Nenhum pedágio disponível no banco ainda.</div>}</div></div></div></CardContent></Card>}
  </div></Layout>;
}

function Empty({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="flex min-h-[480px] flex-col items-center justify-center px-6 text-center text-muted-foreground"><div className="mb-3 opacity-40">{icon}</div><p className="text-sm font-medium text-foreground">{title}</p><p className="mt-1 text-xs">{text}</p></div>; }
function decodePolyline(str: string) { let index = 0, lat = 0, lng = 0; const coordinates: [number, number][] = []; while (index < str.length) { let b, shift = 0, result = 0; do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20); lat += (result & 1) ? ~(result >> 1) : (result >> 1); shift = 0; result = 0; do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20); lng += (result & 1) ? ~(result >> 1) : (result >> 1); coordinates.push([lat / 1e5, lng / 1e5]); } return coordinates; }
