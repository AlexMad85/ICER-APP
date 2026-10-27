// Service worker de la app demo ICER Empleo: precarga la app y los datos para que funcione sin conexión.
// Al publicar datos nuevos, sube VERSION para que los clientes descarguen la versión nueva.
const VERSION='icer-demo-v3';
const ARCHIVOS=['./','./index.html','./css/app.css','./js/calculo.js','./js/app.js','./manifest.webmanifest',
  './data/datos.json','./data/geo.json','./fonts/inter.woff2','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(ARCHIVOS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
// caché primero y actualización en segundo plano (stale-while-revalidate)
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;
  e.respondWith(caches.open(VERSION).then(async c=>{
    const hit=await c.match(e.request,{ignoreSearch:true});
    const red=fetch(e.request).then(r=>{if(r&&r.ok)c.put(e.request,r.clone());return r;}).catch(()=>hit);
    return hit||red;
  }));
});
