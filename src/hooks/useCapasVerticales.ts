import { useEffect, useState } from "react";
import Papa from "papaparse";
import {
  Bencinera, EstadoLocal, FormatoBencinera, FormatoConveniencia,
  MarcaConveniencia, SegmentoBencinera, TiendaConveniencia,
} from "../types";

// Las capas de bencineras y conveniencia se piden recién al encenderlas: el
// import dinámico de `?raw` deja cada CSV en su propio chunk, fuera del bundle
// que carga la página. Una promesa por capa: encender y apagar no re-descarga.
const CARGAS = {
  bencineras: () => import("../data/bencineras.csv?raw").then((m) => m.default),
  conveniencia: () => import("../data/conveniencia.csv?raw").then((m) => m.default),
};
type Capa = keyof typeof CARGAS;
const cache = new Map<Capa, Promise<string>>();

type Fila = Record<string, string>;

const texto = (v?: string) => v?.trim() || undefined;
// lat/lon vacíos quedan en NaN: el local se cuenta, la capa no lo dibuja.
const num = (v?: string) => (v?.trim() ? Number(v) : NaN);
const estado = (v?: string): EstadoLocal => (v?.trim() === "cerrada_temporal" ? "cerrada_temporal" : "activa");

function base(row: Fila) {
  return {
    id: row.id?.trim() ?? "",
    nombre: row.nombre?.trim() ?? "",
    direccion: row.direccion?.trim() ?? "",
    comuna: row.comuna?.trim() ?? "",
    cod_comuna: row.cod_comuna ? Number(row.cod_comuna) : undefined,
    region: row.region?.trim() ?? "",
    lat: num(row.lat),
    lon: num(row.lon),
    coord_dudosa: row.coord_dudosa?.trim() === "1",
    estado: estado(row.estado),
    cerrada_desde: texto(row.cerrada_desde),
    fecha_corte: texto(row.fecha_corte),
  };
}

const PARSERS = {
  bencineras: (row: Fila): Bencinera => ({
    ...base(row),
    cadena: row.cadena?.trim() ?? "",
    tipo: row.tipo?.trim() as SegmentoBencinera,
    formato: row.formato?.trim() as FormatoBencinera,
    combustibles: texto(row.combustibles),
    atencion: texto(row.atencion),
    electrolinera: row.electrolinera?.trim() === "1",
  }),
  conveniencia: (row: Fila): TiendaConveniencia => ({
    ...base(row),
    cadena: row.cadena?.trim() as MarcaConveniencia,
    formato: row.formato?.trim() as FormatoConveniencia,
    tipologia: texto(row.tipologia),
    id_estacion_cne: texto(row.id_estacion_cne),
    servicios: texto(row.servicios),
    fecha_dato: texto(row.fecha_dato),
  }),
};

function useCapa<T>(capa: Capa, activa: boolean, parse: (r: Fila) => T) {
  const [datos, setDatos] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activa || datos) return;
    let cancelado = false;
    if (!cache.has(capa)) cache.set(capa, CARGAS[capa]());
    setLoading(true);
    cache.get(capa)!
      .then((raw) => {
        const { data } = Papa.parse<Fila>(raw, { header: true, skipEmptyLines: true });
        if (!cancelado) setDatos(data.map(parse));
      })
      .catch((e) => { if (!cancelado) setError(e instanceof Error ? e.message : `Error al cargar ${capa}`); })
      .finally(() => { if (!cancelado) setLoading(false); });
    return () => { cancelado = true; };
  }, [capa, activa, datos, parse]);

  return { datos, loading, error };
}

export function useBencineras(activa: boolean) {
  return useCapa("bencineras", activa, PARSERS.bencineras);
}

export function useConveniencia(activa: boolean) {
  return useCapa("conveniencia", activa, PARSERS.conveniencia);
}
