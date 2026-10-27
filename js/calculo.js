(function(root){
'use strict';
const MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);

function sumarMes(m,n){
  const [y,mm]=m.split('-').map(Number);const i=y*12+mm-1+n;
  return `${Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}`;
}
function trimDe(m){const [y,mm]=m.split('-').map(Number);return `${y}-T${Math.ceil(mm/3)}`;}
function mesesTrim(clave){
  const [y,t]=clave.split('-T').map(Number);const ini=(t-1)*3+1;
  return [0,1,2].map(k=>`${y}-${String(ini+k).padStart(2,'0')}`);
}
function periodo(tipo,clave,ultimo){
  if(tipo==='mes')return {tipo,clave,meses:[clave]};
  if(tipo==='trim')return {tipo,clave,meses:mesesTrim(clave)};
  if(tipo==='acum'){
    const y=Number(clave),[uy,um]=ultimo.split('-').map(Number);
    const fin=y===uy?um:12;
    return {tipo,clave,meses:Array.from({length:fin},(_,k)=>`${y}-${String(k+1).padStart(2,'0')}`)};
  }
  throw new Error('Tipo de periodo desconocido: '+tipo);
}
function comparacion(p,modo){
  if(modo==='interanual'){
    const meses=p.meses.map(m=>sumarMes(m,-12));
    const clave=p.tipo==='mes'?meses[0]:p.tipo==='trim'?trimDe(meses[0]):String(Number(p.clave)-1);
    return {tipo:p.tipo,clave,meses};
  }
  if(modo==='anterior'){
    if(p.tipo==='acum')return null;
    const n=p.tipo==='mes'?1:3;const meses=p.meses.map(m=>sumarMes(m,-n));
    return {tipo:p.tipo,clave:p.tipo==='mes'?meses[0]:trimDe(meses[0]),meses};
  }
  throw new Error('Comparación desconocida: '+modo);
}
function etiqueta(p){
  if(!p)return '';
  if(p.tipo==='mes'){const [y,m]=p.clave.split('-').map(Number);return `${cap(MESES[m-1])} ${y}`;}
  if(p.tipo==='trim'){const [y,t]=p.clave.split('-');return `${t} ${y}`;}
  const fin=Number(p.meses[p.meses.length-1].slice(5));
  return fin===12?`Año ${p.clave}`:`Enero a ${MESES[fin-1]} ${p.clave}`;
}
function trimestres(meses){return [...new Set(meses.map(trimDe))];}
function anios(meses){return [...new Set(meses.map(m=>m.slice(0,4)))];}

function coincide(r,f){
  const div=r[2],cno=r[3];
  if(f.div==null){if(div==='T')return false;}else if(div!==f.div)return false;
  return f.cno==null||cno===f.cno;
}
function acumular(out,clave,mes,lo,hi){
  let s=out.get(clave);if(!s){s={};out.set(clave,s);}
  const v=s[mes]||(s[mes]=[0,0]);v[0]+=lo;v[1]+=hi;
}
function seriesPorMunicipio(filas,meses,f){
  const out=new Map();
  for(const r of filas)if(coincide(r,f))acumular(out,r[1],meses[r[0]],r[4],r[5]);
  return out;
}
function desglose(filas,meses,ine,campo,f){
  const out=new Map();
  const otro=campo===2?{div:null,cno:f.cno}:{div:f.div,cno:null};
  for(const r of filas)if(r[1]===ine&&r[2]!=='T'&&coincide(r,otro))acumular(out,r[campo],meses[r[0]],r[4],r[5]);
  return out;
}
function cobertura(filas,meses){
  const out=new Map();
  for(const r of filas)if(r[2]==='T'){let s=out.get(r[1]);if(!s){s=new Set();out.set(r[1],s);}s.add(meses[r[0]]);}
  return out;
}
function valorPeriodo(serie,p,disponibles,opts){
  opts=opts||{};
  const usados=p.meses.filter(m=>disponibles.has(m));
  if(!usados.length)return null;
  if(p.tipo!=='trim'&&usados.length<p.meses.length)return null;
  let lo=0,hi=0;
  for(const m of usados){const v=serie&&serie[m];if(v){lo+=v[0];hi+=v[1];}}
  const parcial=p.tipo==='trim'&&usados.length<p.meses.length,media=parcial||!!opts.media;
  if(media){lo/=usados.length;hi/=usados.length;}
  return {lo,hi,n:usados.length,esperados:p.meses.length,parcial,media,meses:usados};
}
// a, b: valor de cada periodo con sus meses disponibles. va, vb: el par de la variación, solo con las posiciones de mes
// con dato en A y en B (un T3 con julio y agosto se compara con julio y agosto del otro trimestre, no con sus tres meses)
function parValores(serie,pA,pB,disp,forzarMedia){
  let a=valorPeriodo(serie,pA,disp,{media:!!forzarMedia}),b=pB?valorPeriodo(serie,pB,disp,{media:!!forzarMedia}):null;
  if(!forzarMedia&&((a&&a.parcial)||(b&&b.parcial))){
    a=valorPeriodo(serie,pA,disp,{media:true});b=pB?valorPeriodo(serie,pB,disp,{media:true}):null;
  }
  let va=a,vb=b;
  if(a&&b&&pA.meses.length===pB.meses.length){
    const idx=posicionesComunes(pA,pB,disp);
    if(idx.length&&idx.length<pA.meses.length&&(a.n!==idx.length||b.n!==idx.length)){
      const sub=p=>({tipo:p.tipo,clave:p.clave,meses:idx.map(i=>p.meses[i])});
      va=valorPeriodo(serie,sub(pA),disp,{media:true});vb=valorPeriodo(serie,sub(pB),disp,{media:true});
    }
  }
  return {a,b,va,vb};
}
// posiciones (0, 1, 2...) de los meses con dato a la vez en A y en B
function posicionesComunes(pA,pB,disp){
  return pA.meses.map((m,i)=>i).filter(i=>disp.has(pA.meses[i])&&pB.meses[i]!=null&&disp.has(pB.meses[i]));
}
// "T3 2026 (julio y agosto)" cuando el periodo va con menos meses de los suyos
function etiquetaParcial(p,meses){
  const t=etiqueta(p);if(!p||!meses||!meses.length||meses.length>=p.meses.length||p.tipo==='mes')return t;
  const ms=meses.map(m=>MESES[Number(m.slice(5))-1]);
  return `${t} (${ms.length>1?ms.slice(0,-1).join(', ')+' y '+ms[ms.length-1]:ms[0]})`;
}
const central=v=>(v.lo+v.hi)/2;
const aprox=v=>{const c=central(v);return c>0&&(v.hi-v.lo)/2>0.10*c;};
// contratos (centrales) en los meses usados: en media mensual, la media por el número de meses. Los umbrales se miden
// sobre esta cifra, para que "20 contratos" no pase a ser "20 al mes" cuando el periodo va en media
function base(v){return v.base!=null?v.base:v.media?central(v)*v.n:central(v);}
function sumar(vals){
  const vs=vals.filter(Boolean);if(!vs.length)return null;
  return {lo:vs.reduce((s,v)=>s+v.lo,0),hi:vs.reduce((s,v)=>s+v.hi,0),parcial:vs.some(v=>v.parcial),base:vs.reduce((s,v)=>s+base(v),0)};
}
function variacion(a,b,o){
  if(o.nc)return {estado:'nc'};
  if(!a||!b)return {estado:'sin_dato'};
  const ca=central(a),cb=central(b);
  if(base(a)<o.umbral||base(b)<o.umbral||cb===0)return {estado:'insuficiente'};
  return {estado:'ok',pct:(ca/cb-1)*100,aprox:aprox(a)||aprox(b)};
}
// meses de una división reeditados por SEPE; la clave '*' vale para toda división (nunca para el total 'T')
function esInflado(div,p,meta){
  if(!p||div==null||div==='T')return false;
  const tabla=meta.inflados||{};
  const inf=(tabla[div]||[]).concat(tabla['*']||[]);
  return p.meses.some(m=>inf.includes(m));
}
// la comparación A frente a B mezcla meses de antes y de después del cambio CNAE
function cruzaFrontera(pA,pB,meta){
  if(!pA||!pB)return false;
  const todos=[...pA.meses,...pB.meses];
  return todos.some(m=>m<meta.frontera)&&todos.some(m=>m>=meta.frontera);
}
// clase de ruptura CNAE medida en los datos de la capa activa (meta.ruptura: {div:'nc'|'aviso'})
function claseRuptura(div,pA,pB,meta){
  if(div==null||div==='T'||!cruzaFrontera(pA,pB,meta))return null;
  return (meta.ruptura||{})[div]||null;
}
function noComparable(div,pA,pB,meta){
  if(div==null||div==='T')return false;
  if(esInflado(div,pA,meta)||esInflado(div,pB,meta))return true;
  return claseRuptura(div,pA,pB,meta)==='nc';
}
function avisoCnae(div,pA,pB,meta){return claseRuptura(div,pA,pB,meta)==='aviso';}
// municipio cuya serie cambia de nivel en la frontera (meta.rupturaMun: {ine: ratio}): sus comparaciones que la cruzan son n/c
function rupturaMunicipal(ine,pA,pB,meta){return !!(meta.rupturaMun&&meta.rupturaMun[ine]!=null&&cruzaFrontera(pA,pB,meta));}

// ---------- rankings de municipios: los que más suben y más bajan en contratos ----------
// filas [{va, vb, r}] con r.estado 'ok' o 'insuficiente' (base pequeña: el % no se calcula, pero la diferencia sí);
// solo las de al menos umbral contratos (base()) en alguno de los dos periodos. Orden por variación absoluta
// (contratos), no por %: un +600 % sobre 20 contratos no encabeza la lista y un 22 → 158 sí entra.
const UMBRAL_RANKING=100;
function rankingVariacion(filas,n,umbral){
  const u=umbral!=null?umbral:UMBRAL_RANKING,ok=[];
  for(const x of filas){
    if(!x.r||(x.r.estado!=='ok'&&x.r.estado!=='insuficiente')||!x.va||!x.vb)continue;
    const ca=central(x.va),cb=central(x.vb);if(Math.max(base(x.va),base(x.vb))<u)continue;
    ok.push(Object.assign({},x,{dif:ca-cb}));
  }
  const nombre=(p,q)=>(p.nombre||'')<(q.nombre||'')?-1:(p.nombre||'')>(q.nombre||'')?1:0;
  return {suben:ok.filter(x=>Math.round(x.dif)>0).sort((p,q)=>q.dif-p.dif||nombre(p,q)).slice(0,n),
    bajan:ok.filter(x=>Math.round(x.dif)<0).sort((p,q)=>p.dif-q.dif||nombre(p,q)).slice(0,n)};
}

// cortes de cuantiles (p1/n ... p(n-1)/n) sobre los valores > 0, redondeados como se muestran;
// se descartan los cortes que dejarían un tramo vacío (repetidos, por debajo del mínimo o en el máximo)
function cortesCuantiles(vals,n){
  const v=vals.filter(x=>x>0).sort((a,b)=>a-b);if(!v.length)return [];
  const max=v[v.length-1],out=[];let prev=-Infinity;
  for(let k=1;k<n;k++){
    const c=Math.round(v[Math.floor(k/n*(v.length-1))]);
    if(c<=prev||c>=max||!v.some(x=>x>prev&&x<=c))continue;
    out.push(c);prev=c;
  }
  return out;
}

// ---------- vista del mapa (viewBox): zoom entre zMin y zMax sin salirse del lienzo base ----------
function limitarVista(v,base,zMin,zMax){
  const z=Math.min(zMax,Math.max(zMin,base.w/v.w)),w=base.w/z,h=base.h/z;
  const cx=v.x+v.w/2,cy=v.y+v.h/2;
  const x=Math.min(base.x+base.w-w,Math.max(base.x,cx-w/2)),y=Math.min(base.y+base.h-h,Math.max(base.y,cy-h/2));
  return {x,y,w,h};
}
// acerca (f > 1) o aleja (f < 1) dejando fijo el punto (px, py) del lienzo
function zoomVista(v,f,px,py,base,zMin,zMax){
  const z0=base.w/v.w,z=Math.min(zMax,Math.max(zMin,z0*f)),k=z0/z;
  return limitarVista({x:px-(px-v.x)*k,y:py-(py-v.y)*k,w:v.w*k,h:v.h*k},base,zMin,zMax);
}
function desplazarVista(v,dx,dy,base,zMin,zMax){return limitarVista({x:v.x+dx,y:v.y+dy,w:v.w,h:v.h},base,zMin,zMax);}
// lienzo base del mapa con la proporción del contorno proyectado (ancho y alto en grados, el ancho ya corregido por la
// latitud): 1000 de ancho, margen por lado y alto = contenido + 2 márgenes (entero, como mucho maxAlto). esc: unidades
// del lienzo por grado; ox, oy: esquina del contenido. vertical: la forma es claramente más alta que ancha (más de 1,25 veces; Madrid, 1,1, no)
function vistaBase(ancho,alto,o){
  const W=1000,m=o&&o.margen!=null?o.margen:20,maxAlto=o&&o.maxAlto||2500;
  if(!(ancho>0)||!(alto>0))return {w:W,h:800,esc:1,ox:0,oy:0,vertical:false};
  let esc=(W-2*m)/ancho,H=Math.round(alto*esc+2*m);
  if(H>maxAlto){H=maxAlto;esc=(H-2*m)/alto;}
  return {w:W,h:H,esc,ox:(W-ancho*esc)/2,oy:(H-alto*esc)/2,vertical:H>1.25*W};
}
// alto en pantalla del mapa de una forma vertical en escritorio: la altura disponible, salvo que el ancho de la columna
// (menos el de la leyenda lateral) no alcance para esa altura con la proporción del lienzo
function altoMapaVertical(disponible,anchoColumna,base,anchoLado){
  return Math.max(0,Math.min(disponible,(anchoColumna-anchoLado)*base.h/base.w));
}

// ---------- total autonómico SEPE (cifra exacta por mes, sin sector) y comparativa ----------
// serie {mes: valor}; disp: meses de la capa. Sin el total de algún mes de A no hay cifra; sin el de B, no hay variación.
function totalAutonomico(serie,pA,pB,disp,o){
  if(!serie||!pA)return null;
  const falta=p=>p.meses.some(m=>disp.has(m)&&!(m in serie));
  if(falta(pA))return null;
  const s={};for(const m in serie)s[m]=[serie[m],serie[m]];
  const {a,va,vb}=parValores(s,pA,pB&&!falta(pB)?pB:null,disp,!!o.media);
  if(!a)return null;
  return {a,b:vb,r:variacion(va,vb,{umbral:o.umbral,nc:false})};
}
// porcentaje de parte sobre total (valores centrales)
function cuota(parte,total){
  if(!parte||!total)return null;
  const t=central(total);return t>0?central(parte)/t*100:null;
}
// cifra de una comunidad en la comparativa: total SEPE en la capa temporal sin sector; si no, suma municipal
function cifraComparativa(capa,div,auto,mun){
  if(capa==='temporal'&&!div&&auto)return {fuente:'sepe',a:auto.a,r:auto.r};
  return {fuente:capa==='temporal'?'publicados':'municipios',a:mun.a,r:mun.r,n:mun.n};
}

// ---------- versión ampliada: cuota ETT = contratos ETT / contratación total (mismo municipio, división y periodo) ----------
// Por intervalos: [ETT_min / total_max, ETT_max / total_min] acotado a [0, 1]; c = ETT central / total central.
// supera: ETT central por encima del total publicado (diferencia de fuentes); valor = c acotada a 1 (color y variación).
// Sin total (o total central 0) no hay cuota. Sin filas ETT, la cuota es 0.
function cuotaETT(ett,total){
  if(!total)return null;
  const t=central(total);if(!(t>0))return null;
  const e=ett||{lo:0,hi:0},lim=x=>Math.min(1,Math.max(0,x));
  const lo=lim(total.hi>0?e.lo/total.hi:0),hi=total.lo>0?lim(e.hi/total.lo):1;
  const c=central(e)/t,valor=Math.min(1,c),supera=c>1;
  return {lo,hi,c,valor,supera,aprox:supera||(hi-lo)/2>0.10*valor,ett:e,total};
}
// variación de la cuota en puntos porcentuales; umbral: total central de ambos periodos
function variacionCuota(a,b,o){
  if(o.nc)return {estado:'nc'};
  if(!a||!b)return {estado:'sin_dato'};
  if(base(a.total)<o.umbral||base(b.total)<o.umbral)return {estado:'insuficiente'};
  return {estado:'ok',pp:(a.valor-b.valor)*100,aprox:a.aprox||b.aprox};
}
// clasificación de ruptura CNAE combinada de varias capas ({div:'nc'|'aviso'}): n/c gana a aviso
function rupturaCombinada(lista){
  const out={};
  for(const r of lista)for(const [d,c] of Object.entries(r||{}))if(c==='nc'||!out[d])out[d]=c;
  return out;
}
// contratación sin ETT = contratación total − contratos ETT, por intervalos y sin bajar de cero. Los dos incluyen
// indefinidos (la extracción ETT trae fijos discontinuos): no se resta de la temporal, de la que el ETT no es parte.
// Se calcula sobre el agregado que se muestra (municipio, sector o comunidad), no celda a celda
function sinEtt(total,ett){
  if(!total)return null;
  const e=ett||{lo:0,hi:0};
  return {lo:Math.max(0,total.lo-e.hi),hi:Math.max(0,total.hi-e.lo)};
}
// series de todas las divisiones (sin 'T') de cada municipio: Map ine → Map div → {mes:[lo,hi]}
function seriesPorDivision(filas,meses){
  const out=new Map();
  for(const r of filas){
    if(r[2]==='T')continue;
    let m=out.get(r[1]);if(!m){m=new Map();out.set(r[1],m);}
    acumular(m,r[2],meses[r[0]],r[4],r[5]);
  }
  return out;
}

// ---------- versión ampliada: calendario de campañas (índice estacional) ----------
// años naturales con los 12 meses en la capa
function aniosCompletos(meses){
  const n={};for(const m of meses){const y=m.slice(0,4);n[y]=(n[y]||0)+1;}
  return Object.keys(n).filter(y=>n[y]===12).sort();
}
// municipios (ines) que SEPE publica los 12 meses del año
function cubiertosAnio(cob,ines,anio){
  const out=new Set();
  for(const ine of ines){const s=cob.get(ine);if(s&&Array.from({length:12},(_,k)=>`${anio}-${String(k+1).padStart(2,'0')}`).every(m=>s.has(m)))out.add(ine);}
  return out;
}
// series por sector (campo 2) u ocupación (campo 3) sumando los municipios de o.ines (null = todos), sin la fila 'T';
// o.div / o.cno limitan al sector u ocupación del otro filtro. Map clave → {mes:[lo,hi]}
function filasCalendario(filas,meses,o){
  const out=new Map(),campo=o.campo,ines=o.ines,div=o.div||null,cno=o.cno||null;
  for(const r of filas){
    if(r[2]==='T'||(ines&&!ines.has(r[1])))continue;
    if(div&&r[2]!==div)continue;
    if(cno&&r[3]!==cno)continue;
    const k=r[campo];if(k==null)continue;
    acumular(out,k,meses[r[0]],r[4],r[5]);
  }
  return out;
}
const UMBRAL_CALENDARIO=120;
// índice = contratos del mes / media mensual de la fila en el año × 100 (valores centrales). Los meses fuera de
// disponibles (null = los 12) no cuentan ni tienen índice; un mes disponible sin filas son 0 contratos.
// bajo: menos de o.umbral (120) contratos en el año. pico: mes (0-11) de mayor índice, -1 si no hay contratos o ninguno pasa de 100.
function indiceEstacional(serie,anio,disponibles,o){
  const umbral=(o&&o.umbral!=null)?o.umbral:UMBRAL_CALENDARIO;
  const meses=Array.from({length:12},(_,k)=>{
    const mes=`${anio}-${String(k+1).padStart(2,'0')}`;
    if(disponibles&&!disponibles.has(mes))return {mes,v:null,indice:null};
    const w=serie&&serie[mes];return {mes,v:w?(w[0]+w[1])/2:0,indice:null};
  });
  const usados=meses.filter(x=>x.v!=null),total=usados.reduce((s,x)=>s+x.v,0),n=usados.length;
  const media=n?total/n:0;let pico=-1;
  if(media>0)meses.forEach((x,i)=>{if(x.v==null)return;x.indice=x.v/media*100;if(pico<0||x.indice>meses[pico].indice)pico=i;});
  if(pico>=0&&Math.round(meses[pico].indice)<=100)pico=-1;   // fila plana: sin mes pico
  return {anio,meses,total,media,n,pico,bajo:total<umbral};
}
// las n claves con más contratos (centrales) en los meses dados; sin las que suman 0
function topFilas(series,meses,n){
  const out=[];
  for(const [k,s] of series){let t=0;for(const m of meses){const w=s[m];if(w)t+=(w[0]+w[1])/2;}if(t>0)out.push({k,total:t});}
  return out.sort((a,b)=>b.total-a.total||(a.k<b.k?-1:a.k>b.k?1:0)).slice(0,n);
}
// números de mes (1-12) de los tres meses siguientes a 'YYYY-MM'
// mes desde el que se cuentan los próximos meses: el último dato o, si es posterior, el mes de generación ('YYYY-MM-DD'),
// para no anunciar como próximos meses que ya han pasado
function mesBaseProximos(ultimo,generado){const g=generado?String(generado).slice(0,7):'';return g>ultimo?g:ultimo;}
function proximosMeses(ultimo){const m=Number(ultimo.slice(5));return [1,2,3].map(k=>(m-1+k)%12+1);}
function rangoMeses(ms){return `${MESES[ms[0]-1]} a ${MESES[ms[ms.length-1]-1]}`;}
// filas [{k, ind, patron?}]: las n cuyo índice medio en los 3 meses siguientes al último dato supera más el 100; sin las
// de volumen bajo. ruptura ({k:'nc'|'aviso'}, opcional): las n/c por cambio CNAE no entran y las de aviso llevan aviso: true.
// Las de patrón 'no_repite' no entran en el top: van aparte en noRepiten (como mucho 3, de mayor a menor índice medio).
// Prioridad del top: estable, variable y sin contraste (o sin patrón) y, dentro de cada grupo, índice medio.
// Las de 'no_repite' solo cuentan como pico con un índice medio de MIN_NO_REPITEN_INDICE (110) o más.
// sinDatos: meses de los tres (1-12) sin índice en ninguna fila (p. ej., noviembre con solo 2026): de ellos no se sabe nada.
const PRIORIDAD_PICOS={estable:0,variable:1,sin_contraste:2};
const MAX_NO_REPITEN=3,MIN_NO_REPITEN_INDICE=110;
function proximosPicos(filas,ultimo,n,ruptura){
  const meses=proximosMeses(ultimo),top=[],noRepiten=[],rp=ruptura||{};
  const sinDatos=meses.filter(m=>!filas.some(f=>f.ind&&f.ind.meses[m-1]&&f.ind.meses[m-1].indice!=null));
  for(const f of filas){
    if(!f.ind||f.ind.bajo||rp[f.k]==='nc')continue;
    const v=meses.map(m=>f.ind.meses[m-1].indice);
    if(v.some(x=>x==null))continue;
    const media=v.reduce((s,x)=>s+x,0)/v.length;
    if(!(media>100))continue;
    const clase=f.patron&&f.patron.clase in PRIORIDAD_PICOS?f.patron.clase:f.patron&&f.patron.clase==='no_repite'?'no_repite':'sin_contraste';
    const o={k:f.k,media,clase};if(rp[f.k]==='aviso')o.aviso=true;
    if(clase==='no_repite'){if(media>=MIN_NO_REPITEN_INDICE)noRepiten.push(o);}else top.push(o);
  }
  const porMedia=(a,b)=>b.media-a.media||(a.k<b.k?-1:1);
  return {meses,sinDatos,filas:top.sort((a,b)=>PRIORIDAD_PICOS[a.clase]-PRIORIDAD_PICOS[b.clase]||porMedia(a,b)).slice(0,n),
    noRepiten:noRepiten.sort(porMedia).slice(0,MAX_NO_REPITEN)};
}
// ---------- calendario: índice promediado entre años y patrón ----------
// meses disponibles agrupados por año: {anio: [números de mes 1-12 ordenados]}
function mesesPorAnio(meses){
  const o={};for(const m of meses){const y=m.slice(0,4);(o[y]||(o[y]=[])).push(Number(m.slice(5)));}
  for(const y in o)o[y].sort((a,b)=>a-b);
  return o;
}
// año completo de referencia de un año incompleto: el completo anterior más cercano o, si no hay, el siguiente
function referenciaAnio(y,completos){return completos.filter(c=>c<y).pop()||completos.find(c=>c>y)||null;}
// años que el calendario puede usar: los completos y los incompletos con un año completo de referencia
function aniosCalendario(meses){
  const pa=mesesPorAnio(meses),todos=Object.keys(pa).sort(),completos=todos.filter(y=>pa[y].length===12);
  return todos.filter(y=>pa[y].length===12||referenciaAnio(y,completos));
}
// años elegidos más los de referencia de los incompletos (para medir la cobertura de los municipios)
function aniosConReferencia(meses,anios){
  const pa=mesesPorAnio(meses),completos=Object.keys(pa).sort().filter(y=>pa[y].length===12),out=new Set(anios);
  for(const y of anios)if(pa[y]&&pa[y].length<12){const r=referenciaAnio(y,completos);if(r)out.add(r);}
  return [...out].sort();
}
// municipios publicados todos los meses de los años (y sus referencias); si quedan menos de minFrac de los publicados,
// se quitan los años más antiguos hasta llegar (siempre queda el último). meses: meses de la capa
function ambitoCalendario(cob,ines,meses,anios,minFrac){
  const publicados=ines.filter(i=>cob.has(i));
  let usados=anios.slice();
  for(;;){
    const ys=new Set(aniosConReferencia(meses,usados)),ms=meses.filter(m=>ys.has(m.slice(0,4)));
    const s=new Set(publicados.filter(i=>{const c=cob.get(i);return ms.every(m=>c.has(m));}));
    if(s.size>=minFrac*publicados.length||usados.length<=1)
      return {ines:s,anios:usados,recortados:anios.filter(y=>!usados.includes(y)),nPub:publicados.length};
    usados=usados.slice(1);
  }
}
// Índice promediado entre años. Para cada año y con meses disponibles: índice_y(m) = contratos_y(m) / media_y × 100.
// Año completo: media_y = contratos del año / 12. Año incompleto: media_y = media del año completo de referencia ×
// factor, factor = contratos del año incompleto / contratos del de referencia en los mismos meses (sin factor o con
// media 0, el año no cuenta). Índice final(m) = media de los índices de los años con dato en m (n = cuántos).
// o.anios: años a usar (por defecto todos); la referencia puede ser un año no elegido. anual: media de los contratos
// anuales de los años usados (estimados en los incompletos); bajo: anual < o.umbral (120). pico como indiceEstacional.
function indicePromediado(serie,disponibles,o){
  o=o||{};
  const umbral=o.umbral!=null?o.umbral:UMBRAL_CALENDARIO;
  const pa=mesesPorAnio([...disponibles]),todos=Object.keys(pa).sort(),completos=todos.filter(y=>pa[y].length===12);
  const val=(y,mm)=>{const w=serie&&serie[`${y}-${String(mm).padStart(2,'0')}`];return w?(w[0]+w[1])/2:0;};
  const suma=(y,ms)=>ms.reduce((s,mm)=>s+val(y,mm),0);
  const anios=[];
  for(const y of (o.anios||todos)){
    const ms=pa[y];if(!ms)continue;
    let media,ref=null,factor=null;
    if(ms.length===12)media=suma(y,ms)/12;
    else{
      ref=referenciaAnio(y,completos);if(!ref)continue;
      const sr=suma(ref,ms);if(!(sr>0))continue;
      factor=suma(y,ms)/sr;media=suma(ref,pa[ref])/12*factor;
    }
    if(!(media>0))continue;
    const meses=Array(12).fill(null);
    for(const mm of ms){const v=val(y,mm);meses[mm-1]={v,indice:v/media*100};}
    anios.push({anio:y,media,estimada:ms.length<12,ref,factor,n:ms.length,meses});
  }
  const meses=Array.from({length:12},(_,k)=>{
    const porAnio=anios.filter(a=>a.meses[k]).map(a=>({anio:a.anio,indice:a.meses[k].indice,v:a.meses[k].v}));
    const n=porAnio.length;
    return {n,porAnio,indice:n?porAnio.reduce((s,p)=>s+p.indice,0)/n:null,v:n?porAnio.reduce((s,p)=>s+p.v,0)/n:null};
  });
  const anual=anios.length?anios.reduce((s,a)=>s+a.media*12,0)/anios.length:0;
  let pico=-1;
  meses.forEach((x,i)=>{if(x.indice!=null&&(pico<0||x.indice>meses[pico].indice))pico=i;});
  if(pico>=0&&Math.round(meses[pico].indice)<=100)pico=-1;
  return {anios,meses,anual,total:anual,media:anual/12,pico,bajo:anual<umbral};
}
// correlación de Pearson; null si alguna serie no varía o hay menos de 2 puntos
function pearson(a,b){
  const n=a.length;if(n<2)return null;
  const ma=a.reduce((s,x)=>s+x,0)/n,mb=b.reduce((s,x)=>s+x,0)/n;
  let c=0,va=0,vb=0;for(let i=0;i<n;i++){const da=a[i]-ma,db=b[i]-mb;c+=da*db;va+=da*da;vb+=db*db;}
  return va>1e-12&&vb>1e-12?c/Math.sqrt(va*vb):null;
}
const MIN_MESES_PATRON=6;
function clasePatron(r){return r>=0.7?'estable':r>=0.3?'variable':'no_repite';}
// Patrón: ¿se repite la forma del año? Pearson de los índices mensuales de cada par de años en sus meses comunes
// (al menos 6); r = media de los pares con contraste. Sin pares válidos: 'sin_contraste'.
function patronFila(ind){
  const pares=[],as=(ind&&ind.anios)||[];
  for(let i=0;i<as.length;i++)for(let j=i+1;j<as.length;j++){
    const x=[],y=[];
    for(let k=0;k<12;k++){const p=as[i].meses[k],q=as[j].meses[k];if(p&&q&&p.indice!=null&&q.indice!=null){x.push(p.indice);y.push(q.indice);}}
    if(x.length<MIN_MESES_PATRON)continue;
    const r=pearson(x,y);if(r!=null)pares.push({a:as[i].anio,b:as[j].anio,r,meses:x.length});
  }
  if(!pares.length)return {clase:'sin_contraste',r:null,pares};
  const r=pares.reduce((s,p)=>s+p.r,0)/pares.length;
  return {clase:clasePatron(r),r,pares};
}
const ORDEN_PATRON={estable:0,variable:1,no_repite:2,sin_contraste:3};
// orden por patrón (estable primero), r de mayor a menor dentro de cada clase y, a igualdad, el orden de entrada
function ordenarPorPatron(filas){
  const cl=f=>f.patron&&f.patron.clase in ORDEN_PATRON?ORDEN_PATRON[f.patron.clase]:4,r=f=>f.patron&&f.patron.r!=null?f.patron.r:-Infinity;
  return filas.map((f,i)=>[f,i]).sort((x,y)=>cl(x[0])-cl(y[0])||r(y[0])-r(x[0])||x[1]-y[1]).map(x=>x[0]);
}
// tramos fijos del índice (sobre el valor redondeado que se muestra): <70, 70-89, 90-109, 110-129, 130-159, 160-199, 200 o más
const CORTES_INDICE=[70,90,110,130,160,200];
function tramoIndice(x){
  if(x==null||!isFinite(x))return -1;
  const r=Math.round(x),i=CORTES_INDICE.findIndex(c=>r<c);return i<0?CORTES_INDICE.length:i;
}
// contraste WCAG entre dos colores '#RRGGBB'; colorTextoSobre elige tinta o crema, el de más contraste
function luminancia(hex){
  const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4));
  return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];
}
function contraste(a,b){const la=luminancia(a),lb=luminancia(b);return (Math.max(la,lb)+0.05)/(Math.min(la,lb)+0.05);}
function colorTextoSobre(fondo){return contraste(fondo,'#16213E')>=contraste(fondo,'#FFFFFF')?'#16213E':'#FFFFFF';}

// ---------- rótulos de municipios en el mapa ----------
function areaAnillo(r){let a=0;for(let i=0;i<r.length;i++){const [x0,y0]=r[i],[x1,y1]=r[(i+1)%r.length];a+=x0*y1-x1*y0;}return a/2;}
function centroideAnillo(r){
  const a=areaAnillo(r);
  if(Math.abs(a)<1e-12)return [r.reduce((s,p)=>s+p[0],0)/r.length,r.reduce((s,p)=>s+p[1],0)/r.length];
  let cx=0,cy=0;
  for(let i=0;i<r.length;i++){const [x0,y0]=r[i],[x1,y1]=r[(i+1)%r.length],k=x0*y1-x1*y0;cx+=(x0+x1)*k;cy+=(y0+y1)*k;}
  return [cx/(6*a),cy/(6*a)];
}
// polígonos [[anillo exterior, huecos...], ...]: centroide del exterior de mayor área
function centroideMayor(polis){
  let mejor=polis[0][0],max=-1;
  for(const p of polis){const a=Math.abs(areaAnillo(p[0]));if(a>max){max=a;mejor=p[0];}}
  return centroideAnillo(mejor);
}
function numRotulos(zoom){return Math.min(60,Math.round(8*zoom));}
// caja aproximada del texto en unidades del lienzo (ancho de carácter ≈ 0,6 del cuerpo)
function cajaRotulo(c,o){const h=o.px*o.escala,w=c.nombre.length*o.px*0.6*o.escala;return {x0:c.x-w/2,x1:c.x+w/2,y0:c.y-h/2,y1:c.y+h/2};}
function solapan(a,b){return a.x0<b.x1&&b.x0<a.x1&&a.y0<b.y1&&b.y0<a.y1;}
// cands: [{ine,nombre,x,y,peso}] (peso null = no se rotula); o: {zoom,sel,escala,px,vista,obstaculos}
// El seleccionado va siempre y primero; después los N de más peso dentro de la vista, sin solaparse.
// obstaculos: cajas del lienzo tapadas por controles (botones de zoom): lo que choca con ellas no se rotula.
function elegirRotulos(cands,o){
  const v=o.vista,dentro=c=>!v||(c.x>=v.x&&c.x<=v.x+v.w&&c.y>=v.y&&c.y<=v.y+v.h);
  const sel=o.sel?cands.find(c=>c.ine===o.sel):null;
  const top=cands.filter(c=>c!==sel&&c.peso!=null&&isFinite(c.peso)&&dentro(c))
    .sort((a,b)=>b.peso-a.peso||(a.nombre<b.nombre?-1:a.nombre>b.nombre?1:0)).slice(0,numRotulos(o.zoom));
  const out=[];
  for(const c of (sel?[sel]:[]).concat(top)){
    const caja=cajaRotulo(c,o);
    if((o.obstaculos||[]).some(k=>solapan(k,caja)))continue;
    if(c!==sel&&out.some(p=>solapan(p.caja,caja)))continue;
    out.push(Object.assign({},c,{caja}));
  }
  return out;
}

// ---------- versión ampliada: ocupaciones en crecimiento por zona ----------
// distancia de círculo máximo en km entre dos puntos [lon, lat]
const RADIO_TIERRA=6371.0088;
function haversine(a,b){
  const r=Math.PI/180,dLat=(b[1]-a[1])*r,dLon=(b[0]-a[0])*r;
  const h=Math.sin(dLat/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(dLon/2)**2;
  return 2*RADIO_TIERRA*Math.asin(Math.min(1,Math.sqrt(h)));
}
// centros {ine: [lon, lat]}: municipios a radio km o menos del centro (incluido), de más cerca a más lejos;
// sin centro (null), todos; centro desconocido, ninguno
function zonaRadio(centros,centro,radio){
  if(centro==null)return Object.keys(centros);
  const c=centros[centro];if(!c)return [];
  return Object.keys(centros).map(k=>({k,d:k===centro?0:haversine(c,centros[k])})).filter(x=>x.d<=radio)
    .sort((p,q)=>p.d-q.d||(p.k===centro?-1:q.k===centro?1:p.k<q.k?-1:1)).map(x=>x.k);
}
// filas agrupadas por municipio: Map ine → filas (se calcula una vez por capa)
function indicePorIne(filas){
  const out=new Map();
  for(const r of filas){let l=out.get(r[1]);if(!l){l=[];out.set(r[1],l);}l.push(r);}
  return out;
}
// clave del último periodo del tipo dado ('mes', 'trim' o 'acum') con datos en meses; null sin datos
function ultimoPeriodo(tipo,meses){
  if(!meses||!meses.length)return null;
  const u=meses[meses.length-1];
  if(tipo==='trim'){const ops=opcionesPeriodo('trim',meses);return ops.length?ops[ops.length-1].clave:null;}
  return tipo==='mes'?u:u.slice(0,4);
}
// claves de periodo del tipo dado con datos. Un trimestre solo se ofrece con sus tres meses (en octubre aún no hay T4:
// aparece con diciembre); el acumulado del año sí incluye cada mes nuevo
function opcionesPeriodo(tipo,meses){
  if(!meses||!meses.length)return [];
  const en=new Set(meses);
  if(tipo==='mes')return meses.map(m=>({clave:m,parcial:false}));
  if(tipo==='trim')return trimestres(meses).filter(t=>mesesTrim(t).every(m=>en.has(m))).map(t=>({clave:t,parcial:false}));
  return anios(meses).map(a=>({clave:a,parcial:false}));
}
// meses de A con datos y sus homólogos de B (misma posición): la variación compara los mismos meses.
// b = null si no hay comparación o falta algún mes de B en los datos
function mesesComparables(pA,pB,disp){
  const idx=pA.meses.map((m,i)=>i).filter(i=>disp.has(pA.meses[i]));
  const a=idx.map(i=>pA.meses[i]);
  let b=pB&&a.length?idx.map(i=>pB.meses[i]):null;
  if(b&&b.some(m=>!m||!disp.has(m)))b=null;
  return {a,b,parcial:a.length>0&&a.length<pA.meses.length};
}
// meses del minigráfico: los 12 hasta el último de A, ampliados hacia atrás hasta el primero de B
function ventanaOcupaciones(meses,a,b){
  if(!a||!a.length)return [];
  const fin=meses.indexOf(a[a.length-1]);if(fin<0)return [];
  let ini=Math.max(0,fin-11);
  if(b&&b.length){const i=meses.indexOf(b[0]);if(i>=0&&i<ini)ini=i;}
  return meses.slice(ini,fin+1);
}
const UMBRAL_NUEVA=5,MIN_DONDE=5;
// Ocupaciones (CNO-4) de la zona: contratos en A y B (valores centrales de los intervalos), variación absoluta
// y %, sector principal (división con más contratos de la ocupación en la zona en A; si A es 0, en B), dónde crece
// más (municipio de la zona con mayor aumento absoluto, si alguno crece) y serie de la ventana.
// o: {a, b (meses o null), div (filtro de sector o null), umbral, ventana, nc}. Solo las ocupaciones con al menos
// umbral contratos en A o en B. Estado: ok (ambos de umbral o más), nueva (antes menos de 5 y ahora umbral o más),
// desaparece (antes umbral o más y ahora menos de 5), insuficiente, nc (sin variación) o sin_comparacion.
// Dónde crece más exige un aumento de al menos o.minDonde (5) contratos; si ninguno llega, null.
function ocupacionesZona(porIne,meses,ines,o){
  const iA=new Set(o.a.map(m=>meses.indexOf(m))),iB=new Set((o.b||[]).map(m=>meses.indexOf(m)));
  const iV=new Map((o.ventana||[]).map((m,k)=>[meses.indexOf(m),k])),nV=(o.ventana||[]).length;
  const hayB=!!o.b,div=o.div||null,acc=new Map();
  for(const ine of ines){
    const filas=porIne.get(ine);if(!filas)continue;
    for(const r of filas){
      const cno=r[3];if(cno==null||r[2]==='T'||(div&&r[2]!==div))continue;
      const enA=iA.has(r[0]),enB=hayB&&iB.has(r[0]),v=iV.get(r[0]);
      if(!enA&&!enB&&v===undefined)continue;
      let x=acc.get(cno);
      if(!x){x={a:{lo:0,hi:0},b:{lo:0,hi:0},divA:new Map(),divB:new Map(),mun:new Map(),serie:new Array(nV).fill(0)};acc.set(cno,x);}
      const c=(r[4]+r[5])/2;
      if(v!==undefined)x.serie[v]+=c;
      if(enA){x.a.lo+=r[4];x.a.hi+=r[5];x.divA.set(r[2],(x.divA.get(r[2])||0)+c);x.mun.set(ine,(x.mun.get(ine)||0)+c);}
      if(enB){x.b.lo+=r[4];x.b.hi+=r[5];x.divB.set(r[2],(x.divB.get(r[2])||0)+c);x.mun.set(ine,(x.mun.get(ine)||0)-c);}
    }
  }
  const mayor=m=>{let k=null,v=-Infinity;for(const [d,c] of m)if(c>v||(c===v&&d<k)){k=d;v=c;}return k;};
  // parte (0-1) de la división principal en los contratos de la ocupación
  const peso=(m,k)=>{let t=0;for(const c of m.values())t+=c;return t>0&&k!=null?m.get(k)/t:null;};
  const out=[];
  for(const [cno,x] of acc){
    const ca=central(x.a),cb=hayB?central(x.b):null;
    if(!(ca>=o.umbral||(hayB&&cb>=o.umbral)))continue;
    let estado,pct=null,abs=hayB?ca-cb:null;
    if(!hayB)estado='sin_comparacion';
    else if(o.nc){estado='nc';abs=null;}
    else if(ca>=o.umbral&&cb>=o.umbral){estado='ok';pct=(ca/cb-1)*100;}
    else if(cb<UMBRAL_NUEVA&&ca>=o.umbral)estado='nueva';
    else if(ca<UMBRAL_NUEVA&&cb>=o.umbral)estado='desaparece';
    else if(ca>=o.umbral)estado='emergente';     // antes de 5 a umbral - 1: sin % (base pequeña), pero no es "insuficiente"
    else if(cb>=o.umbral)estado='cae_bajo';      // ahora de 5 a umbral - 1
    else estado='insuficiente';
    let donde=null,dondeAbs=null;const minD=o.minDonde!=null?o.minDonde:MIN_DONDE;
    if(estado!=='sin_comparacion'&&estado!=='nc')for(const [ine,d] of x.mun)if(d>=minD&&d>0&&(dondeAbs==null||d>dondeAbs||(d===dondeAbs&&ine<donde))){donde=ine;dondeAbs=d;}
    out.push({cno,a:x.a,b:hayB?x.b:null,ca,cb,abs,estado,pct,aprox:estado==='ok'&&(aprox(x.a)||aprox(x.b)),
      div:ca>0?mayor(x.divA):mayor(x.divB),divPeso:ca>0?peso(x.divA,mayor(x.divA)):peso(x.divB,mayor(x.divB)),donde,dondeAbs,serie:x.serie});
  }
  return out;
}
// municipio de la zona con más contratos (centrales) en los meses a, con el sector div (o todos), y su parte del total:
// {ine, cuota (0-1)}; null sin contratos
function concentracionZona(porIne,meses,ines,a,div){
  const iA=new Set(a.map(m=>meses.indexOf(m))),por=new Map();let tot=0;
  for(const ine of ines)for(const r of porIne.get(ine)||[]){
    if(!iA.has(r[0])||r[2]==='T'||(div&&r[2]!==div))continue;
    const c=(r[4]+r[5])/2;por.set(ine,(por.get(ine)||0)+c);tot+=c;
  }
  let mejor=null,max=-1;for(const [ine,c] of por)if(c>max||(c===max&&ine<mejor)){mejor=ine;max=c;}
  return tot>0?{ine:mejor,cuota:max/tot}:null;
}
// orden de la tabla: 'aumento' (variación absoluta), 'pct' (las de % primero, luego las nuevas y el resto por aumento)
// o 'volumen' (contratos en A). Sin variación cuentan por volumen. Desempate: más contratos y código.
function ordenarOcupaciones(filas,criterio){
  const vol=(p,q)=>q.ca-p.ca||(p.cno<q.cno?-1:p.cno>q.cno?1:0);
  const abs=f=>f.abs==null?-Infinity:f.abs;
  const cmp=criterio==='volumen'?vol
    :criterio==='pct'?(p,q)=>{
      const g=f=>f.estado==='ok'?0:f.estado==='nueva'?1:2,d=g(p)-g(q);if(d)return d;
      if(g(p)===0)return q.pct-p.pct||vol(p,q);
      return g(p)===1?vol(p,q):(abs(q)-abs(p))||vol(p,q);}
    :(p,q)=>(abs(q)-abs(p))||vol(p,q);
  return filas.slice().sort(cmp);
}
// tarjetas resumen: las n que más crecen y más caen (variación absoluta) y las nuevas (por contratos)
function resumenOcupaciones(filas,n){
  // las nuevas tienen su propia tarjeta: no se repiten en la de las que más crecen
  const crecen=ordenarOcupaciones(filas.filter(f=>f.abs!=null&&f.abs>0&&f.estado!=='nueva'),'aumento').slice(0,n);
  const caen=filas.filter(f=>f.abs!=null&&f.abs<0).sort((p,q)=>p.abs-q.abs||(p.cno<q.cno?-1:1)).slice(0,n);
  const nuevas=ordenarOcupaciones(filas.filter(f=>f.estado==='nueva'),'volumen').slice(0,n);
  return {crecen,nuevas,caen};
}

// ---------- explorador: series agrupadas por municipio, sector u ocupación ----------
// Map clave → {mes:[lo,hi]} de las filas de los municipios o.ines, con el sector o.div y la ocupación o.cno (null = todos).
// o.agrupar: 'mun' (r[1]), 'div' (r[2]) o 'cno' (r[3]). o.conTotal: la capa tiene fila 'T' (temporal): sin sector y por
// municipio se usa esa fila (el total publicado); en el resto, las divisiones, nunca las dos a la vez.
function seriesExplorador(filas,meses,o){
  const campo=o.agrupar==='mun'?1:o.agrupar==='div'?2:3,usaT=!!o.conTotal&&!o.div&&campo===1,out=new Map();
  for(const r of filas){
    if(!o.ines.has(r[1])||(usaT?r[2]!=='T':r[2]==='T'))continue;
    if(o.div&&r[2]!==o.div)continue;
    if(o.cno&&r[3]!==o.cno)continue;
    const k=r[campo];if(k==null)continue;
    acumular(out,k,meses[r[0]],r[4],r[5]);
  }
  return out;
}

root.DILCalculo={seriesExplorador,sumarMes,periodo,comparacion,etiqueta,etiquetaParcial,posicionesComunes,trimestres,anios,seriesPorMunicipio,desglose,cobertura,
  valorPeriodo,parValores,central,aprox,base,sumar,variacion,esInflado,noComparable,avisoCnae,cruzaFrontera,rupturaMunicipal,rankingVariacion,UMBRAL_RANKING,
  mesBaseProximos,concentracionZona,cortesCuantiles,limitarVista,zoomVista,desplazarVista,vistaBase,altoMapaVertical,
  totalAutonomico,cuota,cifraComparativa,centroideMayor,numRotulos,elegirRotulos,
  cuotaETT,variacionCuota,rupturaCombinada,sinEtt,seriesPorDivision,
  aniosCompletos,cubiertosAnio,filasCalendario,indiceEstacional,topFilas,proximosMeses,rangoMeses,proximosPicos,tramoIndice,contraste,colorTextoSobre,
  haversine,zonaRadio,indicePorIne,ultimoPeriodo,opcionesPeriodo,mesesComparables,ventanaOcupaciones,ocupacionesZona,ordenarOcupaciones,resumenOcupaciones,
  mesesPorAnio,aniosCalendario,aniosConReferencia,ambitoCalendario,indicePromediado,pearson,clasePatron,patronFila,ordenarPorPatron,MIN_MESES_PATRON,
  UMBRAL_CALENDARIO,CORTES_INDICE,UMBRAL_NUEVA,MIN_DONDE};
})(typeof globalThis!=='undefined'?globalThis:this);
