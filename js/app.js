/* ICER Empleo · app demo (prototipo).
   Cálculo: js/calculo.js es la librería DILCalculo del dashboard original, sin cambios. Las funciones de este archivo
   portadas del dashboard "Inteligencia Laboral ICER (Piloto Crit)" mantienen la misma lógica: umbral de secreto,
   intervalos <5, ≈, n/c por cambio CNAE, reedición SEPE y ruptura de serie municipal. */
(function(){
'use strict';
const C=window.DILCalculo;
const $=id=>document.getElementById(id);
let D=null;
const S={ccaa:'MADRID',capa:'ett',div:null,cno:null,tipo:'mes',clave:null,modo:'interanual',modoUsuario:'interanual',vista:'variacion',vistaForzada:false,sel:null,view:'inicio',
  rk:{agrupar:'mun',orden:'sube',q:'',n:30},tend:{ine:''}};
const COL_VAR=['#D2453A','#F0A79B','#ECE5D3','#9BD1BA','#1E8A62'],CORTES_VAR=[-10,-3,3,10];
const COL_VOL=['#EEF3F7','#CFDDE9','#A5C1D8','#6E9CC0','#3F74A3','#22527F','#10304F'],TRAMOS_VOL=COL_VOL.length;
const COL_INSUF='#CDD3DC',COL_CERO='#FFFFFF',COL_NO_PUB='#E8ECF2';
const NOMBRE_CAPA={ett:'Contratos ETT',temporal:'Contratación temporal'};
const MESES_LARGOS=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MESES_CORTOS=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const TXT_RUPTURA_MUN='La serie de este municipio cambia de nivel en enero de 2026 y se mantiene (posible cambio en la asignación de los contratos al municipio): no se compara con 2025.';
const NOTA_SECTOR='Suma de los municipios publicados: SEPE no publica el total de la comunidad o la provincia por sector.';

// ---------- formato ----------
const nf=new Intl.NumberFormat('es-ES',{maximumFractionDigits:0});
function nm(x){return nf.format(Math.round(x)).replace(/^(-?\d)(\d{3})$/,'$1.$2');}
function redondeo1(x){const r=Math.round(x*10)/10;return r===0?0:r;}
function pc(x){const r=redondeo1(x);return (r>0?'+':'')+r.toFixed(1).replace('.',',')+' %';}
function dec(x,n){return x.toFixed(n).replace('.',',');}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
const sgn=x=>(Math.round(x)>0?'+':'')+nm(x);
function txtAnios(l){return l.length>1?l.slice(0,-1).join(', ')+' y '+l[l.length-1]:(l[0]||'');}
function fechaLarga(f){const [y,m,d]=String(f||'').split('-').map(Number);return y&&m&&d?`${d} de ${MESES_LARGOS[m-1]} de ${y}`:String(f||'');}
function mesCorto(m){return MESES_CORTOS[Number(m.slice(5))-1]+' '+m.slice(2,4);}

// ---------- estado de la capa ----------
function capa(){return D[S.capa];}
function ultimo(){const m=capa().meses;return m[m.length-1];}
function etMes(m){return C.etiqueta(C.periodo('mes',m,m));}
function enFrase(t){return /^(T\d|Año)/.test(t)?t:t.charAt(0).toLowerCase()+t.slice(1);}
function rupturaMunCapa(k){const r=D.meta.ruptura_municipal||{};return r[k]||{};}
function meta(){return {frontera:D.meta.frontera,ruptura:(D.meta.ruptura_cnae||{})[S.capa]||{},inflados:S.capa==='temporal'?D.meta.inflados_temporal:{},rupturaMun:rupturaMunCapa(S.capa)};}
function nombreMun(ine){for(const c of Object.values(D.ccaa))if(c.municipios[ine])return c.municipios[ine].n;return ine;}
function filtro(){return {div:S.capa==='temporal'&&!S.div?'T':S.div,cno:S.capa==='ett'?S.cno:null};}
const cobCache={};
function cobertura(){if(S.capa!=='temporal')return null;return cobCache[S.capa]||(cobCache[S.capa]=C.cobertura(capa().filas,capa().meses));}
function esMenor5(v){return v&&v.lo===1&&v.hi===4;}
function txtValor(v){if(!v)return 'sin dato';if(esMenor5(v))return '&lt;5';return (C.aprox(v)?'≈ ':'')+nm(C.central(v));}
function txtCont(v,infl){if(infl)return 'n/c (reedición SEPE)';return v?txtValor(v)+' contratos':'sin dato';}
function txtValorI(v,infl){return infl?'n/c':txtValor(v);}
function variacionM(a,b,nc,reed,aviso,rmun){
  const r=C.variacion(a,b,{umbral:D.meta.umbral,nc:nc||reed||rmun});
  if(r.estado==='nc'&&reed)r.motivo='reedicion';
  else if(r.estado==='nc'&&rmun&&!nc)r.motivo='ruptura_mun';
  if(r.estado==='ok'&&aviso)r.aviso=true;
  return r;
}
const TXT_AVISO='⚠ cambio CNAE';
function txtVar(r){
  if(r.estado==='ok')return (r.aprox?'≈ ':'')+pc(r.pct)+(r.aviso?' '+TXT_AVISO:'');
  if(r.estado==='nc')return r.motivo==='reedicion'?'n/c (reedición SEPE)':r.motivo==='ruptura_mun'?'n/c (ruptura de serie)':'n/c (cambio CNAE)';
  return {insuficiente:'volumen insuficiente',sin_dato:'sin dato'}[r.estado];
}
function signo(r){const x=redondeo1(r.pct);return x>0?1:x<0?-1:0;}
function claseVar(r,v){return r.estado!=='ok'||(v&&v.compNoDisp)?'neutro':['baja','neutro','sube'][signo(r)+1];}
function claseFila(r){return r.estado==='ok'?['baja','neutro','sube'][signo(r)+1]:'neutro';}
function txtCifra(a,infl){return infl?'n/c':!a?'sin dato':(C.aprox(a)?'≈ ':'')+nm(C.central(a));}

// ---------- periodo y comparación ----------
function compDisponible(modo){return !motivoNoDisp(modo);}
function motivoNoDisp(modo,meses){
  const ms=meses||capa().meses,set=new Set(ms);
  const pB=C.comparacion(C.periodo(S.tipo,S.clave,ms[ms.length-1]),modo);
  if(!pB)return 'no aplica al acumulado';
  if(pB.meses.every(m=>set.has(m)))return '';
  if(modo==='interanual'){const anio=pB.meses[0].slice(0,4);return ms.some(m=>m.startsWith(anio))?`sin datos de ${enFrase(C.etiqueta(pB))}`:`sin datos de ${anio}`;}
  return 'fuera de los datos';
}
function ajustarPeriodo(){
  const ms=capa().meses;let ops=C.opcionesPeriodo(S.tipo,ms);
  if(!ops.length&&S.tipo!=='mes'){S.tipo='mes';ops=C.opcionesPeriodo('mes',ms);}
  const claves=ops.map(o=>o.clave);if(!claves.includes(S.clave))S.clave=claves[claves.length-1];
  const disp={interanual:!motivoNoDisp('interanual'),anterior:!motivoNoDisp('anterior')};
  const pref=S.modoUsuario,otro=pref==='interanual'?'anterior':'interanual';
  S.modo=disp[pref]?pref:disp[otro]?otro:pref;
  if(!disp[S.modo]){if(S.vista!=='volumen'){S.vista='volumen';S.vistaForzada=true;}}
  else if(S.vistaForzada){S.vista='variacion';S.vistaForzada=false;}
}
// ejecuta fn con algunos campos del estado cambiados (tarjetas de Inicio, serie de variaciones)
function con(over,fn){
  const prev={};for(const k in over){prev[k]=S[k];S[k]=over[k];}
  try{return fn();}finally{for(const k in prev)S[k]=prev[k];}
}

// ---------- cálculo por municipio (portado de calcular del original) ----------
let serieCache={clave:null,series:null};
function series(f){
  const k=`${S.capa}|${f.div}|${f.cno}`;
  if(serieCache.clave!==k)serieCache={clave:k,series:C.seriesPorMunicipio(capa().filas,capa().meses,f)};
  return serieCache.series;
}
function calcular(ccaa){
  ccaa=ccaa||S.ccaa;
  const L=capa(),f=filtro(),u=ultimo();
  const pA=C.periodo(S.tipo,S.clave,u),pB0=C.comparacion(pA,S.modo);
  const compNoDisp=!!pB0&&!compDisponible(S.modo);
  const pB=compNoDisp?null:pB0;
  const ser=series(f),cob=cobertura();
  const M=meta(),todos=new Set(L.meses),nc=C.noComparable(f.div,pA,pB,M),aviso=C.avisoCnae(f.div,pA,pB,M),infl=C.esInflado(f.div,pA,M),inflB=C.esInflado(f.div,pB,M);
  const pasada=forzar=>Object.entries(D.ccaa[ccaa].municipios).map(([ine,m])=>{
    const disp=cob?(cob.get(ine)||new Set()):todos;
    const publicado=!cob||cob.has(ine);
    const {a,b,va,vb}=C.parValores(ser.get(ine)||{},pA,pB,disp,forzar);
    const rm=C.rupturaMunicipal(ine,pA,pB,M);
    const r=variacionM(va,vb,nc,infl||inflB,aviso,rm);
    return {ine,nombre:m.n,publicado,a,b:vb,bTodo:b,va,vb,rm,r,infl,inflB};
  });
  let filas=pasada(false),media=false;
  if(filas.some(x=>(x.a&&x.a.parcial)||(x.bTodo&&x.bTodo.parcial))){filas=pasada(true);media=true;}
  return Object.assign({ccaa,capa:S.capa,pA,pB,pB0,compNoDisp,filas,porIne:new Map(filas.map(x=>[x.ine,x])),nc,aviso,infl,inflB,f,media},etiquetasPeriodo(pA,pB,todos,media));
}
function etiquetasPeriodo(pA,pB,todos,media){
  const enA=pA.meses.filter(m=>todos.has(m)),idx=pB?C.posicionesComunes(pA,pB,todos):[];
  const etA=C.etiquetaParcial(pA,enA);
  const etB=pB?(idx.length?C.etiquetaParcial(pB,idx.map(i=>pB.meses[i])):C.etiqueta(pB)):'';
  return {etA,etB,mediaTxt:media?'media mensual':''};
}
const etB=v=>v.etB||C.etiqueta(v.pB);
function parPropio(a,va){return !!(a&&va&&a.meses&&va.meses&&va.meses.length<a.meses.length);}
function etBx(v,x){return x&&parPropio(x.a,x.va)?C.etiquetaParcial(v.pB,x.vb.meses):etB(v);}
function notaPar(x){
  const ms=x.va.meses;
  return `La variación usa solo ${ms.length===1?'el mes':'los meses'} con dato en los dos periodos (${txtAnios(ms.map(m=>MESES_LARGOS[Number(m.slice(5))-1]))}): ${txtValor(x.va).replace('&lt;','<')} frente a ${txtValor(x.vb).replace('&lt;','<')} contratos${x.va.n>1?' de media mensual':''}.`;
}
function agregados(v){
  const conA=v.filas.filter(x=>x.a),conAB=v.filas.filter(x=>x.va&&x.vb&&!x.rm),sinRm=v.filas.filter(x=>x.rm&&x.va&&x.vb);
  const totA=C.sumar(conA.map(x=>x.a));
  const r=v.pB?variacionM(C.sumar(conAB.map(x=>x.va)),C.sumar(conAB.map(x=>x.vb)),v.nc,v.infl||v.inflB,v.aviso):{estado:'sin_dato'};
  return {conA,conAB,sinRm,totA,r,n:conA.length,nCon:conA.filter(x=>C.central(x.a)>0).length};
}
function notaBase(g,v){
  if(v.compNoDisp||!v.pB||g.r.estado!=='ok')return '';
  const p=[];
  if(g.conAB.length+g.sinRm.length<g.conA.length)p.push(`sobre ${g.conAB.length} ${g.conAB.length===1?'municipio':'municipios'} con dato en ambos periodos`);
  if(g.sinRm.length)p.push(`sin ${g.sinRm.map(x=>x.nombre).join(', ')}, con ruptura de serie`);
  return p.length?` (${p.join('; ')})`:'';
}
function fraseVar(r,v){
  if(v.compNoDisp)return `Comparación no disponible: los datos empiezan en ${enFrase(etMes(capa().meses[0]))}`;
  if(!v.pB)return '';
  const s=r.estado==='ok'?signo(r):0;
  return `${s>0?'▲ ':s<0?'▼ ':''}${txtVar(r)} frente a ${enFrase(etB(v))}`;
}
function hayAutonomico(){return S.capa==='temporal'&&!!D.ccaa_total_temporal;}
function autonomico(v){
  if(!hayAutonomico()||S.div)return null;
  return C.totalAutonomico(D.ccaa_total_temporal[v.ccaa],v.pA,v.pB,new Set(capa().meses),{umbral:D.meta.umbral,media:v.media});
}
// cifra del territorio: total SEPE (temporal sin sector) o suma de municipios, como la cabecera del original
function totalComunidad(v){
  const g=agregados(v);
  const auto=autonomico(v),cuota=auto?C.cuota(g.totA,auto.a):null;
  const med=v.media?', media mensual':'';
  const rotulo=auto?`Total ${D.ccaa[v.ccaa].nombre} (SEPE), contratos temporales${med}`:
    S.capa==='temporal'?`Total de ${g.conA.length} ${g.conA.length===1?'municipio publicado':'municipios publicados'} (más de 20.000 hab.)${med}`:
    `Contratos ETT, suma de ${g.conA.length} ${g.conA.length===1?'municipio':'municipios'}${med}`;
  const a=auto?auto.a:g.totA,r=auto?auto.r:g.r;
  return {g,auto,cuota,a,r,cifra:auto?txtCifra(auto.a):txtCifra(g.totA,v.infl),varTxt:fraseVar(r,v)+(auto?'':notaBase(g,v)),cls:claseVar(r,v),rotulo,
    nota:auto&&cuota!=null?`${g.n===1?'El municipio publicado suma':`Los ${g.n} municipios publicados suman`} ${txtCifra(g.totA,v.infl)} (el ${dec(cuota,1)} %).`:hayAutonomico()&&S.div?NOTA_SECTOR:''};
}
function coberturaTxt(v){
  const cob=cobertura();if(!cob)return '';
  const n=v.filas.filter(x=>{const s=cob.get(x.ine);return s&&v.pA.meses.some(m=>s.has(m));}).length;
  const fuera=v.filas.filter(x=>{const s=cob.get(x.ine);return s&&v.pA.meses.some(m=>s.has(m))&&!x.a;}).length;
  return `SEPE publica la contratación temporal de ${nm(n)} de ${nm(v.filas.length)} municipios de ${D.ccaa[S.ccaa].nombre}`+
    (fuera?`; ${nm(fuera)} no ${fuera===1?'tiene':'tienen'} todos los meses del periodo y no se ${fuera===1?'suma':'suman'}`:'')+'.';
}

// ---------- mapa: color por estado ----------
function estadoMapa(x,vista){
  if(!x.publicado)return 'no_publicado';
  if(vista==='volumen'){if(x.infl)return 'insuficiente';if(!x.a)return 'sin_dato';return C.central(x.a)===0?'cero':'vol';}
  if(x.r.estado==='ok')return 'ok';
  if(x.r.estado==='nc')return 'insuficiente';
  if(x.a&&C.central(x.a)===0&&(!x.b||C.central(x.b)===0))return 'cero';
  if(!x.a||!x.b)return 'sin_dato';
  return 'insuficiente';
}
function color(x,vista){
  switch(estadoMapa(x,vista)){
    case 'no_publicado':return COL_NO_PUB;case 'sin_dato':return 'url(#puntos)';case 'cero':return COL_CERO;
    case 'insuficiente':return COL_INSUF;case 'vol':return x.colVol;default:return COL_VAR[tramoVar(x.r.pct,CORTES_VAR)];
  }
}
function tramoVar(x,cortes){const k=redondeo1(x),a=Math.abs(k),lejos=cortes[3],cerca=cortes[2];if(a<cerca)return 2;return k>0?(a>=lejos?4:3):(a>=lejos?0:1);}
function colTramo(k,n){return COL_VOL[n===1?3:Math.round(k*(TRAMOS_VOL-1)/(n-1))];}
function cuantiles(filas){
  const vals=filas.filter(x=>x.publicado&&!x.infl&&x.a&&C.central(x.a)>0).map(x=>C.central(x.a));
  const cortes=C.cortesCuantiles(vals,TRAMOS_VOL),n=cortes.length+1;
  for(const x of filas)if(x.a){const c=C.central(x.a);const i=cortes.findIndex(k=>c<=k);x.colVol=colTramo(i<0?n-1:i,n);}
  return {cortes,n,max:vals.length?Math.max(...vals):0};
}
function tramosVol(q){
  if(!q.max)return [];const {cortes:k,n}=q;
  if(n===1)return [[colTramo(0,1),`Hasta ${nm(q.max)}`]];
  return Array.from({length:n},(_,j)=>[colTramo(j,n),j===0?`Hasta ${nm(k[0])}`:j===n-1?`Más de ${nm(k[n-2])}`:`${nm(k[j-1])} a ${nm(k[j])}`]);
}

// ---------- explorador: por municipio, sector u ocupación (portado de calcularExplorador) ----------
function calcularExplorador(agrupar,orden,selIne){
  const k=S.capa,L=D[k],M=meta(),muns=D.ccaa[S.ccaa].municipios;
  if(k==='temporal'&&agrupar==='cno')agrupar='div';
  const sel=selIne&&muns[selIne]?selIne:null;if(sel&&agrupar==='mun')agrupar='div';
  const u=L.meses[L.meses.length-1],pA=C.periodo(S.tipo,S.clave,u),pB0=C.comparacion(pA,S.modo);
  const compNoDisp=!!pB0&&!compDisponible(S.modo),pB=compNoDisp?null:pB0;
  const cob=k==='temporal'?cobertura():null,todos=new Set(L.meses),porMun=agrupar==='mun';
  let ines=sel?[sel]:Object.keys(muns);const avisos=[];
  if(cob&&!porMun){
    const ms=pA.meses.concat(pB?pB.meses:[]).filter(m=>todos.has(m));
    const pub=ines.filter(i=>cob.has(i)),comp=pub.filter(i=>ms.every(m=>cob.get(i).has(m)));
    if(sel&&!pub.length)avisos.push('SEPE no publica la contratación temporal de este municipio: solo publica la de los municipios de más de 20.000 hab. de su propia lista.');
    else if(comp.length<pub.length)avisos.push(`La suma usa ${comp.length===1?'el único municipio publicado':`los ${nm(comp.length)} municipios publicados`} todos los meses de los dos periodos (de ${nm(pub.length)} publicados hoy).`);
    ines=comp;
  }
  const rmun=(D.meta.ruptura_municipal||{})[k]||{},cruza=!!pB&&C.cruzaFrontera(pA,pB,M);
  let fueraRm=[];
  if(cruza&&!porMun){fueraRm=ines.filter(i=>rmun[i]!=null);if(fueraRm.length){ines=ines.filter(i=>rmun[i]==null);avisos.push(`Las filas no incluyen ${txtAnios(fueraRm.map(i=>muns[i].n))} (su serie cambia de nivel en enero de 2026 y la comparación cruza esa fecha). El total sí lo cuenta en los contratos, pero no en la variación.`);}}
  const cno=k==='ett'?S.cno:null;
  const ser=C.seriesExplorador(L.filas,L.meses,{ines:new Set(ines),div:S.div,cno,agrupar,conTotal:k==='temporal'});
  const nombre=key=>agrupar==='mun'?(muns[key]?muns[key].n:key):`${key} ${(agrupar==='div'?D.sectores:D.ocupaciones)[key]||''}`.trim();
  const pasada=forzar=>[...ser.entries()].map(([key,serie])=>{
    const disp=porMun&&cob?(cob.get(key)||new Set()):todos;
    const {a,va,vb}=C.parValores(serie,pA,pB,disp,forzar);
    const div=agrupar==='div'?key:S.div;
    const nc=C.noComparable(div,pA,pB,M),aviso=C.avisoCnae(div,pA,pB,M),infl=C.esInflado(div,pA,M)||C.esInflado(div,pB,M);
    const rm=porMun&&C.rupturaMunicipal(key,pA,pB,M);
    const r=pB?variacionM(va,vb,nc,infl,aviso,rm):{estado:'sin_dato'};
    const dif=r.estado==='nc'||!va||!vb?null:C.central(va)-C.central(vb);
    return {k:key,nombre:nombre(key),a,va,vb,r,dif,infl};
  }).filter(x=>(x.a&&C.central(x.a)>0)||(x.vb&&C.central(x.vb)>0));
  let filas=pasada(false),media=false;
  if(filas.some(x=>x.a&&x.a.parcial)){filas=pasada(true);media=true;}
  const conAB=filas.filter(x=>x.va&&x.vb&&!(x.r.estado==='nc'&&x.r.motivo==='ruptura_mun'));
  const rmF=filas.filter(x=>x.r.estado==='nc'&&x.r.motivo==='ruptura_mun');
  if(rmF.length)avisos.push(`${txtAnios(rmF.map(x=>x.nombre))} sale n/c: su serie cambia de nivel en enero de 2026. El total lo cuenta en los contratos, pero no en la variación.`);
  let extra=[];
  if(fueraRm.length){const s2=C.seriesExplorador(L.filas,L.meses,{ines:new Set(fueraRm),div:S.div,cno,agrupar:'mun',conTotal:k==='temporal'});extra=[...s2.values()].map(serie=>C.parValores(serie,pA,pB,todos,media));}
  const sinRm=rmF.map(x=>x.nombre).concat(fueraRm.map(i=>muns[i].n));
  const tot={a:C.sumar(filas.map(x=>x.a).concat(extra.map(x=>x.a))),vbMostrar:C.sumar(filas.map(x=>x.vb).concat(extra.map(x=>x.vb))),va:C.sumar(conAB.map(x=>x.va)),vb:C.sumar(conAB.map(x=>x.vb)),sinRm};
  const nc=C.noComparable(S.div,pA,pB,M)||C.esInflado(S.div,pA,M)||C.esInflado(S.div,pB,M);
  tot.r=pB?variacionM(tot.va,tot.vb,nc,false,C.avisoCnae(S.div,pA,pB,M)):{estado:'sin_dato'};
  tot.dif=tot.r.estado==='nc'||!tot.va||!tot.vb?null:C.central(tot.va)-C.central(tot.vb);
  return Object.assign({k,pA,pB,pB0,compNoDisp,sel,filas:ordenarExplorador(filas,orden||'vol'),tot,media,avisos,agrupar},etiquetasPeriodo(pA,pB,todos,media));
}
function ordenarExplorador(filas,orden){
  const vol=(p,q)=>C.central(q.a||{lo:0,hi:0})-C.central(p.a||{lo:0,hi:0})||(p.k<q.k?-1:1);
  const d=x=>x.dif==null?null:x.dif;
  const cmp=orden==='vol'?vol:orden==='pct'?(p,q)=>{const a=p.r.estado==='ok',b=q.r.estado==='ok';return a!==b?(a?-1:1):a?(q.r.pct-p.r.pct)||vol(p,q):vol(p,q);}
    :(p,q)=>{const a=d(p),b=d(q);if(a==null||b==null)return a==null&&b==null?vol(p,q):a==null?1:-1;return (orden==='cae'?a-b:b-a)||vol(p,q);};
  return filas.slice().sort(cmp);
}
function txtDifEx(x){if(x.r.estado==='nc')return 'n/c';if(x.dif==null)return '';const ap=(x.r.estado==='ok'&&x.r.aprox)||C.aprox(x.va)||C.aprox(x.vb);return (ap?'≈ ':'')+sgn(x.dif);}
function txtPctEx(x){
  if(x.r.estado==='ok'||x.r.estado==='nc')return txtVar(x.r);
  if(x.r.estado==='insuficiente'){const u=D.meta.umbral,ba=C.base(x.va||{lo:0,hi:0}),bb=C.base(x.vb||{lo:0,hi:0});return ba<u&&bb<u?'volumen insuficiente':bb<u?(bb>0?`antes menos de ${u}`:'nueva'):`ahora menos de ${u}`;}
  return '';
}
// sectores u ocupaciones principales de un municipio (portado de topDesglose)
function topDesglose(ine,campo,v){
  const L=capa(),cat=campo===2?D.sectores:D.ocupaciones,cob=cobertura();
  const disp=cob?(cob.get(ine)||new Set()):new Set(L.meses);
  const d=C.desglose(L.filas,L.meses,ine,campo,v.f.div==='T'?{div:null,cno:v.f.cno}:v.f);
  const filas=[...d.entries()].map(([k,serie])=>{
    const {a,va,vb}=C.parValores(serie,v.pA,v.pB,disp,v.media);
    const nc=campo===2?C.noComparable(k,v.pA,v.pB,meta()):v.nc,aviso=campo===2?C.avisoCnae(k,v.pA,v.pB,meta()):v.aviso;
    const inflA=campo===2?C.esInflado(k,v.pA,meta()):v.infl,inflB=campo===2?C.esInflado(k,v.pB,meta()):v.inflB;
    return {k,nombre:`${k} ${cat[k]||''}`,a,inflA,reed:inflA||inflB,r:variacionM(va,vb,nc,inflA||inflB,aviso,C.rupturaMunicipal(ine,v.pA,v.pB,meta()))};
  }).filter(x=>x.a&&C.central(x.a)>0);
  return filas.filter(x=>!x.reed).sort((p,q)=>C.central(q.a)-C.central(p.a)).slice(0,10).concat(filas.filter(x=>x.reed));
}

// ---------- series mensuales (Tendencias) ----------
// ETT: suma de municipios; temporal sin sector y sin municipio: total SEPE del territorio; temporal con sector: suma de publicados
function serieMensual(ine){
  const L=capa(),f=filtro(),muns=D.ccaa[S.ccaa].municipios,cob=cobertura();
  if(S.capa==='temporal'&&!S.div&&!ine){const s=D.ccaa_total_temporal[S.ccaa];return {fuente:'sepe',meses:L.meses,vals:L.meses.map(m=>m in s?s[m]:null),n:null};}
  const ser=series(f),vals=[],n=[];
  for(const m of L.meses){
    let t=0,c=0;
    for(const i of (ine?[ine]:Object.keys(muns))){
      if(cob&&!(cob.get(i)&&cob.get(i).has(m)))continue;
      c++;const w=(ser.get(i)||{})[m];if(w)t+=(w[0]+w[1])/2;
    }
    vals.push(c?t:null);n.push(c);
  }
  return {fuente:S.capa==='temporal'?'publicados':'municipios',meses:L.meses,vals,n};
}
// variación interanual de cada mes, con las mismas reglas que la cifra del periodo
function variacionesMensuales(ine){
  const ms=capa().meses,set=new Set(ms);
  return ms.map(m=>{
    if(!set.has(C.sumarMes(m,-12)))return {mes:m,r:null};
    return con({tipo:'mes',clave:m,modo:'interanual'},()=>{
      const v=calcular();
      if(ine){const x=v.porIne.get(ine);return {mes:m,r:x?x.r:{estado:'sin_dato'}};}
      return {mes:m,r:totalComunidad(v).r};
    });
  });
}

// ---------- CSV (mismo formato que el original) ----------
function marcaCsv(x,v){
  if(!x.publicado)return 'no_publicado';if(x.infl||x.inflB)return 'reedicion_sepe';if(!x.a)return 'sin_dato';
  const m=[];
  if(esMenor5(x.a))m.push('<5');else if(C.aprox(x.a)||(x.r.estado==='ok'&&x.r.aprox))m.push('aprox');
  if(v.media)m.push('media_mensual');if(x.r.aviso)m.push('aviso_cnae');
  if(x.r.estado==='nc')m.push(x.r.motivo==='ruptura_mun'?'ruptura_serie':'n/c');
  else if(x.r.estado==='insuficiente')m.push('insuficiente');else if(x.r.estado==='sin_dato'&&v.pB)m.push('sin_dato');
  return m.join(',');
}
const q=s=>`"${String(s??'').replace(/"/g,'""')}"`;
function filasCsv(v){
  const cab=['ine','municipio','capa','sector','ocupacion','periodo','valor','valor_mismos_meses','comparacion','valor_comparacion','variacion_pct','marca'];
  const val=w=>w?(esMenor5(w)?'<5':dec(C.central(w),v.media?1:0)):'';
  const comp=v.compNoDisp?'No disponible':v.pB?etB(v):'';
  const lin=v.filas.map(x=>[x.ine,x.nombre,S.capa,S.div||'',S.capa==='ett'?(S.cno||''):'',v.etA+(v.media?`, ${v.mediaTxt}`:''),x.infl||x.inflB?'':val(x.a),
    x.infl||x.inflB||!v.pB?'':val(x.va),v.pB&&!v.compNoDisp?etBx(v,x):comp,x.infl||x.inflB?'':val(x.b),x.r.estado==='ok'?dec(x.r.pct,1):'',marcaCsv(x,v)].map(q).join(';'));
  return [cab.join(';'),...lin];
}
const TXT_AGRUPAR={mun:'Municipio',div:'Sector',cno:'Ocupación'};
function filasCsvExplorador(c){
  const val=w=>w?(esMenor5(w)?'<5':dec(C.central(w),c.media?1:0)):'';
  const cab=['agrupar','codigo','nombre','capa','ambito','sector','ocupacion','periodo','contratos','comparacion','contratos_comparacion','variacion','variacion_pct','estado'];
  const amb=c.sel||(D.ccaa[S.ccaa].todo||'').split(' ').pop();
  const lin=c.filas.map(x=>[TXT_AGRUPAR[c.agrupar].toLowerCase(),x.k,x.nombre,c.k,amb,S.div||'',c.k==='ett'?(S.cno||''):'',c.etA+(c.media?`, ${c.mediaTxt}`:''),
    x.infl?'':val(x.a),c.pB?c.etB:'',val(x.vb),x.dif==null?'':dec(x.dif,c.media?1:0),x.r.estado==='ok'?dec(x.r.pct,1):'',
    x.r.estado==='nc'?(x.r.motivo==='ruptura_mun'?'ruptura_serie':'n/c'):x.r.estado].map(q).join(';'));
  return [cab.join(';'),...lin];
}
function descargar(lineas,nombre){
  const blob=new Blob(['\uFEFF'+lineas.join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=nombre;a.style.display='none';document.body.appendChild(a);a.click();
  setTimeout(()=>{a.remove();URL.revokeObjectURL(url);},0);toast('CSV descargado: '+nombre);
}

// ---------- avisos de contexto (notas de metodología donde aplican) ----------
function avisosVista(v,T,sinCobertura){
  const l=[];
  if(S.capa==='temporal'&&!sinCobertura){const c=coberturaTxt(v);if(c)l.push(['',c]);}
  if(T&&T.nota)l.push(['',T.nota]);
  if(v.compNoDisp)l.push(['warn',`Comparación no disponible: los datos de ${NOMBRE_CAPA[S.capa].toLowerCase()} empiezan en ${enFrase(etMes(capa().meses[0]))}.`]);
  if(v.nc&&S.div)l.push(['nc',`El sector ${S.div} cambió de clasificación con la CNAE-2025 (enero de 2026): su comparación con 2025 no es fiable y se marca n/c.`]);
  else if(v.aviso&&S.div)l.push(['warn',`⚠ El sector ${S.div} cambió de clasificación con la CNAE-2025: compárelo con cautela.`]);
  else if(S.div&&(D.meta.alteradas||[]).includes(S.div)&&v.pB&&C.cruzaFrontera(v.pA,v.pB,meta()))l.push(['',`La división ${S.div} es una de las afectadas por el cambio CNAE-2009 → CNAE-2025; en esta capa su evolución sigue la del total y se compara.`]);
  if(v.media)l.push(['',`Algún periodo está incompleto: las cifras van en ${v.mediaTxt} y la variación compara los mismos meses.`]);
  if(S.capa==='temporal'&&S.cno)l.push(['warn','SEPE no publica ocupación con temporalidad: la ocupación elegida no se aplica en esta capa.']);
  return l.map(([c,t])=>`<p class="aviso ${c}">${esc(t)}</p>`).join('');
}

// ================= interfaz =================
function toast(t){const el=$('toast');el.textContent=t;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>{el.hidden=true;},2600);}
function nombreSector(k){return k?`${k} ${D.sectores[k]||''}`.trim():'Todos los sectores';}
function nombreOcup(k){return k?`${k} ${D.ocupaciones[k]||''}`.trim():'Todas las ocupaciones';}
function etPeriodoActual(){return C.etiqueta(C.periodo(S.tipo,S.clave,ultimo()));}
const TXT_TIPO={mes:'Mes',trim:'Trimestre',acum:'Acumulado del año'};
const TXT_MODO={interanual:'Mismo periodo del año anterior',anterior:'Periodo anterior'};

function pintarCabecera(){
  $('seg-ccaa').innerHTML=Object.entries(D.ccaa).map(([k,c])=>`<button type="button" data-ccaa="${k}" aria-pressed="${k===S.ccaa}">${k==='MADRID'?'Madrid':'Valencia'}</button>`).join('');
  const chips=[
    ['capa',`<b>${NOMBRE_CAPA[S.capa]}</b>`],
    ['periodo',`${esc(etPeriodoActual())}`],
    ['modo',S.modo==='interanual'?'vs. año anterior':'vs. periodo anterior'],
  ];
  if(S.div)chips.push(['div',`Sector <b>${esc(S.div)}</b> ${esc(D.sectores[S.div]||'')}<span class="x">×</span>`]);
  if(S.cno&&S.capa==='ett')chips.push(['cno',`Ocupación <b>${esc(S.cno)}</b> ${esc(D.ocupaciones[S.cno]||'')}<span class="x">×</span>`]);
  $('chips').innerHTML=chips.map(([k,h])=>`<button type="button" class="chip${k==='div'||k==='cno'?' activo':''}" data-chip="${k}">${h}</button>`).join('');
  const n=(S.div?1:0)+(S.cno&&S.capa==='ett'?1:0)+(S.tipo!=='mes'||S.clave!==ultimo()?1:0)+(S.modoUsuario!=='interanual'?1:0);
  $('n-filtros').hidden=!n;$('n-filtros').textContent=n;
}

// ---------- hoja inferior ----------
let hojaTipo=null;
function abrirHoja(html,tipo){hojaTipo=tipo;$('hoja-cuerpo').innerHTML=html;$('hoja').hidden=false;$('velo').hidden=false;$('hoja').scrollTop=0;}
function cerrarHoja(){$('hoja').hidden=true;$('velo').hidden=true;hojaTipo=null;}

// ---------- minigráficos ----------
function sparkline(vals,o){
  o=o||{};const W=o.w||260,H=o.h||46,p=3;
  const xs=vals.map((v,i)=>[i,v]).filter(q=>q[1]!=null);if(xs.length<2)return '';
  const mx=Math.max(...xs.map(q=>q[1])),mn=Math.min(0,...xs.map(q=>q[1]));
  const x=i=>(p+i*(W-2*p)/(vals.length-1)).toFixed(1),y=v=>(H-p-(v-mn)/((mx-mn)||1)*(H-2*p)).toFixed(1);
  const pts=xs.map(([i,v])=>`${x(i)},${y(v)}`).join(' ');
  const last=xs[xs.length-1];
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none" aria-hidden="true">`+
    `<polyline fill="none" stroke="${o.col||'#213B7C'}" stroke-width="2" vector-effect="non-scaling-stroke" points="${pts}"/>`+
    `<circle cx="${x(last[0])}" cy="${y(last[1])}" r="3" fill="${o.col||'#213B7C'}"/></svg>`;
}

// ---------- INICIO ----------
function tarjetaKpi(capaK,tipo){
  const L=D[capaK],u=L.meses[L.meses.length-1];
  return con({capa:capaK,tipo,clave:tipo==='mes'?u:C.opcionesPeriodo(tipo,L.meses).slice(-1)[0].clave,modo:'interanual',modoUsuario:'interanual',vista:S.vista,vistaForzada:S.vistaForzada,cno:capaK==='ett'?S.cno:null},()=>{
    ajustarPeriodo();
    const v=calcular(),T=totalComunidad(v);
    const ser=serieMensual(),vals=ser.vals.slice(-18);
    return `<article class="tarjeta kpi ${capaK}" data-ir="mapa" data-capa="${capaK}" data-tipo="${tipo}">
      <div class="kpi-cab"><span class="kpi-tit">${esc(NOMBRE_CAPA[capaK])}</span><span class="kpi-per">${esc(v.etA)}${v.media?'<br>media mensual':''}</span></div>
      <div class="kpi-cifra">${esc(T.cifra)}</div>
      <div class="kpi-var"><span class="pastilla ${T.cls}">${esc(T.varTxt.split(' frente a ')[0]||'—')}</span> <span class="neutro" style="font-weight:400;font-size:.8rem">frente a ${esc(enFrase(etB(v)||''))}</span></div>
      <div class="kpi-rot">${esc(T.rotulo)}</div>
      <div class="kpi-spark">${sparkline(vals,{col:capaK==='ett'?'#213B7C':'#E8A33D'})}</div>
    </article>`;
  });
}
function pintarInicio(){
  const terr=D.ccaa[S.ccaa].nombre;
  let h=`<div class="saludo"><h1>${esc(terr)}</h1><p>Últimos datos SEPE: ${esc(etMes(D.ett.meses[D.ett.meses.length-1]))} · actualizado el ${esc(fechaLarga(D.meta.generado))}${S.div?` · sector ${esc(nombreSector(S.div))}`:''}</p></div>`;
  h+=`<div class="kpis">${tarjetaKpi('ett','mes')}${tarjetaKpi('temporal','mes')}${tarjetaKpi('ett','acum')}${tarjetaKpi('temporal','acum')}</div>`;
  // rankings con los filtros activos (capa y periodo de la barra)
  const v=calcular(),R=C.rankingVariacion(v.filas,6),c=calcularExplorador('div','vol');
  const filaR=x=>{const ok=x.r.estado==='ok',ap=(ok&&x.r.aprox)||C.aprox(x.va)||C.aprox(x.vb),u=D.meta.umbral;
    const pct=ok?txtVar(x.r):C.base(x.vb)<u?`antes menos de ${u}`:`ahora menos de ${u}`;
    return `<li class="clic" data-mun="${x.ine}"><div class="nom"><b>${esc(x.nombre)}</b><small>${txtValor(x.va)} contratos</small></div><div class="val"><b class="${x.dif>0?'sube':'baja'}">${ap?'≈ ':''}${sgn(x.dif)}</b><small class="${ok?claseFila(x.r):'neutro'}">${pct}</small></div></li>`;};
  const cab=`${esc(NOMBRE_CAPA[S.capa])} · ${esc(v.etA)}${v.pB?` vs ${esc(etB(v))}`:''}`;
  const vacio=t=>`<p class="vacio">Ningún municipio con al menos ${C.UMBRAL_RANKING} contratos ${t}.</p>`;
  h+=`<div class="rejilla2">
    <section class="tarjeta"><div class="tarj-cab"><h2>Municipios que más crecen</h2><a href="#ranking">Ver ranking →</a></div><p class="sub">${cab}</p>
      ${v.pB?(R.suben.length?`<ul class="lista">${R.suben.map(filaR).join('')}</ul>`:vacio('crece')):'<p class="vacio">Comparación no disponible para este periodo.</p>'}</section>
    <section class="tarjeta"><div class="tarj-cab"><h2>Municipios que más caen</h2><a href="#ranking">Ver ranking →</a></div><p class="sub">${cab}</p>
      ${v.pB?(R.bajan.length?`<ul class="lista">${R.bajan.map(filaR).join('')}</ul>`:vacio('cae')):'<p class="vacio">Comparación no disponible para este periodo.</p>'}</section>
  </div>`;
  const top=c.filas.slice(0,8),mx=Math.max(1,...top.map(x=>x.a?C.central(x.a):0));
  h+=`<section class="tarjeta" style="margin-top:12px"><div class="tarj-cab"><h2>Sectores con más contratos</h2><a href="#ranking" data-rk="div">Ver todos →</a></div><p class="sub">${cab}</p>
    ${c.avisos.map(a=>`<p class="aviso">${esc(a)}</p>`).join('')}
    <ul class="lista">${top.map(x=>`<li class="clic" data-div="${esc(x.k)}"><div class="nom"><b><span class="cod">${esc(x.k)}</span>${esc(x.nombre.slice(x.k.length+1))}</b><div class="barra"><i style="width:${(x.a?C.central(x.a):0)/mx*100}%"></i></div></div><div class="val"><b>${txtValorI(x.a,x.infl)}</b><small class="${x.r.estado==='ok'?claseFila(x.r):'neutro'}">${txtPctEx(x)}</small></div></li>`).join('')}</ul></section>`;
  h+=`<div class="avisos">${avisosVista(v,null)}</div>`;
  $('v-inicio').innerHTML=h;
}

// ---------- MAPA ----------
let BASE={x:0,y:0,w:1000,h:800},vistaM=null,centros={},mapaDe=null,proy=null,ultimaV=null;
const Z_MIN=1,Z_MAX=12,PASO_ZOOM=1.5,MARCA_MIN=6;
function areaPlano(r){let a=0;for(let i=0,j=r.length-1;i<r.length;j=i++)a+=(r[j][0]+r[i][0])*(r[j][1]-r[i][1]);return a/2;}
function prepararMapa(){
  const muns=D.ccaa[S.ccaa].municipios,G=GEO[S.ccaa];let x0=180,x1=-180,y0=90,y1=-90;
  for(const ine in muns)for(const poli of G[ine]||[])for(const [x,y] of poli[0]){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  const k=Math.cos((y0+y1)/2*Math.PI/180),b=C.vistaBase((x1-x0)*k,y1-y0);
  BASE={x:0,y:0,w:b.w,h:b.h};vistaM=Object.assign({},BASE);
  proy=([x,y])=>[(b.ox+(x-x0)*k*b.esc).toFixed(1),(b.oy+(y1-y)*b.esc).toFixed(1)];
  centros={};const dMapa={};
  for(const ine in muns){
    const g=G[ine]||[];if(!g.length)continue;
    const anillos=g.map(p=>p.map(r=>r.map(q=>proy(q).map(Number))));
    if(anillos.every(p=>Math.abs(areaPlano(p[0]))<1)){
      const pts=anillos.flatMap(p=>p[0]),cx=pts.reduce((t,q)=>t+q[0],0)/pts.length,cy=pts.reduce((t,q)=>t+q[1],0)/pts.length,h=MARCA_MIN/2;
      centros[ine]=[cx,cy];dMapa[ine]=`M${(cx-h).toFixed(1)},${(cy-h).toFixed(1)}h${MARCA_MIN}v${MARCA_MIN}h-${MARCA_MIN}Z`;
    }else{centros[ine]=C.centroideMayor(anillos);dMapa[ine]=g.map(p=>p.map(r=>'M'+r.map(proy).join('L')+'Z').join('')).join('');}
  }
  const svg=$('mapa');
  svg.innerHTML='<defs><pattern id="puntos" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="#F1F3F7"/><circle cx="2.5" cy="2.5" r="0.9" fill="#A3ACBA"/></pattern></defs>'+
    Object.keys(dMapa).map(ine=>`<path data-ine="${ine}" d="${dMapa[ine]}" tabindex="0" role="button" aria-label="${esc(muns[ine].n)}"></path>`).join('')+'<g id="rotulos"></g>';
  mapaDe=S.ccaa;fijarVista(vistaM);
}
function fijarVista(v){vistaM=v;$('mapa').setAttribute('viewBox',`${v.x.toFixed(1)} ${v.y.toFixed(1)} ${v.w.toFixed(1)} ${v.h.toFixed(1)}`);pintarRotulos();}
function escalaPantalla(){const r=$('mapa').getBoundingClientRect();return r.width?Math.max(vistaM.w/r.width,vistaM.h/r.height):1;}
function aLienzo(cx,cy){const r=$('mapa').getBoundingClientRect(),s=escalaPantalla();return [vistaM.x+(cx-r.left)*s-(r.width*s-vistaM.w)/2,vistaM.y+(cy-r.top)*s-(r.height*s-vistaM.h)/2];}
function zoomEn(f,px,py){if(px==null){px=vistaM.x+vistaM.w/2;py=vistaM.y+vistaM.h/2;}fijarVista(C.zoomVista(vistaM,f,px,py,BASE,Z_MIN,Z_MAX));}
function desplazar(dx,dy){fijarVista(C.desplazarVista(vistaM,dx,dy,BASE,Z_MIN,Z_MAX));}
function pesoRotulo(x){
  if(!x.publicado)return null;
  if(S.vista==='volumen'){if(x.infl||!x.a)return null;const c=C.central(x.a);return c>0?c:null;}
  return x.r.estado==='ok'&&x.va&&x.vb?Math.abs(C.central(x.va)-C.central(x.vb)):null;
}
function pintarRotulos(){
  const g=$('rotulos'),v=ultimaV;if(!g||!v||S.view!=='mapa')return;
  const esc2=escalaPantalla(),PX=11;
  const cands=v.filas.filter(x=>centros[x.ine]).map(x=>({ine:x.ine,nombre:x.nombre,x:centros[x.ine][0],y:centros[x.ine][1],peso:pesoRotulo(x)}));
  const r=C.elegirRotulos(cands,{zoom:BASE.w/vistaM.w,sel:S.sel,escala:esc2,px:PX,vista:vistaM,obstaculos:[]});
  g.setAttribute('font-size',(PX*esc2).toFixed(2));g.setAttribute('stroke-width',(3*esc2).toFixed(2));
  g.innerHTML=r.map(c=>`<text x="${c.x.toFixed(1)}" y="${c.y.toFixed(1)}">${esc(c.nombre)}</text>`).join('');
}
function leyendaHtml(q){
  const i=(c,t)=>`<span><i style="background:${c}"></i>${t}</span>`;
  const base=(S.capa==='temporal'?i(COL_NO_PUB,'No publicado por SEPE (menos de 20.000 hab.)'):'')+
    i(COL_INSUF,S.vista==='variacion'?`Volumen insuficiente (menos de ${D.meta.umbral}) o n/c`:'n/c')+
    i('repeating-radial-gradient(#A3ACBA 0 1px,#F1F3F7 1px 4px)','Sin dato')+i(COL_CERO,S.capa==='ett'?'Sin contratos ETT':'Sin contratos');
  return S.vista==='variacion'
    ?i(COL_VAR[0],'Cae 10 % o más')+i(COL_VAR[1],'Cae 3–10 %')+i(COL_VAR[2],'Estable (&lt;3 %)')+i(COL_VAR[3],'Crece 3–10 %')+i(COL_VAR[4],'Crece 10 % o más')+base
    :tramosVol(q).map(([c,t])=>i(c,t)).join('')+base;
}
function pintarMapa(){
  if(mapaDe!==S.ccaa)prepararMapa();
  const v=calcular(),T=totalComunidad(v);ultimaV=v;
  const q=cuantiles(v.filas);
  const svg=$('mapa');
  svg.querySelectorAll('path').forEach(p=>{const x=v.porIne.get(p.dataset.ine);if(!x)return;p.setAttribute('fill',color(x,S.vista));p.classList.toggle('sel',p.dataset.ine===S.sel);});
  $('mapa-tit').textContent=`${NOMBRE_CAPA[S.capa]} · ${D.ccaa[S.ccaa].nombre}`;
  $('mapa-sub').textContent=`${v.etA}${v.media?' (media mensual)':''}${v.pB?` frente a ${enFrase(etB(v))}`:''}${S.div?` · sector ${nombreSector(S.div)}`:''}${S.cno&&S.capa==='ett'?` · ocupación ${nombreOcup(S.cno)}`:''}`;
  document.querySelectorAll('#seg-vista button').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.vista===S.vista));b.disabled=b.dataset.vista==='variacion'&&!v.pB;});
  $('mapa-kpi').innerHTML=`<span class="cifra" id="m-cifra">${esc(T.cifra)}</span><span class="${T.cls}" id="m-var">${esc(T.varTxt)}</span><span class="rot">${esc(T.rotulo)}</span>`;
  $('mapa-avisos').innerHTML=avisosVista(v,T);
  $('leyenda').innerHTML=leyendaHtml(q);
  pintarRotulos();
  const det=detalleMunicipio(v,T);
  $('panel-det').innerHTML=det;
  if(hojaTipo==='mun'&&S.sel&&window.innerWidth<960)$('hoja-cuerpo').innerHTML=det;
}
function minigrafico(ine,v){
  const L=capa(),ms=L.meses.slice(-20);
  const s=C.seriesPorMunicipio(L.filas,L.meses,v.f).get(ine)||{};const vals=ms.map(m=>s[m]?(s[m][0]+s[m][1])/2:0);
  const mx=Math.max(1,...vals);
  const x=i=>(i*(300/(ms.length-1||1))),y=c=>(70-c/mx*62);
  const marca=(p,col)=>p?ms.map((m,i)=>p.meses.includes(m)?`<rect x="${(x(i)-4).toFixed(1)}" y="0" width="8" height="72" fill="${col}" opacity=".22"/>`:'').join(''):'';
  return `<svg viewBox="-6 0 312 84" width="100%">${marca(v.pB,'#D2453A')}${marca(v.pA,'#1E8A62')}<polyline fill="none" stroke="#213B7C" stroke-width="1.6" points="${ms.map((m,i)=>x(i).toFixed(1)+','+y(vals[i]).toFixed(1)).join(' ')}"/>`+
    `<text x="0" y="82" font-size="9" fill="#5F6B7F">${etMes(ms[0])}</text><text x="300" y="82" font-size="9" fill="#5F6B7F" text-anchor="end">${etMes(ms[ms.length-1])}</text></svg>`;
}
function tablaDesglose(l){return l.length?`<table class="t">${l.map(s=>`<tr><td>${esc(s.nombre)}</td><td class="n">${txtValorI(s.a,s.inflA)}</td><td class="n ${claseFila(s.r)}">${txtVar(s.r)}</td></tr>`).join('')}</table>`:'<p class="vacio">Sin contratos en el periodo.</p>';}
function detalleMunicipio(v,T){
  if(!S.sel){
    const R=C.rankingVariacion(v.filas,5);
    const fila=x=>`<tr data-mun="${x.ine}" style="cursor:pointer"><td>${esc(x.nombre)}</td><td class="n">${txtValor(x.va)}</td><td class="n ${x.dif>0?'sube':'baja'}">${sgn(x.dif)}</td><td class="n ${x.r.estado==='ok'?claseFila(x.r):'neutro'}">${x.r.estado==='ok'?txtVar(x.r):'—'}</td></tr>`;
    return `<h2>${esc(D.ccaa[S.ccaa].nombre)}</h2><p class="det-cifra">${esc(T.cifra)}</p><p class="${T.cls}" style="margin:2px 0">${esc(T.varTxt)}</p><p class="sub">${esc(T.rotulo)}</p>`+
      (T.nota?`<p class="aviso">${esc(T.nota)}</p>`:'')+`<p class="vacio">Pulsa un municipio del mapa para ver su detalle.</p>`+
      (v.pB?`<h3>Más crecen</h3><table class="t">${R.suben.map(fila).join('')}</table><h3>Más caen</h3><table class="t">${R.bajan.map(fila).join('')}</table><p class="vacio">Por diferencia en contratos, con al menos ${C.UMBRAL_RANKING} contratos en alguno de los dos periodos.</p>`:'');
  }
  const x=v.porIne.get(S.sel);if(!x){S.sel=null;return detalleMunicipio(v,T);}
  if(!x.publicado)return `<h2>${esc(x.nombre)}</h2><p class="aviso">SEPE no publica la contratación temporal de este municipio: solo publica la de los municipios de más de 20.000 hab. de su propia lista.</p>`;
  let h=`<h2>${esc(x.nombre)}</h2><p class="sub">INE ${x.ine} · ${esc(v.etA)}${v.media&&!x.infl?' (media mensual)':''}</p><p class="det-cifra" id="det-cifra">${x.infl?'n/c':x.a?txtValor(x.a):'sin dato'}<small style="font-size:.8rem;font-weight:500;color:var(--gris)"> contratos</small></p>`;
  if(v.pB)h+=`<p class="${claseFila(x.r)}" id="det-var" style="margin:2px 0;font-weight:600">${esc(txtVar(x.r))} <span class="neutro" style="font-weight:400">frente a ${esc(enFrase(etBx(v,x)))}</span></p>`;
  if(v.pB&&parPropio(x.a,x.va))h+=`<p class="aviso">${esc(notaPar(x))}</p>`;
  if(x.rm)h+=`<p class="aviso warn">${TXT_RUPTURA_MUN}</p>`;
  if(x.r.estado==='insuficiente')h+=`<p class="aviso">Variación no calculada: menos de ${D.meta.umbral} contratos en alguno de los dos periodos (umbral de secreto estadístico y fiabilidad).</p>`;
  h+=`<h3>Últimos meses</h3>${minigrafico(S.sel,v)}<p class="graf-ley"><span><i style="background:#1E8A62"></i>periodo</span><span><i style="background:#D2453A"></i>comparación</span></p>`;
  h+=`<h3>Sectores principales</h3>${tablaDesglose(topDesglose(S.sel,2,v))}`;
  if(S.capa==='ett')h+=`<h3>Ocupaciones principales</h3>${tablaDesglose(topDesglose(S.sel,3,v))}`;
  h+=`<div class="acciones"><button type="button" class="btn peq" data-tend="${x.ine}">Ver tendencia</button><button type="button" class="btn peq" data-desel="1">Quitar selección</button></div>`;
  return h;
}

// ---------- RANKING ----------
const TXT_ORDEN={sube:'Más crecen (contratos)',cae:'Más caen (contratos)',pct:'Mayor variación %',vol:'Más contratos'};
let ultimaEx=null;
function norm(s){return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function pintarRanking(){
  if(S.capa==='temporal'&&S.rk.agrupar==='cno')S.rk.agrupar='div';
  const c=calcularExplorador(S.rk.agrupar,S.rk.orden);ultimaEx=c;
  const orden=c.pB?S.rk.orden:'vol';if(orden!==S.rk.orden)c.filas=ordenarExplorador(c.filas,'vol');
  const qq=norm(S.rk.q.trim()),filas=qq?c.filas.filter(x=>norm(x.nombre).includes(qq)||String(x.k).startsWith(qq)):c.filas;
  const vis=filas.slice(0,S.rk.n);
  const tabs=Object.entries(TXT_AGRUPAR).map(([k,t])=>`<button type="button" data-agrupar="${k}" aria-pressed="${k===c.agrupar}"${k==='cno'&&S.capa!=='ett'?' disabled title="Sin ocupación en contratación temporal"':''}>${t==='Municipio'?'Municipios':t==='Sector'?'Sectores':'Ocupaciones'}</button>`).join('');
  const ops=Object.entries(TXT_ORDEN).map(([k,t])=>`<option value="${k}"${k===orden?' selected':''}${k!=='vol'&&!c.pB?' disabled':''}>${t}</option>`).join('');
  const fila=(x,i)=>{
    const cls=x.dif==null||Math.round(x.dif)===0?'neutro':x.dif>0?'sube':'baja';
    const nombre=c.agrupar==='mun'?`<b>${esc(x.nombre)}</b>`:`<b><span class="cod">${esc(x.k)}</span>${esc(x.nombre.slice(x.k.length+1))}</b>`;
    const accion=c.agrupar==='mun'?`<button type="button" class="filtrar" data-mun="${x.k}">Mapa</button>`:`<button type="button" class="filtrar" data-filtrar="${c.agrupar}:${esc(x.k)}">Filtrar</button>`;
    return `<li><span class="rk-pos">${i+1}</span><div class="nom">${nombre}<small>${txtValorI(x.a,x.infl)} contratos${c.pB&&x.vb?` · antes ${txtValor(x.vb)}`:''}</small></div><div class="val"><b class="${cls}">${txtDifEx(x)||'—'}</b><small class="${x.r.estado==='ok'?claseFila(x.r):'neutro'}">${txtPctEx(x)}</small></div>${accion}</li>`;
  };
  const t=c.tot;
  $('v-ranking').innerHTML=`<section class="tarjeta">
    <div class="tarj-cab"><h2>Ranking</h2><span class="sub">${esc(D.ccaa[S.ccaa].nombre)}</span></div>
    <p class="sub" id="rk-desc">${esc(NOMBRE_CAPA[S.capa])} · ${esc(c.etA)}${c.media?' (media mensual)':''}${c.pB?` frente a ${esc(enFrase(c.etB))}`:c.compNoDisp?' (comparación no disponible)':''}${S.div?` · sector ${esc(nombreSector(S.div))}`:''}${S.cno&&S.capa==='ett'?` · ocupación ${esc(nombreOcup(S.cno))}`:''}</p>
    <div class="rk-ctl" style="margin-top:10px">
      <div class="seg" id="rk-tabs" role="group" aria-label="Agrupar por">${tabs}</div>
      <div class="rk-fila"><label class="buscar"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input id="rk-q" type="search" placeholder="Buscar ${c.agrupar==='mun'?'municipio':c.agrupar==='div'?'sector o código CNAE':'ocupación o código CNO'}…" value="${esc(S.rk.q)}"></label>
      <select class="sel-orden" id="rk-orden" aria-label="Orden">${ops}</select></div>
    </div>
    ${c.avisos.map(a=>`<p class="aviso">${esc(a)}</p>`).join('')}
    ${avisosVista(Object.assign({},c,{filas:[],nc:C.noComparable(S.div,c.pA,c.pB,meta()),aviso:C.avisoCnae(S.div,c.pA,c.pB,meta())}),null,true)}
    ${c.filas.length?`<div class="rk-total" id="rk-total"><div><b>Total</b><br><small class="sub">${c.filas.length} ${c.filas.length===1?'fila':'filas'} con contratos${t.sinRm&&t.sinRm.length&&t.dif!=null?` · variación sin ${esc(txtAnios(t.sinRm))}`:''}</small></div><div class="n"><b>${txtValorI(t.a,false)}</b><br><small class="${t.r.estado==='ok'?claseFila(t.r):'neutro'}">${t.dif!=null?esc(txtDifEx(t))+' · ':''}${esc(txtPctEx(t))}</small></div></div>`:''}
    ${vis.length?`<ul class="lista rk-lista" id="rk-lista">${vis.map(fila).join('')}</ul>`:'<p class="vacio">Sin resultados.</p>'}
    ${filas.length>vis.length?`<button type="button" class="btn rk-mas" id="rk-mas">Ver más (${filas.length-vis.length} restantes)</button>`:''}
    <div class="acciones"><button type="button" class="btn" id="b-csv-rk">⬇ Descargar CSV</button></div>
    <p class="vacio" style="margin-top:10px">El % exige al menos ${D.meta.umbral} contratos en los dos periodos ("antes/ahora menos de ${D.meta.umbral}" o "nueva" si no). &lt;5: SEPE no da la cifra exacta; ≈: cifra aproximada por esas celdas.</p>
  </section>`;
}

// ---------- TENDENCIAS ----------
function anchoGraf(){const w=$('v-tendencias').clientWidth||640;return Math.round(Math.max(300,Math.min(900,w-36)));}
function grafLinea(ser,o){
  const W=anchoGraf(),H=220,pl=46,pr=10,pt=12,pb=26,n=ser.meses.length;
  const vals=ser.vals,prev=ser.meses.map((m,i)=>i>=12?vals[i-12]:null);
  const todos=vals.concat(prev).filter(v=>v!=null),mx=Math.max(1,...todos)*1.05;
  const x=i=>pl+i*(W-pl-pr)/(n-1||1),y=v=>pt+(1-v/mx)*(H-pt-pb);
  const paso=Math.pow(10,Math.floor(Math.log10(mx/4)))||1,st=[1,2,5,10].map(k=>k*paso).find(s=>mx/s<=5)||paso*10;
  let h=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria)}">`;
  for(let v=0;v<=mx;v+=st)h+=`<line class="rej" x1="${pl}" x2="${W-pr}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="eje" x="${pl-6}" y="${(y(v)+3).toFixed(1)}" text-anchor="end">${nm(v)}</text>`;
  ser.meses.forEach((m,i)=>{if(m.endsWith('-01')||i===0||i===n-1)h+=`<text class="eje" x="${x(i).toFixed(1)}" y="${H-8}" text-anchor="middle">${mesCorto(m)}</text>`;});
  const fi=ser.meses.indexOf(D.meta.frontera);
  if(fi>0)h+=`<line x1="${x(fi).toFixed(1)}" x2="${x(fi).toFixed(1)}" y1="${pt}" y2="${H-pb}" stroke="#E8A33D" stroke-dasharray="3 3"/><text class="eje" x="${(x(fi)+4).toFixed(1)}" y="${pt+9}" fill="#B9771B">CNAE-2025</text>`;
  const linea=(arr,attrs)=>{let d='',pen=false;arr.forEach((v,i)=>{if(v==null){pen=false;return;}d+=(pen?'L':'M')+x(i).toFixed(1)+','+y(v).toFixed(1);pen=true;});return d?`<path d="${d}" fill="none" ${attrs}/>`:'';};
  h+=linea(prev,'stroke="#9AA6BA" stroke-width="1.6" stroke-dasharray="4 3"');
  h+=linea(vals,`stroke="${o.col}" stroke-width="2.4"`);
  vals.forEach((v,i)=>{if(v!=null)h+=`<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${i===n-1?3.5:2}" fill="${o.col}"><title>${etMes(ser.meses[i])}: ${nm(v)} contratos${prev[i]!=null?` (año anterior ${nm(prev[i])})`:''}</title></circle>`;});
  return h+'</svg>';
}
function grafBarras(vs){
  const W=anchoGraf(),H=170,pl=46,pr=10,pt=10,pb=26,n=vs.length;
  const ok=vs.map(v=>v.r&&v.r.estado==='ok'?v.r.pct:null),abs=Math.max(5,...ok.filter(v=>v!=null).map(Math.abs))*1.1;
  const x=i=>pl+(i+0.5)*(W-pl-pr)/n,bw=Math.max(3,(W-pl-pr)/n*0.7),y=v=>pt+(1-(v+abs)/(2*abs))*(H-pt-pb);
  let h=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Variación interanual mensual">`;
  for(const v of [-abs/1.1,0,abs/1.1]){const r=Math.round(v);h+=`<line class="rej" x1="${pl}" x2="${W-pr}" y1="${y(r).toFixed(1)}" y2="${y(r).toFixed(1)}"/><text class="eje" x="${pl-6}" y="${(y(r)+3).toFixed(1)}" text-anchor="end">${r>0?'+':''}${r} %</text>`;}
  vs.forEach((v,i)=>{
    if(v.mes.endsWith('-01')||i===n-1)h+=`<text class="eje" x="${x(i).toFixed(1)}" y="${H-8}" text-anchor="middle">${mesCorto(v.mes)}</text>`;
    if(!v.r)return;
    if(ok[i]==null){h+=`<text class="eje" x="${x(i).toFixed(1)}" y="${(y(0)-3).toFixed(1)}" text-anchor="middle" font-size="8">${v.r.estado==='nc'?'n/c':'·'}</text><title>${etMes(v.mes)}: ${txtVar(v.r)}</title>`;return;}
    const p=ok[i],y0=y(0),y1=y(p);
    h+=`<rect x="${(x(i)-bw/2).toFixed(1)}" y="${Math.min(y0,y1).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1,Math.abs(y1-y0)).toFixed(1)}" fill="${p>=0?'#1E8A62':'#D2453A'}" opacity="${v.r.aviso||v.r.aprox?.6:1}"><title>${etMes(v.mes)}: ${txtVar(v.r)}</title></rect>`;
  });
  return h+'</svg>';
}
function pintarTendencias(){
  const muns=D.ccaa[S.ccaa].municipios,ine=S.tend.ine&&muns[S.tend.ine]?S.tend.ine:'';
  const cob=cobertura(),opts=Object.entries(muns).filter(([i])=>!cob||cob.has(i)).sort((a,b)=>a[1].n.localeCompare(b[1].n,'es'));
  const ser=serieMensual(ine),vs=variacionesMensuales(ine);
  const nombre=ine?muns[ine].n:D.ccaa[S.ccaa].nombre;
  const fuente=ser.fuente==='sepe'?`Total SEPE de ${D.ccaa[S.ccaa].nombre}`:ine?'Municipio':S.capa==='temporal'?'Suma de los municipios publicados por SEPE (más de 20.000 hab.); el número de municipios publicados cambia en septiembre de 2024 y en enero de 2025':'Suma de los municipios';
  const ultimoV=ser.vals[ser.vals.length-1],ultimaR=vs[vs.length-1].r;
  const col=S.capa==='ett'?'#213B7C':'#E8A33D';
  const filtros=[S.div?`sector ${nombreSector(S.div)}`:'',S.cno&&S.capa==='ett'?`ocupación ${nombreOcup(S.cno)}`:''].filter(Boolean).join(' · ');
  $('v-tendencias').innerHTML=`<section class="tarjeta">
    <div class="tarj-cab"><h2>Tendencias</h2><div class="seg peq" id="tend-capa">${['ett','temporal'].map(k=>`<button type="button" data-capa="${k}" aria-pressed="${k===S.capa}">${k==='ett'?'ETT':'Temporal'}</button>`).join('')}</div></div>
    <div class="ambito"><label for="tend-ine" class="sub">Ámbito</label><select id="tend-ine"><option value="">${esc(D.ccaa[S.ccaa].todo)}</option>${opts.map(([i,m])=>`<option value="${i}"${i===ine?' selected':''}>${esc(m.n)}</option>`).join('')}</select></div>
    <p class="sub">${esc(NOMBRE_CAPA[S.capa])} en <b>${esc(nombre)}</b>${filtros?' · '+esc(filtros):''} · contratos por mes</p>
    <div class="kpi-linea"><span class="cifra" id="t-cifra">${ultimoV==null?'sin dato':nm(ultimoV)}</span><span class="${ultimaR&&ultimaR.estado==='ok'?claseFila(ultimaR):'neutro'}" id="t-var">${ultimaR?esc(txtVar(ultimaR)):''} interanual</span><span class="rot">${esc(etMes(ser.meses[ser.meses.length-1]))} · ${esc(fuente)}</span></div>
    <div class="graf" id="g-linea">${grafLinea(ser,{col,aria:'Contratos por mes'})}</div>
    <div class="graf-ley"><span><i style="background:${col}"></i>Contratos del mes</span><span><i style="background:#9AA6BA"></i>Mismo mes del año anterior</span><span><i style="background:#E8A33D"></i>Cambio CNAE-2025 (ene 2026)</span></div>
    <h3>Variación interanual de cada mes</h3>
    <div class="graf" id="g-barras">${grafBarras(vs)}</div>
    <p class="vacio">Misma regla que la cifra principal: % solo con al menos ${D.meta.umbral} contratos en los dos meses; n/c si la comparación cruza un cambio de clasificación no comparable o una ruptura de serie. Barras más claras: aviso por cambio CNAE o cifra aproximada.</p>
    <div class="acciones"><button type="button" class="btn" id="b-csv-tend">⬇ Descargar CSV (serie)</button></div>
  </section>`;
}
function filasCsvSerie(){
  const ine=S.tend.ine||'',ser=serieMensual(ine),vs=variacionesMensuales(ine);
  const cab=['ambito','capa','sector','ocupacion','mes','contratos','fuente','variacion_interanual_pct','estado'];
  return [cab.join(';'),...ser.meses.map((m,i)=>[ine||S.ccaa,S.capa,S.div||'',S.capa==='ett'?(S.cno||''):'',m,ser.vals[i]==null?'':dec(ser.vals[i],ser.vals[i]%1?1:0),ser.fuente,
    vs[i].r&&vs[i].r.estado==='ok'?dec(vs[i].r.pct,1):'',vs[i].r?vs[i].r.estado:''].map(q).join(';'))];
}

// ---------- NOTAS ----------
function pintarNotas(){
  const M=D.meta,R=M.ruptura_cnae||{},rm=(M.ruptura_municipal||{}).ett||{};
  const lista=o=>Object.entries(o||{}).map(([k,t])=>`<li><b>${esc(k)}</b> ${esc(D.sectores[k]||'')} — ${t==='nc'?'no comparable (n/c)':'comparar con cautela (⚠)'}</li>`).join('');
  $('v-notas').innerHTML=`<section class="tarjeta notas">
    <h2>Notas y metodología</h2>
    <p class="aviso warn"><b>Prototipo de demostración.</b> Acceso sin autenticación real (empresa demo). Los datos son los del piloto del dashboard "Inteligencia Laboral ICER", sin cambios.</p>
    <dl><dt>Fuente</dt><dd>SEPE: contratos registrados por municipio. Procesado por ICER.</dd>
      <dt>Actualizado</dt><dd>${esc(fechaLarga(M.generado))}</dd>
      <dt>Último mes</dt><dd>ETT ${esc(etMes(M.ultimo.ett))} · temporal ${esc(etMes(M.ultimo.temporal))}</dd>
      <dt>Contratos ETT</dt><dd>${esc(etMes(D.ett.meses[0]))} – ${esc(etMes(D.ett.meses[D.ett.meses.length-1]))}, por municipio, sector (CNAE a 2 dígitos) y ocupación (CNO).</dd>
      <dt>Temporal</dt><dd>${esc(etMes(D.temporal.meses[0]))} – ${esc(etMes(D.temporal.meses[D.temporal.meses.length-1]))}, solo municipios de más de 20.000 hab. publicados por SEPE (lista propia, que se amplía en septiembre de 2024 y enero de 2025). Sin ocupación.</dd></dl>
    <h3>Umbral de secreto y cifras aproximadas</h3>
    <ul><li>SEPE no publica las celdas de menos de 5 contratos: se muestran como <b>&lt;5</b> y se suman como un intervalo de 1 a 4.</li>
      <li><b>≈</b>: la cifra suma alguna celda &lt;5 y su margen supera el 10 %.</li>
      <li>La variación % solo se calcula con al menos <b>${M.umbral} contratos</b> en los dos periodos; si no, "volumen insuficiente". Los rankings exigen al menos ${C.UMBRAL_RANKING} contratos en alguno de los dos periodos.</li>
      <li>Un periodo incompleto (trimestre o acumulado con meses sin dato) se muestra en media mensual y compara solo los mismos meses.</li></ul>
    <h3>Cambio de clasificación CNAE (frontera ${esc(etMes(M.frontera))})</h3>
    <p>En enero de 2026 entra la CNAE-2025. Las divisiones alteradas son ${esc(txtAnios((M.alteradas||[]).map(String)))}. Medido en los datos de cada capa, al comparar a través de la frontera:</p>
    <p><b>Contratos ETT</b></p><ul>${lista(R.ett)}</ul><p><b>Contratación temporal</b></p><ul>${lista(R.temporal)}</ul>
    <h3>Ruptura de serie municipal</h3>
    <ul>${Object.keys(rm).map(i=>`<li><b>${esc(nombreMun(i))}</b> (${i}): ${TXT_RUPTURA_MUN}</li>`).join('')||'<li>Ninguna.</li>'}</ul>
    <h3>Totales del territorio</h3>
    <ul><li>Contratos ETT: suma de los municipios.</li><li>Contratación temporal sin sector: total SEPE de la comunidad o provincia (incluye municipios no publicados). Con sector: ${esc(NOTA_SECTOR.toLowerCase())}</li></ul>
    <div class="acciones"><button type="button" class="btn" id="b-salir2">Salir de la demo</button></div>
  </section>`;
}

// ---------- FILTROS (hoja) ----------
function pickerHtml(id,cat,valor,todos){
  return `<div class="buscar"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input type="search" id="${id}-q" placeholder="Buscar por nombre o código…"></div>
    <div class="picker" id="${id}-lista"><button type="button" data-v=""${!valor?' class="sel"':''}>${todos}</button>${Object.entries(cat).map(([k,t])=>`<button type="button" data-v="${esc(k)}"${k===valor?' class="sel"':''} data-t="${esc(norm(k+' '+t))}"><span class="cod">${esc(k)}</span>${esc(t)}</button>`).join('')}</div>`;
}
function abrirFiltros(){
  const ms=capa().meses,u=ms[ms.length-1];
  const ops=C.opcionesPeriodo(S.tipo,ms).slice().reverse();
  const mot={interanual:motivoNoDisp('interanual'),anterior:motivoNoDisp('anterior')};
  const h=`<h2>Filtros</h2><p class="sub" style="margin-bottom:14px">${esc(D.ccaa[S.ccaa].nombre)}</p>
    <div class="campo"><span>Capa</span><div class="seg" id="ff-capa">${['ett','temporal'].map(k=>`<button type="button" data-v="${k}" aria-pressed="${k===S.capa}">${NOMBRE_CAPA[k]}</button>`).join('')}</div></div>
    <div class="campo"><span>Periodo</span><div class="seg" id="ff-tipo">${Object.entries(TXT_TIPO).map(([k,t])=>`<button type="button" data-v="${k}" aria-pressed="${k===S.tipo}">${t}</button>`).join('')}</div>
      <select id="ff-clave">${ops.map(o=>`<option value="${o.clave}"${o.clave===S.clave?' selected':''}>${esc(C.etiqueta(C.periodo(S.tipo,o.clave,u)))}${o.parcial?' (parcial)':''}</option>`).join('')}</select></div>
    <div class="campo"><span>Comparar con</span><select id="ff-modo">${Object.entries(TXT_MODO).map(([k,t])=>`<option value="${k}"${k===S.modo?' selected':''}${mot[k]?' disabled':''}>${t}${mot[k]?` (${esc(mot[k])})`:''}</option>`).join('')}</select></div>
    <div class="campo"><span>Mapa: ver</span><div class="seg" id="ff-vista"><button type="button" data-v="variacion" aria-pressed="${S.vista==='variacion'}"${!compDisponible(S.modo)?' disabled':''}>Variación %</button><button type="button" data-v="volumen" aria-pressed="${S.vista==='volumen'}">Volumen</button></div></div>
    <div class="campo"><span>Sector (CNAE)</span><small>Actual: ${esc(nombreSector(S.div))}</small>${pickerHtml('ff-div',D.sectores,S.div,'Todos los sectores')}</div>
    ${S.capa==='ett'?`<div class="campo"><span>Ocupación (CNO)</span><small>Actual: ${esc(nombreOcup(S.cno))}</small>${pickerHtml('ff-cno',D.ocupaciones,S.cno,'Todas las ocupaciones')}</div>`:'<p class="aviso">SEPE no publica ocupación con temporalidad: el filtro de ocupación solo existe en Contratos ETT.</p>'}
    <div class="hoja-pie"><button type="button" class="btn" id="ff-reset">Restablecer</button><button type="button" class="btn primario" id="ff-ok">Ver resultados</button></div>`;
  abrirHoja(h,'filtros');
}
function aplicar(){ajustarPeriodo();pintar();if(hojaTipo==='filtros'){const y=$('hoja').scrollTop;abrirFiltros();$('hoja').scrollTop=y;}}
function eventosHoja(e){
  const b=e.target.closest('button');if(!b)return;
  const g=b.parentElement&&b.parentElement.id;
  if(g==='ff-capa'){S.capa=b.dataset.v;if(S.capa==='temporal'&&S.rk.agrupar==='cno')S.rk.agrupar='div';S.sel=null;aplicar();}
  else if(g==='ff-tipo'){S.tipo=b.dataset.v;S.clave=null;aplicar();}
  else if(g==='ff-vista'){S.vista=b.dataset.v;S.vistaForzada=false;aplicar();}
  else if(g==='ff-div-lista'){S.div=b.dataset.v||null;aplicar();}
  else if(g==='ff-cno-lista'){S.cno=b.dataset.v||null;aplicar();}
  else if(b.id==='ff-reset'){Object.assign(S,{div:null,cno:null,tipo:'mes',clave:null,modoUsuario:'interanual',vista:'variacion',vistaForzada:false});aplicar();}
  else if(b.id==='ff-ok')cerrarHoja();
  else if(b.dataset.desel){S.sel=null;cerrarHoja();pintar();}
  else if(b.dataset.tend){S.tend.ine=b.dataset.tend;cerrarHoja();location.hash='#tendencias';}
}

// ---------- navegación ----------
const VISTAS=['inicio','mapa','ranking','tendencias','notas'];
function pintar(){
  pintarCabecera();
  document.querySelectorAll('.vista').forEach(el=>{el.hidden=el.dataset.v!==S.view;});
  document.querySelectorAll('#nav a').forEach(a=>a.classList.toggle('activo',a.dataset.v===S.view));
  ({inicio:pintarInicio,mapa:pintarMapa,ranking:pintarRanking,tendencias:pintarTendencias,notas:pintarNotas})[S.view]();
}
function ruta(){
  const v=(location.hash||'').slice(1);
  if(!sesion()){mostrarLogin();return;}
  S.view=VISTAS.includes(v)?v:'inicio';
  $('login').hidden=true;$('app').hidden=false;
  pintar();window.scrollTo(0,0);
}
const CLAVE_SESION='icer-demo-sesion';
function sesion(){try{return JSON.parse(localStorage.getItem(CLAVE_SESION)||'null');}catch(_){return null;}}
function mostrarLogin(){$('app').hidden=true;$('login').hidden=false;cerrarHoja();}
function salir(){localStorage.removeItem(CLAVE_SESION);location.hash='';mostrarLogin();}
function seleccionar(ine){
  S.sel=S.sel===ine?null:ine;
  if(S.view!=='mapa'){location.hash='#mapa';return;}
  pintarMapa();
  if(S.sel&&window.innerWidth<960)abrirHoja($('panel-det').innerHTML,'mun');
}

function montar(){
  $('f-login').addEventListener('submit',e=>{
    e.preventDefault();
    localStorage.setItem(CLAVE_SESION,JSON.stringify({empresa:'Empresa demo',usuario:$('l-usuario').value,demo:true,desde:new Date().toISOString()}));
    $('cab-empresa').textContent='Empresa demo';
    if(location.hash==='#inicio')ruta();else location.hash='#inicio';
  });
  window.addEventListener('hashchange',ruta);
  $('seg-ccaa').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.dataset.ccaa===S.ccaa)return;S.ccaa=b.dataset.ccaa;S.sel=null;S.tend.ine='';pintar();});
  $('b-filtros').addEventListener('click',abrirFiltros);
  $('chips').addEventListener('click',e=>{const b=e.target.closest('.chip');if(!b)return;const k=b.dataset.chip;
    if(k==='div'){S.div=null;aplicar();}else if(k==='cno'){S.cno=null;aplicar();}else abrirFiltros();});
  $('b-salir').addEventListener('click',salir);
  $('velo').addEventListener('click',cerrarHoja);$('hoja-cerrar').addEventListener('click',cerrarHoja);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('hoja').hidden)cerrarHoja();});
  const hoja=$('hoja');
  hoja.addEventListener('click',eventosHoja);
  hoja.addEventListener('change',e=>{
    if(e.target.id==='ff-clave'){S.clave=e.target.value;aplicar();}
    else if(e.target.id==='ff-modo'){S.modoUsuario=e.target.value;aplicar();}
  });
  hoja.addEventListener('input',e=>{
    const m=/^(ff-(div|cno))-q$/.exec(e.target.id);if(!m)return;
    const qq=norm(e.target.value.trim());
    $(m[1]+'-lista').querySelectorAll('button[data-t]').forEach(b=>{b.hidden=!!qq&&!b.dataset.t.includes(qq);});
  });
  // inicio
  $('v-inicio').addEventListener('click',e=>{
    const li=e.target.closest('[data-mun]');if(li){S.sel=null;seleccionar(li.dataset.mun);return;}
    const d=e.target.closest('[data-div]');if(d){S.div=d.dataset.div;ajustarPeriodo();location.hash='#mapa';return;}
    const a=e.target.closest('a[data-rk]');if(a){S.rk.agrupar=a.dataset.rk;return;}
    const k=e.target.closest('.kpi');if(k){S.capa=k.dataset.capa;S.tipo=k.dataset.tipo;S.clave=null;S.modoUsuario='interanual';ajustarPeriodo();location.hash='#mapa';}
  });
  // mapa
  const svg=$('mapa');
  let arr=null,movido=false;const punteros=new Map();let pinza=null;
  svg.addEventListener('click',e=>{const p=e.target.closest('path');if(!p||movido){movido=false;return;}seleccionar(p.dataset.ine);});
  svg.addEventListener('keydown',e=>{const p=e.target.closest('path');if(p&&(e.key==='Enter'||e.key===' ')){e.preventDefault();seleccionar(p.dataset.ine);}});
  svg.addEventListener('mousemove',e=>{
    const p=e.target.closest('path'),t=$('tip');if(!p||!ultimaV||arr){t.hidden=true;return;}
    const x=ultimaV.porIne.get(p.dataset.ine);if(!x){t.hidden=true;return;}
    const caja=$('mapa-caja').getBoundingClientRect();
    t.innerHTML=`<b>${esc(x.nombre)}</b><br>${x.publicado?`${txtCont(x.a,x.infl)}${ultimaV.pB?`<br>${esc(txtVar(x.r))}`:''}`:'No publicado por SEPE'}`;
    t.hidden=false;t.style.left=Math.min(caja.width-180,e.clientX-caja.left+12)+'px';t.style.top=(e.clientY-caja.top+12)+'px';
  });
  svg.addEventListener('mouseleave',()=>{$('tip').hidden=true;});
  svg.addEventListener('wheel',e=>{const f=Math.exp(-e.deltaY*0.0015),z=BASE.w/vistaM.w;if((f<1&&z<=Z_MIN)||(f>1&&z>=Z_MAX))return;e.preventDefault();const [px,py]=aLienzo(e.clientX,e.clientY);zoomEn(f,px,py);},{passive:false});
  svg.addEventListener('pointerdown',e=>{punteros.set(e.pointerId,{x:e.clientX,y:e.clientY});movido=false;
    if(punteros.size===1)arr={x:e.clientX,y:e.clientY,tipo:e.pointerType};
    else if(punteros.size===2){const [a,b]=[...punteros.values()];pinza={cx:(a.x+b.x)/2,cy:(a.y+b.y)/2,d:Math.hypot(a.x-b.x,a.y-b.y)};}});
  svg.addEventListener('pointermove',e=>{
    const prev=punteros.get(e.pointerId);if(!prev)return;const act={x:e.clientX,y:e.clientY};punteros.set(e.pointerId,act);
    if(punteros.size>=2&&pinza){const [a,b]=[...punteros.values()],p={cx:(a.x+b.x)/2,cy:(a.y+b.y)/2,d:Math.hypot(a.x-b.x,a.y-b.y)},s=escalaPantalla();
      desplazar(-(p.cx-pinza.cx)*s,-(p.cy-pinza.cy)*s);if(pinza.d>0&&p.d>0){const [px,py]=aLienzo(p.cx,p.cy);zoomEn(p.d/pinza.d,px,py);}pinza=p;movido=true;return;}
    if(!arr)return;if(arr.tipo!=='mouse'&&BASE.w/vistaM.w<=1.001)return;
    if(!movido&&Math.hypot(act.x-arr.x,act.y-arr.y)<=4)return;movido=true;$('tip').hidden=true;
    const s=escalaPantalla();desplazar(-(act.x-prev.x)*s,-(act.y-prev.y)*s);
  });
  const soltar=e=>{punteros.delete(e.pointerId);if(punteros.size<2)pinza=null;if(!punteros.size)arr=null;};
  svg.addEventListener('pointerup',soltar);svg.addEventListener('pointercancel',e=>{soltar(e);movido=false;});
  $('z-mas').addEventListener('click',()=>zoomEn(PASO_ZOOM));$('z-menos').addEventListener('click',()=>zoomEn(1/PASO_ZOOM));$('z-reset').addEventListener('click',()=>fijarVista(Object.assign({},BASE)));
  $('seg-vista').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;S.vista=b.dataset.vista;S.vistaForzada=false;pintarMapa();});
  $('b-csv-mapa').addEventListener('click',()=>descargar(filasCsv(calcular()),`icer_${S.ccaa}_${S.capa}_${S.clave}.csv`));
  $('panel-det').addEventListener('click',e=>{const r=e.target.closest('[data-mun]');if(r){seleccionar(r.dataset.mun);return;}eventosHoja(e);});
  window.addEventListener('resize',()=>{if(S.view==='mapa')pintarRotulos();else if(S.view==='tendencias'){clearTimeout(montar.rt);montar.rt=setTimeout(pintarTendencias,150);}});
  // ranking
  const rk=$('v-ranking');
  rk.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.agrupar){S.rk.agrupar=b.dataset.agrupar;S.rk.q='';S.rk.n=30;pintarRanking();}
    else if(b.id==='rk-mas'){S.rk.n+=30;pintarRanking();}
    else if(b.id==='b-csv-rk')descargar(filasCsvExplorador(ultimaEx),`icer_ranking_${S.ccaa}_${S.capa}_${ultimaEx.agrupar}_${S.clave}.csv`);
    else if(b.dataset.mun){S.sel=null;seleccionar(b.dataset.mun);}
    else if(b.dataset.filtrar){const [k,v]=b.dataset.filtrar.split(':');S[k]=v;S.rk.agrupar=k==='div'?'mun':S.rk.agrupar==='cno'?'mun':S.rk.agrupar;S.rk.q='';ajustarPeriodo();pintar();toast(`Filtro aplicado: ${k==='div'?nombreSector(v):nombreOcup(v)}`);}
  });
  rk.addEventListener('input',e=>{if(e.target.id!=='rk-q')return;S.rk.q=e.target.value;S.rk.n=30;const pos=e.target.selectionStart;pintarRanking();const i=$('rk-q');i.focus();i.setSelectionRange(pos,pos);});
  rk.addEventListener('change',e=>{if(e.target.id==='rk-orden'){S.rk.orden=e.target.value;pintarRanking();}});
  // tendencias
  const td=$('v-tendencias');
  td.addEventListener('change',e=>{if(e.target.id==='tend-ine'){S.tend.ine=e.target.value;pintarTendencias();}});
  td.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
    if(b.dataset.capa&&b.dataset.capa!==S.capa){S.capa=b.dataset.capa;ajustarPeriodo();pintar();}
    else if(b.id==='b-csv-tend')descargar(filasCsvSerie(),`icer_serie_${S.tend.ine||S.ccaa}_${S.capa}.csv`);});
  $('v-notas').addEventListener('click',e=>{if(e.target.id==='b-salir2')salir();});
}

// ---------- arranque ----------
let GEO=null;
async function iniciar(){
  try{
    const [d,g]=await Promise.all([fetch('data/datos.json').then(r=>{if(!r.ok)throw new Error('datos '+r.status);return r.json();}),fetch('data/geo.json').then(r=>{if(!r.ok)throw new Error('geo '+r.status);return r.json();})]);
    D=d;GEO=g;
  }catch(err){$('cargando').innerHTML=`<p>No se pudieron cargar los datos (${esc(err.message)}).</p>`;return;}
  S.ccaa=Object.keys(D.ccaa)[0];ajustarPeriodo();
  montar();
  $('cargando').hidden=true;
  ruta();
  if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('sw.js').catch(()=>{});
}
window.ICER={S,D:()=>D,calcular,totalComunidad,calcularExplorador,serieMensual,variacionesMensuales,filasCsv,filasCsvExplorador,filasCsvSerie,pintar,con,ajustarPeriodo,topDesglose,txtVar,txtCifra,agregados};
iniciar();
})();
