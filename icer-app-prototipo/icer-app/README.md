# ICER Empleo · App demo (prototipo)

PWA estática (HTML + CSS + JS vanilla, sin build) generada a partir del dashboard
"Inteligencia Laboral ICER (Piloto Crit)". Login simulado: **no hay autenticación real**.

## Probar en local
    cd icer-app && python3 -m http.server 8765
    # abrir http://localhost:8765/

## Estructura
- index.html, css/app.css, js/app.js: interfaz (Inicio, Mapa, Ranking, Tendencias, Notas y la hoja de filtros)
- js/calculo.js: librería de cálculo DILCalculo del dashboard original, **sin cambios**
- data/datos.json: datos del dashboard original (capas ett, temporal, total, catálogos, meta, totales SEPE)
- data/geo.json: geometría municipal (Madrid y Valencia)
- manifest.webmanifest, sw.js, icons/: instalación como app y uso sin conexión
- screenshots/: capturas a 390x844 (móvil) y 1280x800 (escritorio)

Para actualizar los datos, sustituye data/datos.json y data/geo.json y sube la VERSION de sw.js.
