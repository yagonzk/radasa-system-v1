import { prisma } from "../lib/prisma";
import { AppError } from "../utils/app-error";
import { parseDateOnly } from "../utils/date";
import { created, dateOnly, number } from "../utils/serialize";

const ensurePneu = async (id: string) => { const pneu = await prisma.pneu.findFirst({ where: { id, deletedAt: null } }); if (!pneu) throw new AppError(404, "Pneu não encontrado."); return pneu; };
const num = (v: any) => v == null ? null : number(v);
const listInclude = { medicoesSulco: { orderBy: { data: "desc" as const } }, calibragens: { orderBy: { data: "desc" as const } }, recapagens: { orderBy: { numeroRecapagem: "desc" as const } }, consertos: { orderBy: { data: "desc" as const } }, inspecoes: { orderBy: { data: "desc" as const } } } as const;
const serialize = (p: any) => ({
  ...p,
  medicoesSulco: p.medicoesSulco.map((x:any)=>({...x,data:dateOnly(x.data),quilometragem:num(x.quilometragem),sulcoInterno:num(x.sulcoInterno),sulcoCentral:num(x.sulcoCentral),sulcoExterno:num(x.sulcoExterno),mediaSulco:num(x.mediaSulco),percentualDesgaste:num(x.percentualDesgaste),vidaUtilRestante:num(x.vidaUtilRestante),createdAt:created(x.createdAt)})),
  calibragens: p.calibragens.map((x:any)=>({...x,data:dateOnly(x.data),pressaoRecomendada:num(x.pressaoRecomendada),pressaoEncontrada:num(x.pressaoEncontrada),pressaoAjustada:num(x.pressaoAjustada),createdAt:created(x.createdAt)})),
  recapagens: p.recapagens.map((x:any)=>({...x,dataEnvio:dateOnly(x.dataEnvio),dataRetorno:x.dataRetorno?dateOnly(x.dataRetorno):null,valor:num(x.valor),createdAt:created(x.createdAt)})),
  consertos: p.consertos.map((x:any)=>({...x,data:dateOnly(x.data),valor:num(x.valor),createdAt:created(x.createdAt)})),
  inspecoes: p.inspecoes.map((x:any)=>({...x,data:dateOnly(x.data),createdAt:created(x.createdAt)})),
});

export const pneusManutencaoService = {
  async get(id:string) { await ensurePneu(id); return serialize(await prisma.pneu.findUniqueOrThrow({ where:{id}, include:listInclude })); },
  async addSulco(id:string,input:any) {
    const pneu=await ensurePneu(id); const media=(Number(input.sulcoInterno)+Number(input.sulcoCentral)+Number(input.sulcoExterno))/3;
    const inicial=Number(pneu.sulcoInicial ?? media); const minimo=1.6; const base=Math.max(0.01,inicial-minimo);
    const desgaste=Math.min(100,Math.max(0,((inicial-media)/base)*100)); const vida=Math.max(0,100-desgaste);
    return prisma.$transaction(async tx=>{
      const item=await tx.pneuMedicaoSulco.create({data:{pneuId:id,data:parseDateOnly(input.data),quilometragem:input.quilometragem==null?null:Number(input.quilometragem),sulcoInterno:Number(input.sulcoInterno),sulcoCentral:Number(input.sulcoCentral),sulcoExterno:Number(input.sulcoExterno),mediaSulco:media,percentualDesgaste:desgaste,vidaUtilRestante:vida,responsavel:input.responsavel,observacoes:input.observacoes||null}});
      await tx.pneu.update({where:{id},data:{sulcoAtual:media,eventos:{create:{tipo:"SULCO",data:parseDateOnly(input.data),quilometragem:input.quilometragem==null?null:Number(input.quilometragem),responsavel:input.responsavel,observacoes:`Medição de sulco registrada: ${media.toFixed(2)} mm.`,dados:{desgaste,vida}}}}}); return item;
    });
  },
  async addCalibragem(id:string,input:any) { await ensurePneu(id); return prisma.$transaction(async tx=>{ const item=await tx.pneuCalibragem.create({data:{pneuId:id,data:parseDateOnly(input.data),pressaoRecomendada:Number(input.pressaoRecomendada),pressaoEncontrada:Number(input.pressaoEncontrada),pressaoAjustada:Number(input.pressaoAjustada),responsavel:input.responsavel,observacoes:input.observacoes||null}}); await tx.pneuEvento.create({data:{pneuId:id,tipo:"CALIBRAGEM",data:parseDateOnly(input.data),responsavel:input.responsavel,observacoes:`Calibragem: encontrada ${input.pressaoEncontrada}, ajustada ${input.pressaoAjustada}.`}}); return item; }); },
  async addRecapagem(id:string,input:any) { const pneu=await ensurePneu(id); if(Number(input.numeroRecapagem)>pneu.maxRecapagens) throw new AppError(400,"A quantidade máxima de recapagens foi atingida."); return prisma.$transaction(async tx=>{ const item=await tx.pneuRecapagem.create({data:{pneuId:id,empresaRecapadora:input.empresaRecapadora,dataEnvio:parseDateOnly(input.dataEnvio),dataRetorno:input.dataRetorno?parseDateOnly(input.dataRetorno):null,valor:Number(input.valor),garantiaMeses:Number(input.garantiaMeses||0),tipoRecapagem:input.tipoRecapagem,numeroRecapagem:Number(input.numeroRecapagem),observacoes:input.observacoes||null}}); await tx.pneu.update({where:{id},data:{recapagensRealizadas:{set:Math.max(pneu.recapagensRealizadas,Number(input.numeroRecapagem))},status:input.dataRetorno?"ESTOQUE":"RECAPAGEM",condicao:input.dataRetorno?"RECAPADO":"AGUARDANDO_RECAPAGEM",eventos:{create:{tipo:"RECAPAGEM",data:parseDateOnly(input.dataEnvio),observacoes:`${input.numeroRecapagem}ª recapagem enviada para ${input.empresaRecapadora}.`,dados:{valor:Number(input.valor),tipo:input.tipoRecapagem}}}}}); return item; }); },
  async addConserto(id:string,input:any) { await ensurePneu(id); return prisma.$transaction(async tx=>{ const item=await tx.pneuConserto.create({data:{pneuId:id,tipo:input.tipo,data:parseDateOnly(input.data),valor:Number(input.valor),responsavel:input.responsavel,observacoes:input.observacoes||null,fotosAntes:input.fotosAntes??[],fotosDepois:input.fotosDepois??[]}}); await tx.pneuEvento.create({data:{pneuId:id,tipo:"CONSERTO",data:parseDateOnly(input.data),responsavel:input.responsavel,observacoes:`Conserto registrado: ${input.tipo}.`,dados:{valor:Number(input.valor)}}}); return item; }); },
  async addInspecao(id:string,input:any) { await ensurePneu(id); const problemas=[input.cortes&&"cortes",input.bolhas&&"bolhas",input.trincas&&"trincas",input.desgasteIrregular&&"desgaste irregular",input.lonaAparente&&"lona aparente"].filter(Boolean); return prisma.$transaction(async tx=>{ const item=await tx.pneuInspecao.create({data:{pneuId:id,data:parseDateOnly(input.data),responsavel:input.responsavel,pressaoOk:input.pressaoOk,sulcoOk:input.sulcoOk,cortes:input.cortes,bolhas:input.bolhas,trincas:input.trincas,desgasteIrregular:input.desgasteIrregular,lonaAparente:input.lonaAparente,observacoes:input.observacoes||null,fotos:input.fotos??[]}}); await tx.pneuEvento.create({data:{pneuId:id,tipo:"INSPECAO",data:parseDateOnly(input.data),responsavel:input.responsavel,observacoes:problemas.length?`Inspeção com alertas: ${problemas.join(", ")}.`:"Inspeção realizada sem anomalias."}}); return item; }); },
};
