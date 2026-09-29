import { describe, expect, it } from "vitest";
import { Farmacia, CadenaFarmaceutica } from "../types";
import { CapaNSE, Punto } from "./territorio";
import { compararPrediccionVsReal, predecirCanibalizacion } from "./canibalizacion";

const SITIO: Punto = { lat: -33.43, lon: -70.61 };
// ~0,009° de latitud ≈ 1 km
const aKm = (km: number, dir: 1 | -1 = 1): Punto => ({ lat: SITIO.lat + dir * 0.009 * km, lon: SITIO.lon });

const farmacia = (id: string, cadena: CadenaFarmaceutica, p: Punto): Farmacia => ({
  id, nombre: id, cadena, tipo: "cadena", formato: "farmacia",
  direccion: "", comuna: "Providencia", region: "Metropolitana", lat: p.lat, lon: p.lon,
});

// Una UV cuadrada chica centrada en `p`, con `hog` hogares.
const uv = (p: Punto, hog: number) => ({
  type: "Feature" as const,
  properties: { id: `uv${p.lat}`, comuna: "Providencia", cut: 13123, region: "Metropolitana",
    nse: "C2" as const, hog },
  geometry: {
    type: "Polygon" as const,
    coordinates: [[
      [p.lon - 0.001, p.lat - 0.001], [p.lon + 0.001, p.lat - 0.001],
      [p.lon + 0.001, p.lat + 0.001], [p.lon - 0.001, p.lat + 0.001],
    ]],
  },
});

const capa = (...features: ReturnType<typeof uv>[]): CapaNSE =>
  ({ type: "FeatureCollection", features }) as CapaNSE;

describe("predecirCanibalizacion", () => {
  it("sin tiendas propias cerca, no hay canibalización", () => {
    const r = predecirCanibalizacion(SITIO, [farmacia("c", "Ahumada", aKm(0.5))],
      capa(uv(SITIO, 1000)), "Cruz Verde");
    expect(r.pctDesdePropias).toBe(0);
    expect(r.porTienda).toHaveLength(0);
    expect(r.demandaSitioNuevo).toBeGreaterThan(0);
  });

  it("la demanda se conserva: lo que captura el sitio sale de las tiendas existentes", () => {
    const tiendas = [
      farmacia("p1", "Cruz Verde", aKm(0.6)),
      farmacia("c1", "Ahumada", aKm(0.4, -1)),
      farmacia("c2", "Salcobrand", aKm(1.2)),
    ];
    const r = predecirCanibalizacion(SITIO, tiendas, capa(uv(SITIO, 1000), uv(aKm(1), 500)),
      "Cruz Verde");
    // Con una sola tienda propia, su pérdida / captura del sitio = pctDesdePropias
    const p1 = r.porTienda[0];
    expect(p1.demandaAntes - p1.demandaDespues).toBeCloseTo(r.pctDesdePropias * r.demandaSitioNuevo);
    expect(r.pctDesdePropias).toBeGreaterThan(0);
    expect(r.pctDesdePropias).toBeLessThan(1);
  });

  it("una propia y una competidora simétricas reparten la canibalización mitad y mitad", () => {
    const r = predecirCanibalizacion(SITIO, [
      farmacia("p", "Cruz Verde", aKm(0.5)),
      farmacia("c", "Ahumada", aKm(0.5, -1)),
    ], capa(uv(SITIO, 1000)), "Cruz Verde");
    expect(r.pctDesdePropias).toBeCloseTo(0.5, 3);
  });

  it("la tienda propia más cercana es la más canibalizada y va primero", () => {
    const r = predecirCanibalizacion(SITIO, [
      farmacia("lejos", "Cruz Verde", aKm(2)),
      farmacia("cerca", "Cruz Verde", aKm(0.3)),
    ], capa(uv(SITIO, 1000)), "Cruz Verde");
    expect(r.porTienda.map((t) => t.farmacia.id)).toEqual(["cerca", "lejos"]);
  });

  it("ignora tiendas fuera del radio y demanda fuera del radio", () => {
    const r = predecirCanibalizacion(SITIO, [farmacia("p", "Cruz Verde", aKm(5))],
      capa(uv(aKm(5), 1000)), "Cruz Verde");
    expect(r.demandaSitioNuevo).toBe(0);
    expect(r.pctDesdePropias).toBe(0);
  });
});

describe("compararPrediccionVsReal", () => {
  it("cruza por id y reporta el error en puntos porcentuales", () => {
    const pred = predecirCanibalizacion(SITIO, [farmacia("p", "Cruz Verde", aKm(0.5))],
      capa(uv(SITIO, 1000)), "Cruz Verde");
    const [c] = compararPrediccionVsReal(pred, [
      { idFarmacia: "p", ventaAntesCLP: 100, ventaDespuesCLP: 80 },
      { idFarmacia: "otra", ventaAntesCLP: 100, ventaDespuesCLP: 50 },
    ]);
    expect(c.pctReal).toBeCloseTo(0.2);
    expect(c.errorPuntos).toBeCloseTo((c.pctPredicho - 0.2) * 100);
  });
});
