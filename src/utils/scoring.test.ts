import { describe, expect, it } from "vitest";
import { RasgosSitio } from "./analogos";
import { ResultadoCanibalizacion, HUFF_DEFAULT } from "./canibalizacion";
import { calcularScore, HOGARES_SATURACION, PESOS_DEFAULT } from "./scoring";

const rasgos = (r: Partial<RasgosSitio> = {}): RasgosSitio => ({
  hogares1km: HOGARES_SATURACION,
  pctNSEAlto: 1,
  pctNSEMedio: 0,
  pctNSEBajo: 0,
  competidores500: 0,
  competidores1000: 0,
  propias1000: 0,
  ...r,
});

const canib = (pctDesdePropias: number): ResultadoCanibalizacion => ({
  demandaSitioNuevo: 1000,
  pctDesdePropias,
  porTienda: [],
  params: HUFF_DEFAULT,
});

describe("calcularScore", () => {
  it("los pesos por defecto suman 1 (score máximo = 100)", () => {
    const suma = Object.values(PESOS_DEFAULT).reduce((s, p) => s + p, 0);
    expect(suma).toBeCloseTo(1);
    expect(calcularScore(rasgos(), null).score).toBe(100);
  });

  it("la demanda satura y no premia más allá del tope", () => {
    const a = calcularScore(rasgos({ hogares1km: HOGARES_SATURACION }), null);
    const b = calcularScore(rasgos({ hogares1km: HOGARES_SATURACION * 3 }), null);
    expect(b.score).toBe(a.score);
  });

  it("10 o más competidores a 500 m anulan el componente de competencia", () => {
    const c = calcularScore(rasgos({ competidores500: 25 }), null).componentes
      .find((x) => x.nombre === "Competencia")!;
    expect(c.valor).toBe(0);
  });

  it("canibalizar 30% o más anula el componente; sin tiendas propias es neutro", () => {
    const valor = (r: ResultadoCanibalizacion | null) =>
      calcularScore(rasgos(), r).componentes.find((x) => x.nombre === "Canibalización")!.valor;
    expect(valor(null)).toBe(1);
    expect(valor(canib(0.15))).toBeCloseTo(0.5);
    expect(valor(canib(0.6))).toBe(0);
  });

  it("todos los componentes quedan en 0..1", () => {
    const s = calcularScore(
      rasgos({ hogares1km: 0, pctNSEAlto: 0, pctNSEBajo: 1, competidores500: 99 }),
      canib(2),
    );
    for (const c of s.componentes) {
      expect(c.valor).toBeGreaterThanOrEqual(0);
      expect(c.valor).toBeLessThanOrEqual(1);
    }
  });

  it("clasifica en los umbrales 75 / 55 / 35", () => {
    // Solo la demanda varía: score = 40·x + 60 con NSE alto, sin competencia ni canib.
    const conDemanda = (x: number) =>
      calcularScore(rasgos({ hogares1km: HOGARES_SATURACION * x }), null);
    expect(conDemanda(1).clasificacion).toBe("Alto potencial");
    expect(conDemanda(0).clasificacion).toBe("Atractivo");
    const bajo = calcularScore(
      rasgos({ hogares1km: 0, pctNSEAlto: 0, pctNSEBajo: 1, competidores500: 5 }), // 6 + 7,5 + 25
      canib(0),
    );
    expect(bajo.clasificacion).toBe("Evaluar con cautela");
    expect(calcularScore(rasgos({ hogares1km: 0, pctNSEAlto: 0, competidores500: 10 }), canib(1))
      .clasificacion).toBe("Descartable");
  });
});
