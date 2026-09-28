import { useMemo } from "react";
import Papa from "papaparse";
import gseRaw from "../data/gse_aim_comuna.csv?raw";
import { GRUPOS_NSE, GseComuna } from "../utils/territorio";

// GSE oficial de AIM Chile por comuna (% de hogares por grupo), generado por
// scripts/exportar_gse_aim.py desde el Excel "Perfiles por Regiones y Comunas
// GSE AIM 2023" (Casen 2017 + 2022). Es el dato publicado, no una estimación
// nuestra: para cifras por comuna manda sobre la capa nse_uv.geojson.

export function useGseAim(): Map<number, GseComuna> {
  return useMemo(() => {
    const { data } = Papa.parse<Record<string, string>>(gseRaw, { header: true, skipEmptyLines: true });
    const mapa = new Map<number, GseComuna>();
    for (const row of data) {
      const cut = Number(row.cod_comuna);
      if (!cut) continue;
      mapa.set(cut, Object.fromEntries(GRUPOS_NSE.map((g) => [g, Number(row[g])])) as GseComuna);
    }
    return mapa;
  }, []);
}
