import { useMemo } from "react";
import Papa from "papaparse";
import { MovimientoFarmacia, CadenaFarmaceutica, FormatoLocal, SegmentoLocal } from "../types";
import movimientosRaw from "../data/movimientos.csv?raw";

// Se parsea una vez por módulo: el CSV viene en el bundle y no cambia en runtime.
function parsear(): MovimientoFarmacia[] {
  const result = Papa.parse<Record<string, string>>(movimientosRaw, {
    header: true,
    skipEmptyLines: true,
  });
  return result.data
    .filter((row) => row.movimiento === "apertura" || row.movimiento === "cierre")
    .map((row) => ({
      id: row.id?.trim() ?? "",
      movimiento: row.movimiento as MovimientoFarmacia["movimiento"],
      mes_deteccion: row.mes_deteccion?.trim() ?? "",
      nombre: row.nombre?.trim() ?? "",
      cadena: (row.cadena?.trim() as CadenaFarmaceutica) || "Otra",
      tipo: (row.tipo?.trim() as SegmentoLocal) || "independiente",
      formato: (row.formato?.trim() as FormatoLocal) || "farmacia",
      direccion: row.direccion?.trim().replace(/,\s*$/, "") ?? "",
      comuna: row.comuna?.trim() ?? "",
      region: row.region?.trim() ?? "",
      lat: parseFloat(row.lat),
      lon: parseFloat(row.lon),
    }));
}

let cache: MovimientoFarmacia[] | null = null;

export function useMovimientos(): MovimientoFarmacia[] {
  return useMemo(() => (cache ??= parsear()), []);
}
