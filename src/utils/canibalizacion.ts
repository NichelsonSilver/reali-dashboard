// Modelo de canibalización basado en Huff (modelo gravitacional):
// la probabilidad de que un hogar compre en una tienda es proporcional al
// atractivo de la tienda e inversamente proporcional a la distancia^β.
//
// Se compara el reparto de demanda ANTES y DESPUÉS de abrir el sitio nuevo:
// lo que las tiendas propias pierden entre ambos escenarios es la
// canibalización predicha. Cuando la cadena entregue ventas antes/después de
// aperturas reales, compararPrediccionVsReal() calibra el modelo (β).

import { Farmacia, CadenaFarmaceutica } from "../types";
import { CapaNSE, Punto, haversineM } from "./territorio";

// ── Parámetros ───────────────────────────────────────────────────────────────

export interface ParamsHuff {
  beta: number;          // fricción de distancia (2 = clásico retail de cercanía)
  radioDemandaM: number; // UVs consideradas como origen de demanda
  radioTiendasM: number; // tiendas que compiten por esa demanda
}

export const HUFF_DEFAULT: ParamsHuff = {
  beta: 2,
  radioDemandaM: 2000,
  radioTiendasM: 2500,
};

// Piso de distancia: evita que una tienda "encima" del punto de demanda
// capture el 100% por división entre casi-cero.
const DIST_MIN_M = 100;

// ── Resultado ────────────────────────────────────────────────────────────────

export interface CanibalizacionTienda {
  farmacia: Farmacia;
  distanciaM: number;        // al sitio nuevo
  demandaAntes: number;      // hogares equivalentes capturados sin el sitio nuevo
  demandaDespues: number;
  pctCanibalizado: number;   // (antes - después) / antes
}

export interface ResultadoCanibalizacion {
  demandaSitioNuevo: number;           // hogares equivalentes que captura el sitio
  pctDesdePropias: number;             // fracción de esa captura que sale de tiendas propias
  porTienda: CanibalizacionTienda[];   // solo tiendas propias, ordenadas por impacto
  params: ParamsHuff;
}

// ── Modelo ───────────────────────────────────────────────────────────────────

interface PuntoDemanda {
  pos: Punto;
  hogares: number;
}

// Centroide aproximado: promedio de vértices del anillo exterior del primer
// polígono. Suficiente como origen de demanda de una UV.
function centroide(coords: GeoJSON.Position[]): Punto {
  let lat = 0, lon = 0;
  for (const [x, y] of coords) { lon += x; lat += y; }
  return { lat: lat / coords.length, lon: lon / coords.length };
}

function puntosDemanda(capaNSE: CapaNSE, sitio: Punto, radioM: number): PuntoDemanda[] {
  const puntos: PuntoDemanda[] = [];
  for (const f of capaNSE.features) {
    const g = f.geometry;
    const anillo = (g.type === "Polygon" ? g.coordinates : g.coordinates[0])[0];
    const c = centroide(anillo);
    if (haversineM(sitio, c) <= radioM) {
      puntos.push({ pos: c, hogares: f.properties.hog ?? 0 });
    }
  }
  return puntos;
}

// Reparto Huff: para cada punto de demanda, share de cada tienda
// ∝ atractivo / distancia^β. Atractivo uniforme (1) mientras no haya m² ni
// ventas reales para diferenciarlas.
function repartirDemanda(
  demanda: PuntoDemanda[],
  tiendas: Punto[],
  beta: number,
): number[] {
  const captura = new Array(tiendas.length).fill(0);
  for (const pd of demanda) {
    const pesos = tiendas.map((t) => {
      const d = Math.max(haversineM(pd.pos, t), DIST_MIN_M);
      return 1 / d ** beta;
    });
    const total = pesos.reduce((s, w) => s + w, 0);
    if (total <= 0) continue;
    for (let i = 0; i < tiendas.length; i++) {
      captura[i] += (pesos[i] / total) * pd.hogares;
    }
  }
  return captura;
}

export function predecirCanibalizacion(
  sitio: Punto,
  farmacias: Farmacia[],
  capaNSE: CapaNSE,
  cadenaPropia: CadenaFarmaceutica = "Cruz Verde",
  params: ParamsHuff = HUFF_DEFAULT,
): ResultadoCanibalizacion {
  const demanda = puntosDemanda(capaNSE, sitio, params.radioDemandaM);

  // Todas las tiendas (propias y competencia) dentro del radio compiten por
  // la demanda; omitir a la competencia inflaría la canibalización.
  const enJuego = farmacias.filter(
    (f) => haversineM(sitio, { lat: f.lat, lon: f.lon }) <= params.radioTiendasM,
  );
  const posiciones = enJuego.map((f) => ({ lat: f.lat, lon: f.lon }));

  const antes = repartirDemanda(demanda, posiciones, params.beta);
  const despues = repartirDemanda(demanda, [...posiciones, sitio], params.beta);
  const demandaSitioNuevo = despues[posiciones.length] ?? 0;

  const porTienda: CanibalizacionTienda[] = enJuego
    .map((f, i) => ({
      farmacia: f,
      distanciaM: Math.round(haversineM(sitio, { lat: f.lat, lon: f.lon })),
      demandaAntes: antes[i],
      demandaDespues: despues[i],
      pctCanibalizado: antes[i] > 0 ? (antes[i] - despues[i]) / antes[i] : 0,
    }))
    .filter((t) => t.farmacia.cadena === cadenaPropia)
    .sort(
      (a, b) => (b.demandaAntes - b.demandaDespues) - (a.demandaAntes - a.demandaDespues),
    );

  const perdidaPropias = porTienda.reduce((s, t) => s + (t.demandaAntes - t.demandaDespues), 0);

  return {
    demandaSitioNuevo,
    pctDesdePropias: demandaSitioNuevo > 0 ? perdidaPropias / demandaSitioNuevo : 0,
    porTienda,
    params,
  };
}

// ── Predicho vs real ─────────────────────────────────────────────────────────

// Datos que entrega la cadena tras una apertura: venta de cada tienda propia
// cercana antes y después (mismo mes de años distintos o promedio móvil,
// para aislar estacionalidad).
export interface ImpactoRealTienda {
  idFarmacia: string;
  ventaAntesCLP: number;
  ventaDespuesCLP: number;
}

export interface ComparacionCanibalizacion {
  farmacia: Farmacia;
  pctPredicho: number;
  pctReal: number;
  errorPuntos: number; // predicho - real, en puntos porcentuales
}

export function compararPrediccionVsReal(
  prediccion: ResultadoCanibalizacion,
  reales: ImpactoRealTienda[],
): ComparacionCanibalizacion[] {
  const porId = new Map(reales.map((r) => [r.idFarmacia, r]));
  return prediccion.porTienda
    .filter((t) => porId.has(t.farmacia.id))
    .map((t) => {
      const r = porId.get(t.farmacia.id)!;
      const pctReal =
        r.ventaAntesCLP > 0 ? (r.ventaAntesCLP - r.ventaDespuesCLP) / r.ventaAntesCLP : 0;
      return {
        farmacia: t.farmacia,
        pctPredicho: t.pctCanibalizado,
        pctReal,
        errorPuntos: (t.pctCanibalizado - pctReal) * 100,
      };
    });
}
