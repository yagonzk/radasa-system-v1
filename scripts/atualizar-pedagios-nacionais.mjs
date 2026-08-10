import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "server/data/pedagios-nacional.generated.ts");
const TIMEOUT_MS = 45_000;
const CKAN_PACKAGE = "https://dados.antt.gov.br/api/3/action/package_show?id=praca-de-pedagio";
const OVERPASS = "https://overpass-api.de/api/interpreter";

const CONCESSION_SLUGS = {
  "autopista fluminense": "autopista-fluminense",
  "autopista litoral sul": "autopista-litoral-sul",
  "autopista planalto sul": "autopista-planalto-sul",
  "autopista regis bittencourt": "autopista-regis-bittencourt",
  "concebra": "concebra",
  "ecovias minas goias": "ecovias-minas-goias",
  "ecovias capixaba": "ecovias-capixaba",
  "ecovias ponte": "ecovias-ponte",
  "ecovias rio minas": "ecovias-rio-minas",
  "ecovias araguaia": "ecovias-araguaia",
  "ecovias cerrado": "ecovias-cerrado",
  "ecovias das gerais": "ecovias-das-gerais",
  "elovias": "elovias",
  "epr iguacu": "epr-iguacu",
  "epr parana": "epr-parana",
  "epr litoral pioneiro": "epr-litoral-pioneiro",
  "epr via mineira": "epr-via-mineira",
  "motiva minas sp": "motiva-minas-sp",
  "motiva parana": "motiva-parana",
  "motiva pantanal": "motiva-pantanal",
  "nova rota do oeste": "nova-rota-do-oeste",
  "nova 364": "nova-364",
  "nova 381": "nova-381",
  "riosp": "riosp",
  "rota verde goias": "rota-verde-goias",
  "transbrasiliana": "transbrasiliana",
  "via araucaria": "via-araucaria",
  "via brasil br 163": "via-brasil-br-163",
  "viacosteira": "viacosteira",
};
const ANTT_CONCESSION_BASE = "https://www.gov.br/antt/pt-br/assuntos/rodovias/concessionarias/lista-de-concessoes";
function htmlText(value=""){return String(value).replace(/<br\s*\/?\s*>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/\s+/g," ").trim();}
function tableRows(html){const tables=[...String(html).matchAll(/<table[\s\S]*?<\/table>/gi)].map(m=>m[0]);return tables.flatMap(table=>[...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map(r=>[...r[0].matchAll(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map(c=>htmlText(c[1]))).filter(c=>c.length));}
function plazaNumber(name=""){const m=String(name).match(/(?:^|\b)(?:p|praca|praça)\s*0*(\d{1,2})(?:\b|\D)/i);return m?Number(m[1]):null;}
function inferPricing(valuesByAxes, plazaIndex){
  const vals={};
  for(const [axes,list] of valuesByAxes.entries()){const value=list.length===1?list[0]:list[plazaIndex];if(Number.isFinite(value)) vals[axes]=value;}
  const perAxle=Object.entries(vals).map(([a,v])=>Number(v)/Number(a)).filter(Number.isFinite);
  if(perAxle.length>=3){const avg=perAxle.reduce((a,b)=>a+b,0)/perAxle.length;const maxDev=Math.max(...perAxle.map(v=>Math.abs(v-avg)));if(maxDev<=0.051)return {kind:"PER_AXLE",perAxle:Math.round(avg*100)/100};}
  if(Object.keys(vals).length)return {kind:"BY_AXLES",values:vals};
  return {kind:"UNKNOWN"};
}
async function fetchAnttTariffTable(slug){
  const candidates=[`${ANTT_CONCESSION_BASE}/${slug}/tarifas-de-pedagio`,`${ANTT_CONCESSION_BASE}/${slug}/tarifas-de-pedagio-${slug}`];
  for(const url of candidates){try{const html=await (await get(url)).text();const rows=tableRows(html);const byAxes=new Map();for(const cells of rows){if(cells.length<4)continue;const vehicle=norm(cells.slice(0,5).join(" "));if(!vehicle.includes("caminh")&&!vehicle.includes("onibus")&&!vehicle.includes("comercial"))continue;let axes=NaN;for(let i=0;i<Math.min(5,cells.length);i++){const n=numberBR(cells[i]);if(Number.isInteger(n)&&n>=2&&n<=10){if(i>=1){axes=n;break;}}}if(!Number.isFinite(axes))continue;const numeric=cells.map(numberBR);let start=Math.min(5,cells.length);let prices=numeric.slice(start).filter(v=>Number.isFinite(v)&&v>0);if(!prices.length){prices=numeric.slice(3).filter(v=>Number.isFinite(v)&&v>0);if(prices.length>1)prices=prices.slice(1);}if(prices.length)byAxes.set(axes,prices);}if(byAxes.size)return {url,byAxes};}catch{} }return null;
}
async function enrichAnttTariffs(plazas){
  console.log("[2/4] Tentando enriquecer tarifas federais pelas páginas oficiais da ANTT...");
  const groups=new Map();for(const plaza of plazas){const key=norm(plaza.concession);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(plaza);}
  let priced=0;
  for(const [key,items] of groups){const slugName=CONCESSION_SLUGS[key];if(!slugName)continue;const table=await fetchAnttTariffTable(slugName);if(!table)continue;for(const item of items){const n=plazaNumber(item.name);const index=n?Math.max(0,n-1):0;const pricing=inferPricing(table.byAxes,index);if(pricing.kind!=="UNKNOWN"){item.pricing=pricing;item.sourceUrl=table.url;item.tariffUpdatedAt=new Date().toISOString().slice(0,10);priced++;}}}
  console.log(`  ${priced} praças federais receberam tarifa automaticamente.`);
  return priced;
}

function norm(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function slug(value = "") { return norm(value).replace(/\s+/g, "-") || "sem-nome"; }
function numberBR(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return NaN;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  return Number(normalized.replace(/[^0-9+\-.]/g, ""));
}
function splitCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const delimiter = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const parseLine = (line) => {
    const out=[]; let value=""; let quoted=false;
    for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(ch===delimiter&&!quoted){out.push(value);value="";}else value+=ch;}out.push(value);return out;
  };
  const headers=parseLine(lines[0]).map(norm);
  return lines.slice(1).map(line=>{const values=parseLine(line);return Object.fromEntries(headers.map((h,i)=>[h,values[i]??""]));});
}
function field(row, aliases) {
  for (const alias of aliases) {
    const exact = row[norm(alias)]; if (exact != null && String(exact).trim()) return String(exact).trim();
  }
  for (const [key,value] of Object.entries(row)) if (aliases.some(a=>key.includes(norm(a))) && String(value).trim()) return String(value).trim();
  return "";
}
async function get(url, init={}) {
  const ctrl=new AbortController(); const timer=setTimeout(()=>ctrl.abort(),TIMEOUT_MS);
  try { const response=await fetch(url,{...init,signal:ctrl.signal,headers:{"user-agent":"Radasa-System/1.0 toll-data-updater",...(init.headers||{})}}); if(!response.ok) throw new Error(`${response.status} ${response.statusText}`); return response; }
  finally { clearTimeout(timer); }
}
function distanceKm(a,b){const R=6371;const dLat=(b.latitude-a.latitude)*Math.PI/180,dLon=(b.longitude-a.longitude)*Math.PI/180;const la1=a.latitude*Math.PI/180,la2=b.latitude*Math.PI/180;const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;return R*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));}

async function loadAntt() {
  console.log("[1/3] Buscando cadastro federal oficial da ANTT...");
  const meta=await (await get(CKAN_PACKAGE)).json();
  const resources=meta?.result?.resources||[];
  const csv=[...resources].filter(r=>String(r.format||"").toUpperCase()==="CSV").sort((a,b)=>String(b.last_modified||b.created||"").localeCompare(String(a.last_modified||a.created||"")))[0];
  if(!csv?.url) throw new Error("A ANTT não retornou um recurso CSV para Praça de Pedágio.");
  const text=await (await get(csv.url)).text();
  const rows=splitCsv(text); const result=[];
  for(const row of rows){
    const lat=numberBR(field(row,["latitude","lat"])); const lon=numberBR(field(row,["longitude","long","lon"]));
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat>6||lat<-35||lon>-30||lon<-75) continue;
    const concession=field(row,["concessionaria","concessionária","empresa"]);
    const name=field(row,["praca","praça","nome da praca","nome"] )||"Praça de pedágio";
    const road=field(row,["rodovia","br","via"]); const km=field(row,["km","quilometro","quilômetro"]);
    const city=field(row,["municipio","município","cidade"]); const stateCode=(field(row,["uf","estado"])||"").toUpperCase().slice(0,2);
    result.push({id:`antt-${slug(concession)}-${slug(name)}-${slug(road)}-${slug(km)}`,name,road,km,city,stateCode,concession,latitude:lat,longitude:lon,matchRadiusKm:1.8,pricing:{kind:"UNKNOWN"},sourceUrl:csv.url,tariffUpdatedAt:String(csv.last_modified||csv.created||new Date().toISOString()).slice(0,10),sourceKind:"ANTT"});
  }
  console.log(`  ${result.length} praças federais com coordenadas válidas.`);
  return {plazas:result,resource:csv.url};
}

async function loadOsm() {
  console.log("[3/4] Buscando complemento nacional no OpenStreetMap/Overpass...");
  const query=`[out:json][timeout:180];area["ISO3166-1"="BR"][admin_level=2]->.br;(node["barrier"="toll_booth"](area.br);node["highway"="toll_gantry"](area.br);way["barrier"="toll_booth"](area.br);way["highway"="toll_gantry"](area.br););out center tags;`;
  const response=await get(OVERPASS,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded;charset=UTF-8"},body:new URLSearchParams({data:query}).toString()});
  const json=await response.json(); const result=[];
  for(const el of json.elements||[]){const lat=Number(el.lat??el.center?.lat),lon=Number(el.lon??el.center?.lon);if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;const t=el.tags||{};const road=t.ref||t.road||"";const name=t.name||t.operator||"Pedágio";result.push({id:`osm-${el.type}-${el.id}`,name,road,km:t["addr:km"]||t.km||"",city:t["addr:city"]||"",stateCode:(t["addr:state"]||"").toUpperCase().slice(0,2),concession:t.operator||t.brand||"",latitude:lat,longitude:lon,matchRadiusKm:1.2,pricing:{kind:"UNKNOWN"},sourceUrl:`https://www.openstreetmap.org/${el.type}/${el.id}`,tariffUpdatedAt:new Date().toISOString().slice(0,10),sourceKind:(/^(?:AC|AL|AM|AP|BA|CE|DF|ES|GO|MA|MG|MS|MT|PA|PB|PE|PI|PR|RJ|RN|RO|RR|RS|SC|SE|SP|TO)[- ]?\d/i.test(String(road).trim())?"STATE":"OSM")});}
  console.log(`  ${result.length} pontos de pedágio/pórticos encontrados no OSM.`); return result;
}

function sameRoad(a,b){const ra=norm(a.road||"").replace(/\s+/g,"");const rb=norm(b.road||"").replace(/\s+/g,"");return Boolean(ra&&rb&&(ra===rb||ra.includes(rb)||rb.includes(ra)));}
function sameOperator(a,b){const aa=norm(a.concession||"");const bb=norm(b.concession||"");return Boolean(aa&&bb&&(aa===bb||aa.includes(bb)||bb.includes(aa)));}
function merge(antt,osm){const all=[...antt];for(const item of osm){const duplicate=all.some(x=>{const d=distanceKm(x,item);if(d<0.8)return true;if(d<=3.5&&(sameRoad(x,item)||sameOperator(x,item)))return true;return false;});if(duplicate)continue;all.push(item);}return all;}
function escapeTs(v){return JSON.stringify(v,null,2);}
async function main(){
  let antt=[]; let osm=[]; let anttResource="";
  try{const r=await loadAntt();antt=r.plazas;anttResource=r.resource;}catch(e){console.warn("  AVISO ANTT:",e.message);}
  let federalPriced=0;
  if(antt.length){try{federalPriced=await enrichAnttTariffs(antt);}catch(e){console.warn("  AVISO tarifas ANTT:",e.message);}}
  try{osm=await loadOsm();}catch(e){console.warn("  AVISO OSM:",e.message);}
  const plazas=merge(antt,osm).sort((a,b)=>`${a.stateCode}|${a.road}|${a.km}`.localeCompare(`${b.stateCode}|${b.road}|${b.km}`,"pt-BR"));
  if(!plazas.length) throw new Error("Nenhuma fonte respondeu. O arquivo existente foi preservado.");
  console.log(`[4/4] Gravando snapshot local com ${plazas.length} registros...`);
  const header=`import type { LocalTollPlaza } from "./pedagios-brasil";\n\n// GERADO AUTOMATICAMENTE. Não editar manualmente.\n`;
  const body=`export const GENERATED_TOLL_PLAZAS: LocalTollPlaza[] = ${escapeTs(plazas)} as LocalTollPlaza[];\n\nexport const GENERATED_TOLL_META = ${escapeTs({generatedAt:new Date().toISOString(),federalAntt:antt.length,osmSupplemental:plazas.length-antt.length,priced:plazas.filter(p=>p.pricing.kind!=="UNKNOWN").length,unpriced:plazas.filter(p=>p.pricing.kind==="UNKNOWN").length,anttResource,federalPriced})};\n`;
  await fs.writeFile(OUT,header+body,"utf8");
  console.log(`OK: ${OUT}`);
  console.log("As praças sem tarifa oficial validada ficam visíveis na rota como 'Tarifa pendente' e não entram no total.");
}
main().catch(e=>{console.error("Falha ao atualizar pedágios:",e);process.exitCode=1;});
