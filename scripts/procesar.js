// Actualiza data/state.json del tablero Incentivos P&G a partir de los archivos de una carpeta.
// Usa el mismo motor de cálculo que la página (se lee de index.html), así los resultados son idénticos.
// Uso: node scripts/procesar.js "C:\ruta\a\los\archivos" [--todo]
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const HTML = path.join(ROOT, 'index.html');
const OUT = path.join(ROOT, 'data', 'state.json');
const MAN = path.join(ROOT, 'data', 'manifest.json');

const args = process.argv.slice(2);
const TODO = args.includes('--todo');
const RUTA = args.find(a => !a.startsWith('--'));
if (!RUTA) { console.error('Indica la carpeta de los archivos. Ejemplo: node scripts/procesar.js "C:\\Incentivos\\Archivos"'); process.exit(1); }
if (!fs.existsSync(RUTA) || !fs.statSync(RUTA).isDirectory()) { console.error(`No encuentro la carpeta: ${RUTA}`); process.exit(1); }
if (typeof DecompressionStream === 'undefined') { console.error('Necesitas Node.js 18 o más reciente (https://nodejs.org).'); process.exit(1); }

// ---------- motor del tablero (primer <script> de index.html) y datos de origen ----------
const html = fs.readFileSync(HTML, 'utf8');
const core = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
const mod = { exports: {} };
vm.runInThisContext(`(function(module, exports){${core}\n})`)(mod, mod.exports);
const { INC } = mod.exports;
const i0 = html.indexOf('const SEED = ') + 'const SEED = '.length, i1 = html.indexOf(';\n', i0);
const SEED = JSON.parse(html.slice(i0, i1));
const clone = o => JSON.parse(JSON.stringify(o));
// misma función restore() de la página: combina lo guardado con los datos de origen
const rSrc = html.slice(html.indexOf('function restore(raw){'), html.indexOf('\nlet state = restore();'));
const restore = new Function('SEED', 'INC', 'clone', 'lsGet', 'LS', `${rSrc}\nreturn restore;`)(SEED, INC, clone, () => null, 'x');

// ---------- archivos: tipo por nombre y orden de carga ----------
const TIPOS = [
  { k: 'calendario', re: /^calendario.*\.csv$/i, o: 1 },
  { k: 'mecex', re: /^mecanica[_ ]?ejecucion.*\.xls[xm]$/i, o: 2 },
  { k: 'mecanica', re: /^mecanica.*\.xls[xm]$/i, o: 3 },
  { k: 'tc', re: /(^tc[_ ]|maslow).*\.xls[xm]$/i, o: 4 },
  { k: 'cartera', re: /cartera.*\.xls[xm]$/i, o: 5 },
  { k: 'bloques', re: /bloques.*\.xls[xm]$/i, o: 6 },
  { k: 'historia', re: /^bdpg\d{4}.*\.csv$/i, o: 7 },
  { k: 'venta', re: /^bdpgmesactual.*\.csv$/i, o: 8 },
];
const tipoDe = f => TIPOS.find(t => t.re.test(f));
const files = fs.readdirSync(RUTA).filter(f => !f.startsWith('~$')).map(f => ({ f, t: tipoDe(f), st: fs.statSync(path.join(RUTA, f)) }))
  .filter(x => x.t && x.st.isFile()).sort((a, b) => a.t.o - b.t.o || a.f.localeCompare(b.f));
if (!files.length) { console.error('No encontré archivos reconocibles en la carpeta (CalendarioComercial.csv, MECANICA.xlsx, TC…xlsm, BDPG2025.csv, BDPGMESACTUAL.csv…).'); process.exit(1); }

// ---------- qué procesar: solo lo que cambió (o todo con --todo) ----------
const man = (!TODO && fs.existsSync(MAN)) ? JSON.parse(fs.readFileSync(MAN, 'utf8')) : {};
// huella por contenido (sirve igual en tu PC y en GitHub, donde las fechas de los archivos cambian)
const crypto = require('crypto');
const firma = x => x.h || (x.h = crypto.createHash('sha1').update(fs.readFileSync(path.join(RUTA, x.f))).digest('hex'));
let cambio = files.filter(x => man[x.f] !== firma(x));
// si cambia la mecánica, la venta se vuelve a clasificar; si cambia el calendario, la venta del mes se vuelve a ubicar por día
if (cambio.some(x => x.t.k === 'mecanica')) cambio = files.filter(x => cambio.includes(x) || x.t.k === 'historia' || x.t.k === 'venta');
if (cambio.some(x => x.t.k === 'calendario')) cambio = files.filter(x => cambio.includes(x) || x.t.k === 'venta');
if (!cambio.length) { console.log('No hay archivos nuevos o modificados. Nada que actualizar.'); process.exit(0); }

(async () => {
  const prev = (!TODO && fs.existsSync(OUT)) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
  const state = restore(prev || null);
  state.updName = state.updName || {};
  let errores = 0;
  for (const x of cambio) {
    const p = path.join(RUTA, x.f), buf = fs.readFileSync(p);
    process.stdout.write(`· ${x.f} (${(x.st.size / 1048576).toFixed(1)} MB)… `);
    try {
      let last = -1;
      // mismo camino que la página al subir un archivo (la venta se lee por partes, sin cargarla entera en memoria)
      const blob = typeof File !== 'undefined' ? new File([buf], x.f) : Object.defineProperty(new Blob([buf]), 'name', { value: x.f });
      const r = await INC.loadFile(blob, state, q => { const v = Math.floor(q * 10); if (v !== last) { last = v; process.stdout.write(`${v * 10}% `); } });
      const slot = x.t.k === 'historia' ? 'historia' : x.t.k;
      state.updName[slot] = x.f; if (slot === 'historia') { state.upd = state.upd || {}; state.upd.historia = new Date().toISOString(); }
      man[x.f] = firma(x);
      console.log(`\n  ✓ ${r.msg}`);
    } catch (e) { errores++; console.log(`\n  ✗ ${e.message}`); }
  }
  // mismo formato que guarda la página
  const um = state.userMonths || [];
  const o = Object.assign({}, state, { sales: {}, days: {}, exec: {} });
  for (const m of um) { if (state.exec && state.exec[m]) o.exec[m] = state.exec[m]; if (state.sales[m]) o.sales[m] = state.sales[m]; if (state.days && state.days[m]) o.days[m] = state.days[m]; }
  o.savedAt = Date.now();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(o));
  fs.writeFileSync(MAN, JSON.stringify(man, null, 1));
  console.log(`\nDatos guardados en data/state.json (${(fs.statSync(OUT).size / 1048576).toFixed(1)} MB).${errores ? ` ${errores} archivo(s) con error: revisa los mensajes.` : ''}`);
  process.exit(errores ? 2 : 0);
})().catch(e => { console.error('Error:', e.stack || e.message); process.exit(1); });
