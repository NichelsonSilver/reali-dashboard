// Motor territorial: dado un punto (lat/lon), calcula el "vector de sitio"
// que alimenta el dosier, el modelo de análogos, la canibalización y el
// scoring. Módulo puro — sin React, sin fetch; recibe los datos ya cargados.

import type { Feature, FeatureCollection, Polygon, MultiPolygon, Position } from "geojson";
import { Farmacia, CadenaFarmaceutica } from "../types";
import type { Manzanas } from "../hooks/useGeoCapas";

// ── Tipos ────────────────────────────────────────────────────────────────────

export type GrupoNSE = "AB" | "C1a" | "C1b" | "C2" | "C3" | "D" | "E";

export const GRUPOS_NSE: GrupoNSE[] = ["AB", "C1a", "C1b", "C2", "C3", "D", "E"];

// Propiedades de public/data/nse_uv.geojson. Soporta ambos esquemas:
// el viejo (pct_* por grupo) y el nuevo de generar_nse_uv.py (score/percentil).
export interface PropsUV {
  id: string;
  comuna: string;
  cut: number;
  region: string;
  nse: GrupoNSE;
  hog: number;
  score?: number;
  percentil?: number;
  [key: string]: unknown;
}

export type CapaNSE = FeatureCollection<Polygon | MultiPolygon, PropsUV>;

export interface Punto {
  lat: number;
  lon: number;
}

export interface CompetidorCercano {
  farmacia: Farmacia;
  distanciaM: number;
}

export interface AnalisisRadio {
  radioM: number;
  totalFarmacias: number;
  porCadena: Partial<Record<CadenaFarmaceutica, number>>;
  poblacion: number | null; // null fuera de RM (sin manzanas censales)
  hogares: number | null;
}

export interface VectorSitio {
  centro: Punto;
  comuna: string | null;      // comuna de la UV que contiene el punto
  nseSitio: GrupoNSE | null;  // NSE de la UV que contiene el punto
  radios: AnalisisRadio[];    // análisis a 300 / 500 / 1000 m
  mixNSE: Record<GrupoNSE, number>; // share de hogares por grupo en 1 km (suma 1)
  hogares1km: number;         // hogares estimados en 1 km (desde UVs)
  cercanas: CompetidorCercano[]; // todas las farmacias a ≤ 1 km, ordenadas
  masCercanaPorCadena: Partial<Record<CadenaFarmaceutica, CompetidorCercano>>;
}

export const RADIOS_M = [300, 500, 1000] as const;

// ── Geometría ────────────────────────────────────────────────────────────────

const R_TIERRA_M = 6371000;

export function haversineM(a: Punto, b: Punto): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R_TIERRA_M * Math.asin(Math.sqrt(s));
}

// Ray casting punto-en-polígono sobre coordenadas [lon, lat]
function puntoEnAnillo(p: Punto, anillo: Position[]): boolean {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i];
    const [xj, yj] = anillo[j];
    if (yi > p.lat !== yj > p.lat && p.lon < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) {
      dentro = !dentro;
    }
  }
  return dentro;
}

export function puntoEnFeature(p: Punto, f: Feature<Polygon | MultiPolygon>): boolean {
  const g = f.geometry;
  const polys: Position[][][] = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  for (const poly of polys) {
    if (puntoEnAnillo(p, poly[0])) {
      // dentro del anillo exterior; descartar hoyos
      let enHoyo = false;
      for (let h = 1; h < poly.length; h++) {
        if (puntoEnAnillo(p, poly[h])) { enHoyo = true; break; }
      }
      if (!enHoyo) return true;
    }
  }
  return false;
}

type BBox = [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]

const cacheBBox = new WeakMap<Feature<Polygon | MultiPolygon>, BBox>();

function bboxDe(f: Feature<Polygon | MultiPolygon>): BBox {
  const memo = cacheBBox.get(f);
  if (memo) return memo;
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  const rec = (coords: unknown): void => {
    if (typeof (coords as Position)[0] === "number") {
      const [lon, lat] = coords as Position;
      if (lon < minLon) minLon = lon;
      if (lat < minLat) minLat = lat;
      if (lon > maxLon) maxLon = lon;
      if (lat > maxLat) maxLat = lat;
      return;
    }
    for (const c of coords as unknown[]) rec(c);
  };
  rec(f.geometry.coordinates);
  const bb: BBox = [minLon, minLat, maxLon, maxLat];
  cacheBBox.set(f, bb);
  return bb;
}

// ¿El bbox del feature intersecta el bbox del círculo? (pre-filtro barato)
function bboxTocaCirculo(bb: BBox, centro: Punto, radioM: number): boolean {
  const dLat = radioM / 111320; // grados de latitud por metro
  const dLon = radioM / (111320 * Math.cos((centro.lat * Math.PI) / 180));
  return (
    bb[0] <= centro.lon + dLon && bb[2] >= centro.lon - dLon &&
    bb[1] <= centro.lat + dLat && bb[3] >= centro.lat - dLat
  );
}

// Fracción aproximada del polígono dentro del círculo: proporción de sus
// vértices del anillo exterior a distancia ≤ radio. Suficiente para ponderar
// hogares de UVs en el borde del radio (las UVs son pequeñas respecto a 1 km).
function fraccionEnRadio(f: Feature<Polygon | MultiPolygon>, centro: Punto, radioM: number): number {
  const g = f.geometry;
  const polys: Position[][][] = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  let total = 0, dentro = 0;
  for (const poly of polys) {
    for (const [lon, lat] of poly[0]) {
      total++;
      if (haversineM(centro, { lat, lon }) <= radioM) dentro++;
    }
  }
  return total > 0 ? dentro / total : 0;
}

// ── Farmacias ────────────────────────────────────────────────────────────────

export function farmaciasEnRadio(
  farmacias: Farmacia[],
  centro: Punto,
  radioM: number,
): CompetidorCercano[] {
  return farmacias
    .map((f) => ({ farmacia: f, distanciaM: haversineM(centro, { lat: f.lat, lon: f.lon }) }))
    .filter((c) => c.distanciaM <= radioM)
    .sort((a, b) => a.distanciaM - b.distanciaM);
}

// ── NSE / demografía ─────────────────────────────────────────────────────────

export function uvDelPunto(capa: CapaNSE, p: Punto): Feature<Polygon | MultiPolygon, PropsUV> | null {
  for (const f of capa.features) {
    const bb = bboxDe(f);
    if (p.lon < bb[0] || p.lon > bb[2] || p.lat < bb[1] || p.lat > bb[3]) continue;
    if (puntoEnFeature(p, f)) return f;
  }
  return null;
}

export interface MixNSE {
  mix: Record<GrupoNSE, number>; // shares que suman 1 (o todos 0 si no hay datos)
  hogares: number;               // hogares ponderados dentro del radio
}

export function mixNSEEnRadio(capa: CapaNSE, centro: Punto, radioM: number): MixNSE {
  const hogaresPorGrupo = Object.fromEntries(GRUPOS_NSE.map((g) => [g, 0])) as Record<GrupoNSE, number>;
  let total = 0;
  for (const f of capa.features) {
    if (!bboxTocaCirculo(bboxDe(f), centro, radioM)) continue;
    const frac = fraccionEnRadio(f, centro, radioM);
    if (frac <= 0) continue;
    const hog = (f.properties.hog ?? 0) * frac;
    const g = f.properties.nse;
    if (g in hogaresPorGrupo) {
      hogaresPorGrupo[g] += hog;
      total += hog;
    }
  }
  const mix = Object.fromEntries(
    GRUPOS_NSE.map((g) => [g, total > 0 ? hogaresPorGrupo[g] / total : 0]),
  ) as Record<GrupoNSE, number>;
  return { mix, hogares: Math.round(total) };
}

export interface PoblacionRadio {
  poblacion: number;
  hogares: number;
}

// Población desde manzanas censales (solo RM). Las manzanas son pequeñas,
// basta con testear su primer vértice contra el radio.
export function poblacionEnRadio(manzanas: Manzanas, centro: Punto, radioM: number): PoblacionRadio {
  let poblacion = 0, hogares = 0;
  for (const f of manzanas.features) {
    if (!bboxTocaCirculo(bboxDe(f), centro, radioM)) continue;
    const g = f.geometry;
    const anillo = (g.type === "Polygon" ? g.coordinates : g.coordinates[0])[0];
    const [lon, lat] = anillo[0];
    if (haversineM(centro, { lat, lon }) <= radioM) {
      poblacion += f.properties.pob ?? 0;
      hogares += f.properties.hog ?? 0;
    }
  }
  return { poblacion, hogares };
}

// ── Vector de sitio ──────────────────────────────────────────────────────────

export function calcularVectorSitio(
  centro: Punto,
  farmacias: Farmacia[],
  capaNSE: CapaNSE | null,
  manzanas: Manzanas | null,
): VectorSitio {
  const cercanas = farmaciasEnRadio(farmacias, centro, Math.max(...RADIOS_M));

  const masCercanaPorCadena: Partial<Record<CadenaFarmaceutica, CompetidorCercano>> = {};
  for (const c of cercanas) {
    const cad = c.farmacia.cadena;
    if (!masCercanaPorCadena[cad]) masCercanaPorCadena[cad] = c; // ya vienen ordenadas
  }

  const radios: AnalisisRadio[] = RADIOS_M.map((radioM) => {
    const enRadio = cercanas.filter((c) => c.distanciaM <= radioM);
    const porCadena: Partial<Record<CadenaFarmaceutica, number>> = {};
    for (const c of enRadio) {
      porCadena[c.farmacia.cadena] = (porCadena[c.farmacia.cadena] ?? 0) + 1;
    }
    const pob = manzanas ? poblacionEnRadio(manzanas, centro, radioM) : null;
    return {
      radioM,
      totalFarmacias: enRadio.length,
      porCadena,
      poblacion: pob ? pob.poblacion : null,
      hogares: pob ? pob.hogares : null,
    };
  });

  const uv = capaNSE ? uvDelPunto(capaNSE, centro) : null;
  const mix1km = capaNSE
    ? mixNSEEnRadio(capaNSE, centro, 1000)
    : { mix: Object.fromEntries(GRUPOS_NSE.map((g) => [g, 0])) as Record<GrupoNSE, number>, hogares: 0 };

  return {
    centro,
    comuna: uv?.properties.comuna ?? null,
    nseSitio: uv?.properties.nse ?? null,
    radios,
    mixNSE: mix1km.mix,
    hogares1km: mix1km.hogares,
    cercanas,
    masCercanaPorCadena,
  };
}
