// Modelo de análogos: estima la venta de un sitio candidato a partir de las
// tiendas propias más parecidas (mismo perfil de entorno).
//
// Mientras la cadena cliente no entregue ventas reales, se SIMULAN ventas entre
// 40 y 120 millones CLP correlacionadas con el entorno (NSE, hogares,
// competencia) más ruido determinístico por tienda — así el modelo demuestra
// comportamiento creíble y el reemplazo por datos reales es un cambio de
// fuente, no de arquitectura (ver aplicarVentasReales).

import { Farmacia, CadenaFarmaceutica } from "../types";
import {
  CapaNSE,
  VectorSitio,
  calcularVectorSitio,
  GrupoNSE,
} from "./territorio";

// ── Rasgos numéricos del sitio (features del modelo) ─────────────────────────

export interface RasgosSitio {
  hogares1km: number;
  pctNSEAlto: number;  // AB + C1a + C1b
  pctNSEMedio: number; // C2 + C3
  pctNSEBajo: number;  // D + E
  competidores500: number;  // farmacias de OTRAS cadenas a ≤ 500 m
  competidores1000: number;
  propias1000: number;      // tiendas de la cadena propia a ≤ 1 km
}

const ALTO: GrupoNSE[] = ["AB", "C1a", "C1b"];
const MEDIO: GrupoNSE[] = ["C2", "C3"];
const BAJO: GrupoNSE[] = ["D", "E"];

export function rasgosDesdeVector(v: VectorSitio, cadenaPropia: CadenaFarmaceutica): RasgosSitio {
  const suma = (grupos: GrupoNSE[]) => grupos.reduce((s, g) => s + v.mixNSE[g], 0);
  const cuenta = (radioM: number, propia: boolean) =>
    v.cercanas.filter(
      (c) => c.distanciaM <= radioM && (c.farmacia.cadena === cadenaPropia) === propia,
    ).length;
  return {
    hogares1km: v.hogares1km,
    pctNSEAlto: suma(ALTO),
    pctNSEMedio: suma(MEDIO),
    pctNSEBajo: suma(BAJO),
    competidores500: cuenta(500, false),
    competidores1000: cuenta(1000, false),
    propias1000: cuenta(1000, true),
  };
}

// ── PRNG determinístico por tienda ───────────────────────────────────────────

function hashFNV1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Ventas simuladas ─────────────────────────────────────────────────────────

export const VENTA_MIN_CLP = 40_000_000;
export const VENTA_MAX_CLP = 120_000_000;

export interface TiendaConVenta {
  farmacia: Farmacia;
  rasgos: RasgosSitio;
  ventaMensualCLP: number;
  ventaSimulada: boolean;
}

// Venta esperada según atractivo del entorno: más hogares y NSE más alto
// suben la venta; competencia inmediata la baja. El ruido (±15%) es
// determinístico por id para que la demo sea reproducible.
function simularVenta(rasgos: RasgosSitio, hogaresP90: number, id: string): number {
  const normHog = Math.min(rasgos.hogares1km / Math.max(hogaresP90, 1), 1);
  const calidadNSE = rasgos.pctNSEAlto * 1 + rasgos.pctNSEMedio * 0.6 + rasgos.pctNSEBajo * 0.3;
  const presionComp = 1 - Math.min(rasgos.competidores500 / 10, 1);
  const atractivo = 0.5 * normHog + 0.3 * calidadNSE + 0.2 * presionComp; // 0..1
  const rand = mulberry32(hashFNV1a(id))();
  const ruido = 0.85 + 0.3 * rand; // 0.85 .. 1.15
  const venta = (VENTA_MIN_CLP + atractivo * (VENTA_MAX_CLP - VENTA_MIN_CLP)) * ruido;
  return Math.round(Math.min(Math.max(venta, VENTA_MIN_CLP), VENTA_MAX_CLP));
}

// Calcula rasgos y venta simulada para todas las tiendas de una cadena.
// Costo O(tiendas × farmacias) + O(tiendas × UVs); para Cruz Verde en Chile
// (~800 tiendas) toma unos segundos — cachear el resultado por sesión.
export function simularVentasCadena(
  farmacias: Farmacia[],
  capaNSE: CapaNSE,
  cadena: CadenaFarmaceutica = "Cruz Verde",
): TiendaConVenta[] {
  const tiendas = farmacias.filter((f) => f.cadena === cadena);
  const conRasgos = tiendas.map((t) => {
    const v = calcularVectorSitio({ lat: t.lat, lon: t.lon }, farmacias, capaNSE, null);
    return { farmacia: t, rasgos: rasgosDesdeVector(v, cadena) };
  });
  const hogs = conRasgos.map((t) => t.rasgos.hogares1km).sort((a, b) => a - b);
  const p90 = hogs[Math.floor(hogs.length * 0.9)] ?? 1;
  return conRasgos.map((t) => ({
    ...t,
    ventaMensualCLP: simularVenta(t.rasgos, p90, t.farmacia.id),
    ventaSimulada: true,
  }));
}

// Cuando lleguen las ventas reales de la cadena (id de farmacia → venta mensual),
// se inyectan aquí y el resto del sistema no cambia.
export function aplicarVentasReales(
  tiendas: TiendaConVenta[],
  ventasReales: Map<string, number>,
): TiendaConVenta[] {
  return tiendas.map((t) => {
    const real = ventasReales.get(t.farmacia.id);
    return real !== undefined
      ? { ...t, ventaMensualCLP: real, ventaSimulada: false }
      : t;
  });
}

// ── Selección de análogos y predicción ───────────────────────────────────────

export interface Analogo {
  tienda: TiendaConVenta;
  similitud: number; // 1 = idéntico, → 0 mientras más distinto
}

const CLAVES_RASGOS: (keyof RasgosSitio)[] = [
  "hogares1km",
  "pctNSEAlto",
  "pctNSEMedio",
  "pctNSEBajo",
  "competidores500",
  "competidores1000",
  "propias1000",
];

// Distancia euclidiana sobre rasgos normalizados min-max dentro del pool.
export function seleccionarAnalogos(
  objetivo: RasgosSitio,
  pool: TiendaConVenta[],
  k = 5,
): Analogo[] {
  if (pool.length === 0) return [];
  const rangos = CLAVES_RASGOS.map((clave) => {
    const vals = pool.map((t) => t.rasgos[clave]).concat(objetivo[clave]);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return { clave, min, span: max - min || 1 };
  });
  const norm = (r: RasgosSitio) => rangos.map(({ clave, min, span }) => (r[clave] - min) / span);
  const vObj = norm(objetivo);
  return pool
    .map((tienda) => {
      const vT = norm(tienda.rasgos);
      const d = Math.sqrt(vT.reduce((s, x, i) => s + (x - vObj[i]) ** 2, 0));
      return { tienda, similitud: 1 / (1 + d) };
    })
    .sort((a, b) => b.similitud - a.similitud)
    .slice(0, k);
}

export interface PrediccionVenta {
  ventaEstimadaCLP: number; // promedio ponderado por similitud
  rangoCLP: [number, number]; // min–max de los análogos
  analogos: Analogo[];
}

export function predecirVenta(analogos: Analogo[]): PrediccionVenta | null {
  if (analogos.length === 0) return null;
  const pesoTotal = analogos.reduce((s, a) => s + a.similitud, 0);
  const estimada =
    analogos.reduce((s, a) => s + a.tienda.ventaMensualCLP * a.similitud, 0) / pesoTotal;
  const ventas = analogos.map((a) => a.tienda.ventaMensualCLP);
  return {
    ventaEstimadaCLP: Math.round(estimada),
    rangoCLP: [Math.min(...ventas), Math.max(...ventas)],
    analogos,
  };
}
