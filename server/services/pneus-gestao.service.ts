import { prisma } from "../lib/prisma.js";
import { dateOnly, number } from "../utils/serialize.js";

const startOfDay = (value?: string) => value ? new Date(`${value}T00:00:00.000`) : undefined;
const endOfDay = (value?: string) => value ? new Date(`${value}T23:59:59.999`) : undefined;
const range = (from?: string, to?: string) => ({ ...(from ? { gte: startOfDay(from) } : {}), ...(to ? { lte: endOfDay(to) } : {}) });

function buildAlerts(pneus: any[]) {
  const now = Date.now();
  const alerts: any[] = [];
  for (const p of pneus) {
    const installation = p.instalacoes?.find((x:any)=>x.ativo);
    const prefix = `Pneu ${p.numeroFogo}`;
    if (p.status === "INSTALADO" && p.proximoRodizioKm != null && installation) {
      const km = Number(installation.veiculo?.abastecimentos?.[0]?.hodometro ?? p.kmAtual ?? 0);
      const remaining = Number(p.proximoRodizioKm) - km;
      if (remaining <= 1000) alerts.push({ id:`rodizio-${p.id}`, severity:remaining<=0?"CRITICO":"ATENCAO", type:"RODIZIO", title:`${prefix}: rodízio ${remaining<=0?"vencido":"próximo"}`, detail:`${Math.max(0,remaining).toLocaleString("pt-BR")} km restantes`, pneuId:p.id });
    }
    if (p.sulcoAtual != null && Number(p.sulcoAtual) <= 2) alerts.push({ id:`sulco-${p.id}`, severity:"CRITICO", type:"SULCO", title:`${prefix}: sulco crítico`, detail:`Sulco atual de ${Number(p.sulcoAtual).toFixed(1)} mm`, pneuId:p.id });
    const cal = p.calibragens?.[0];
    if (cal && Number(cal.pressaoRecomendada)>0 && Math.abs(Number(cal.pressaoEncontrada)-Number(cal.pressaoRecomendada))/Number(cal.pressaoRecomendada)>0.10) alerts.push({id:`pressao-${p.id}`,severity:"ATENCAO",type:"PRESSAO",title:`${prefix}: pressão fora do padrão`,detail:`Encontrada ${Number(cal.pressaoEncontrada)} / recomendada ${Number(cal.pressaoRecomendada)}`,pneuId:p.id});
    if (p.recapagensRealizadas >= p.maxRecapagens && p.maxRecapagens > 0) alerts.push({id:`recap-${p.id}`,severity:"ATENCAO",type:"RECAPAGEM",title:`${prefix}: limite de recapagens atingido`,detail:`${p.recapagensRealizadas}/${p.maxRecapagens} recapagens`,pneuId:p.id});
    const inspection = p.inspecoes?.[0];
    if (!inspection || now-new Date(inspection.data).getTime()>30*86400000) alerts.push({id:`inspection-${p.id}`,severity:"ATENCAO",type:"INSPECAO",title:`${prefix}: inspeção pendente`,detail:inspection?`Última em ${dateOnly(inspection.data)}`:"Sem inspeções registradas",pneuId:p.id});
    const dot = String(p.dot ?? "").replace(/\D/g,"");
    if (dot.length===4) { const week=Number(dot.slice(0,2)), yy=Number(dot.slice(2)), year=yy>=70?1900+yy:2000+yy; const manufactured=new Date(year,0,1+(week-1)*7); if(now-manufactured.getTime()>5*365.25*86400000) alerts.push({id:`dot-${p.id}`,severity:"ATENCAO",type:"DOT",title:`${prefix}: DOT vencido`,detail:`Fabricação ${p.dot}`,pneuId:p.id}); }
  }
  return alerts.sort((a,b)=>a.severity==="CRITICO"&&b.severity!=="CRITICO"?-1:1);
}

const include = { recapagens:true, consertos:true, medicoesSulco:{orderBy:{data:"desc" as const}}, calibragens:{orderBy:{data:"desc" as const},take:1}, inspecoes:{orderBy:{data:"desc" as const},take:1}, instalacoes:{where:{ativo:true},include:{veiculo:{include:{abastecimentos:{orderBy:{hodometro:"desc" as const},take:1}}},carreta:true}} } as const;

export const pneusGestaoService = {
  async alerts() { return buildAlerts(await prisma.pneu.findMany({where:{deletedAt:null,status:{not:"DESCARTADO"}},include})); },
  async reports(from?:string,to?:string) {
    const pneus=await prisma.pneu.findMany({where:{deletedAt:null},include:{...include,eventos:{where:{data:range(from,to)},orderBy:{data:"desc"}},instalacoes:{include:{veiculo:true,carreta:true},orderBy:{dataInstalacao:"desc"}},recapagens:{where:{dataEnvio:range(from,to)}},consertos:{where:{data:range(from,to)}},medicoesSulco:{where:{data:range(from,to)},orderBy:{data:"desc"}}}});
    const byBrand=new Map<string,{brand:string,count:number,cost:number,km:number}>();
    const byRecapper=new Map<string,{name:string,count:number,cost:number}>();
    const byVehicle=new Map<string,{vehicle:string,count:number,cost:number}>();
    const history:any[]=[];
    for(const p of pneus){
      const recapCost=p.recapagens.reduce((a:any,r:any)=>a+number(r.valor),0); const repairCost=p.consertos.reduce((a:any,c:any)=>a+number(c.valor),0); const investment=number(p.valorCompra)+recapCost+repairCost;
      const b=byBrand.get(p.marca)??{brand:p.marca,count:0,cost:0,km:0}; b.count++; b.cost+=investment; b.km+=number(p.kmAtual); byBrand.set(p.marca,b);
      for(const r of p.recapagens){const x=byRecapper.get(r.empresaRecapadora)??{name:r.empresaRecapadora,count:0,cost:0};x.count++;x.cost+=number(r.valor);byRecapper.set(r.empresaRecapadora,x)}
      for(const i of p.instalacoes){const key=i.veiculo?.placa??"Sem veículo";const x=byVehicle.get(key)??{vehicle:key,count:0,cost:0};x.count++;x.cost+=investment;byVehicle.set(key,x)}
      for(const e of p.eventos) history.push({pneu:p.numeroFogo,marca:p.marca,evento:e.tipo,data:e.data,responsavel:e.responsavel??"—",quilometragem:e.quilometragem==null?null:number(e.quilometragem),observacoes:e.observacoes??""});
    }
    const wear=pneus.map(p=>({numeroFogo:p.numeroFogo,marca:p.marca,sulcoAtual:p.sulcoAtual==null?null:number(p.sulcoAtual),desgaste:p.sulcoInicial&&p.sulcoAtual!=null?Math.max(0,((number(p.sulcoInicial)-number(p.sulcoAtual))/number(p.sulcoInicial))*100):0,km:number(p.kmAtual)})).sort((a,b)=>b.desgaste-a.desgaste);
    return {period:{from:from??null,to:to??null},summary:{pneus:pneus.length,investment:pneus.reduce((a,p)=>a+number(p.valorCompra)+p.recapagens.reduce((x:any,r:any)=>x+number(r.valor),0)+p.consertos.reduce((x:any,c:any)=>x+number(c.valor),0),0),averageLifeKm:pneus.length?pneus.reduce((a,p)=>a+number(p.kmAtual),0)/pneus.length:0},history:history.sort((a,b)=>new Date(b.data).getTime()-new Date(a.data).getTime()),costsByVehicle:Array.from(byVehicle.values()).sort((a,b)=>b.cost-a.cost),rankingBrands:Array.from(byBrand.values()).sort((a,b)=>b.km-a.km),rankingRecappers:Array.from(byRecapper.values()).sort((a,b)=>b.count-a.count),wear,nearReplacement:wear.filter(x=>x.sulcoAtual!=null&&x.sulcoAtual<=3)};
  }
};
