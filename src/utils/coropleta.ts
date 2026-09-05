// Utilidad para colorear manzanas según una variable numérica.
// La función colorParaValor recibe un valor crudo (ej. población de una manzana)
// y la clave de variable, y devuelve un color hex.

export type VariableCoropleta = "pob" | "viv" | "hog";

export const ETIQUETA_VARIABLE: Record<VariableCoropleta, string> = {
  pob: "Población",
  viv: "Viviendas",
  hog: "Hogares",
};

// Paleta secuencial azul (CartoColor "BluYl" simplificada), orden: bajo → alto.
export const PALETA: string[] = [
  "#edf8fb",
  "#b3cde3",
  "#8c96c6",
  "#8856a7",
  "#810f7c",
];

// Cortes por cuantiles precomputados con Python sobre las 48k manzanas RM.
// (p20, p40, p60, p80). Valores < primer corte usan PALETA[0],
// valores ≥ último corte usan PALETA[4].
export const CORTES: Record<VariableCoropleta, number[]> = {
  pob: [40, 90, 150, 250],
  viv: [15, 30, 50, 85],
  hog: [12, 26, 44, 75],
};

/**
 * Devuelve el color hex de la paleta para un valor dado.
 *
 * Estrategia elegida: clasificación por **cuantiles fijos** (precomputados).
 * Ventajas: cada bucket tiene aproximadamente la misma cantidad de manzanas,
 * así que el mapa usa los 5 colores de forma balanceada aunque la distribución
 * esté sesgada (cola larga típica de densidades urbanas).
 *
 * Retorna "#f1f5f9" (gris claro) para manzanas sin datos (valor <= 0).
 */
export function colorParaValor(valor: number, variable: VariableCoropleta): string {
  if (valor <= 0) return "#f1f5f9";
  const cortes = CORTES[variable];
  for (let i = 0; i < cortes.length; i++) {
    if (valor < cortes[i]) return PALETA[i];
  }
  return PALETA[PALETA.length - 1];
}
