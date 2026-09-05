import { useEffect, useState } from "react";
import type { FeatureCollection, Polygon, MultiPolygon } from "geojson";

// Propiedades de cada manzana (ver scripts/exportar_manzanas_rm.py)
export interface ManzanaProps {
  id: string;
  cut: number;
  comuna: string;
  pob: number;   // total personas
  hom: number;   // total hombres
  muj: number;   // total mujeres
  viv: number;   // total viviendas
  hog: number;   // cantidad hogares
}

export type Manzanas = FeatureCollection<Polygon | MultiPolygon, ManzanaProps>;

// Cache en memoria por URL — una sola descarga por sesión aunque el toggle se active varias veces.
const cache = new Map<string, Promise<unknown>>();

function fetchCached<T>(url: string): Promise<T> {
  if (!cache.has(url)) {
    cache.set(url, fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url}: ${r.status}`);
      return r.json();
    }));
  }
  return cache.get(url) as Promise<T>;
}

// Lazy: solo descarga cuando `enabled` pasa a true. Ignora la respuesta si se desmonta.
export function useLazyGeoJSON<T>(url: string, enabled: boolean) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || data) return;
    let cancelled = false;
    setLoading(true);
    fetchCached<T>(url)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url, enabled, data]);

  return { data, loading, error };
}

export function useManzanasRM(enabled: boolean) {
  return useLazyGeoJSON<Manzanas>("/data/manzanas_rm.geojson", enabled);
}

// Unidades vecinales con NSE (ver scripts/generar_nse_uv.py)
export function useCapaNSE(enabled: boolean) {
  return useLazyGeoJSON<import("../utils/territorio").CapaNSE>("/data/nse_uv.geojson", enabled);
}
