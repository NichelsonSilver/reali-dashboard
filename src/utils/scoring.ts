// Motor de scoring de sitios: combina demanda, calidad socioeconómica,
// presión competitiva y canibalización en un score 0-100 con desglose por
// componente (el desglose es lo que el analista de expansión defiende ante
// el comité — el número solo no basta).

import { RasgosSitio } from "./analogos";
import { ResultadoCanibalizacion } from "./canibalizacion";

// ── Pesos ────────────────────────────────────────────────────────────────────
// Punto de partida razonable para farmacia de cercanía: la demanda manda,
// canibalizar la red propia pesa más que enfrentar competencia (la venta
// canibalizada es pérdida neta para la cadena; la competencia solo reparte).
// Calibrables cuando existan ventas reales (regresión sobre análogos).

export interface PesosScoring {
  demanda: number;
  calidadNSE: number;
  competencia: number;
  canibalizacion: number;
}

export const PESOS_DEFAULT: PesosScoring = {
  demanda: 0.40,
  calidadNSE: 0.20,
  competencia: 0.15,
  canibalizacion: 0.25,
};

// Hogares a 1 km que saturan el componente de demanda (≈ p90 de los entornos
// urbanos densos de Santiago según nse_uv.geojson).
export const HOGARES_SATURACION = 15000;

// ── Resultado ────────────────────────────────────────────────────────────────

export interface ComponenteScore {
  nombre: string;
  valor: number;  // 0..1 (1 = favorable)
  peso: number;
  detalle: string;
}

export interface ScoreSitio {
  score: number; // 0..100
  clasificacion: "Alto potencial" | "Atractivo" | "Evaluar con cautela" | "Descartable";
  componentes: ComponenteScore[];
}

function clasificar(score: number): ScoreSitio["clasificacion"] {
  if (score >= 75) return "Alto potencial";
  if (score >= 55) return "Atractivo";
  if (score >= 35) return "Evaluar con cautela";
  return "Descartable";
}

// ── Cálculo ──────────────────────────────────────────────────────────────────

export function calcularScore(
  rasgos: RasgosSitio,
  canibalizacion: ResultadoCanibalizacion | null,
  pesos: PesosScoring = PESOS_DEFAULT,
): ScoreSitio {
  const demanda = Math.min(rasgos.hogares1km / HOGARES_SATURACION, 1);

  // NSE como poder de compra relativo del entorno (alto=1, medio=0.6, bajo=0.3
  // — misma escala que el simulador de ventas, para que score y venta estimada
  // cuenten la misma historia).
  const calidadNSE =
    rasgos.pctNSEAlto * 1 + rasgos.pctNSEMedio * 0.6 + rasgos.pctNSEBajo * 0.3;

  // Presión competitiva: 10+ farmacias de otras cadenas a 500 m saturan.
  const competencia = 1 - Math.min(rasgos.competidores500 / 10, 1);

  // Canibalización: 30%+ de la venta nueva saliendo de tiendas propias anula
  // el componente. Sin capa NSE (o sin tiendas propias cerca) = neutro (1).
  const pctCanib = canibalizacion?.pctDesdePropias ?? 0;
  const canib = 1 - Math.min(pctCanib / 0.3, 1);

  const componentes: ComponenteScore[] = [
    {
      nombre: "Demanda",
      valor: demanda,
      peso: pesos.demanda,
      detalle: `${rasgos.hogares1km.toLocaleString("es-CL")} hogares a 1 km (satura en ${HOGARES_SATURACION.toLocaleString("es-CL")})`,
    },
    {
      nombre: "Calidad NSE",
      valor: calidadNSE,
      peso: pesos.calidadNSE,
      detalle: `${Math.round(rasgos.pctNSEAlto * 100)}% NSE alto · ${Math.round(rasgos.pctNSEMedio * 100)}% medio · ${Math.round(rasgos.pctNSEBajo * 100)}% bajo`,
    },
    {
      nombre: "Competencia",
      valor: competencia,
      peso: pesos.competencia,
      detalle: `${rasgos.competidores500} farmacias de otras cadenas a 500 m`,
    },
    {
      nombre: "Canibalización",
      valor: canib,
      peso: pesos.canibalizacion,
      detalle: canibalizacion
        ? `${Math.round(pctCanib * 100)}% de la venta nueva saldría de tiendas propias`
        : "Sin tiendas propias en el radio de análisis",
    },
  ];

  const score = Math.round(
    componentes.reduce((s, c) => s + c.valor * c.peso, 0) * 100,
  );

  return { score, clasificacion: clasificar(score), componentes };
}
