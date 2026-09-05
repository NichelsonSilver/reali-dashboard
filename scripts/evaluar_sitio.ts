// CLI del copiloto territorial: evalúa un sitio candidato desde la terminal
// usando el mismo motor que la página "Evaluar Sitio" de la app.
//
// Uso:
//   npx tsx scripts/evaluar_sitio.ts "Av. Irarrázaval 3400, Ñuñoa"
//   npx tsx scripts/evaluar_sitio.ts "-33.4536,-70.5952"

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Papa from "papaparse";
import { Farmacia, CadenaFarmaceutica } from "../src/types";
import { CapaNSE, Punto, calcularVectorSitio } from "../src/utils/territorio";
import { rasgosDesdeVector, simularVentasCadena, seleccionarAnalogos, predecirVenta } from "../src/utils/analogos";
import { predecirCanibalizacion } from "../src/utils/canibalizacion";
import { calcularScore } from "../src/utils/scoring";
import { geocodificar } from "../src/utils/geocodificar";

const BASE = join(dirname(fileURLToPath(import.meta.url)), "..");
const CADENA: CadenaFarmaceutica = "Cruz Verde";

function cargarFarmacias(): Farmacia[] {
  const raw = readFileSync(join(BASE, "src/data/farmacias.csv"), "utf-8");
  const res = Papa.parse<Record<string, string>>(raw, { header: true, skipEmptyLines: true });
  return res.data
    .filter((r) => r.lat && r.lon)
    .map((r) => ({
      id: r.id, nombre: r.nombre, cadena: (r.cadena as CadenaFarmaceutica) ?? "Otra",
      direccion: r.direccion, comuna: r.comuna, region: r.region,
      lat: parseFloat(r.lat), lon: parseFloat(r.lon), tipo: r.tipo,
    }));
}

const fmtCLP = (v: number) => `$${(v / 1e6).toFixed(1)} M`;
const fmtPct = (v: number) => `${Math.round(v * 100)}%`;

async function main() {
  const arg = process.argv.slice(2).join(" ").trim();
  if (!arg) {
    console.error('Uso: npx tsx scripts/evaluar_sitio.ts "<dirección>" | "<lat,lon>"');
    process.exit(1);
  }

  let centro: Punto;
  let etiqueta = arg;
  const coords = arg.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (coords) {
    centro = { lat: parseFloat(coords[1]), lon: parseFloat(coords[2]) };
  } else {
    const res = await geocodificar(arg);
    if (res.length === 0) { console.error("Dirección no encontrada."); process.exit(1); }
    centro = { lat: res[0].lat, lon: res[0].lon };
    etiqueta = res[0].displayName;
  }

  console.log(`\n── DOSIER DE SITIO · REALI ─────────────────────────────`);
  console.log(`Sitio: ${etiqueta}`);
  console.log(`Coordenadas: ${centro.lat.toFixed(5)}, ${centro.lon.toFixed(5)}\n`);

  const farmacias = cargarFarmacias();
  // Prefiere el maestro nacional; si no está (repo público, clon sin
  // datos_maestros/), cae a la muestra publicada y avisa que la cobertura
  // es parcial en vez de reventar con ENOENT.
  const rutasNSE = [
    join(BASE, "datos_maestros/nse_uv.geojson"),
    join(BASE, "public/data/nse_uv.geojson"),
  ];
  const rutaNSE = rutasNSE.find((r) => existsSync(r));
  if (!rutaNSE) {
    console.error("No encontré la capa NSE. Rutas probadas:");
    for (const r of rutasNSE) console.error("  " + r);
    process.exit(1);
  }
  if (rutaNSE !== rutasNSE[0]) {
    console.warn("⚠  Usando la muestra publicada: cobertura limitada a Providencia y Ñuñoa.");
  }
  const capaNSE: CapaNSE = JSON.parse(readFileSync(rutaNSE, "utf-8"));

  const vector = calcularVectorSitio(centro, farmacias, capaNSE, null);
  const rasgos = rasgosDesdeVector(vector, CADENA);

  console.log(`Comuna (UV): ${vector.comuna ?? "s/d"} · NSE del punto: ${vector.nseSitio ?? "s/d"}`);
  console.log(`Hogares a 1 km: ${rasgos.hogares1km.toLocaleString("es-CL")}`);
  for (const r of vector.radios) {
    const propias = r.porCadena[CADENA] ?? 0;
    console.log(`  ${String(r.radioM).padStart(4)} m → ${r.totalFarmacias} farmacias (${propias} ${CADENA}, ${r.totalFarmacias - propias} otras)`);
  }
  const mix = Object.entries(vector.mixNSE).filter(([, v]) => v > 0.005)
    .map(([g, v]) => `${g} ${fmtPct(v)}`).join(" · ");
  console.log(`Mix NSE 1 km: ${mix || "sin datos"}\n`);

  console.log("Preparando pool de análogos (ventas simuladas)…");
  const pool = simularVentasCadena(farmacias, capaNSE, CADENA);
  const analogos = seleccionarAnalogos(rasgos, pool, 5);
  const pred = predecirVenta(analogos);
  if (pred) {
    console.log(`\nVenta mensual estimada: ${fmtCLP(pred.ventaEstimadaCLP)} (rango ${fmtCLP(pred.rangoCLP[0])}–${fmtCLP(pred.rangoCLP[1])}) [SIMULADA]`);
    for (const a of pred.analogos) {
      console.log(`  · ${a.tienda.farmacia.nombre} (${a.tienda.farmacia.comuna}) — similitud ${fmtPct(a.similitud)}, venta ${fmtCLP(a.tienda.ventaMensualCLP)}`);
    }
  }

  const canib = predecirCanibalizacion(centro, farmacias, capaNSE, CADENA);
  console.log(`\nCanibalización predicha: ${fmtPct(canib.pctDesdePropias)} de la venta nueva saldría de la red propia`);
  for (const t of canib.porTienda.slice(0, 5)) {
    console.log(`  · ${t.farmacia.nombre} a ${t.distanciaM} m → impacto −${fmtPct(t.pctCanibalizado)}`);
  }

  const score = calcularScore(rasgos, canib);
  console.log(`\nSCORE: ${score.score}/100 → ${score.clasificacion}`);
  for (const c of score.componentes) {
    console.log(`  ${c.nombre.padEnd(16)} ${fmtPct(c.valor).padStart(4)} × peso ${fmtPct(c.peso).padStart(3)} — ${c.detalle}`);
  }
  console.log("");
}

main();
