import { useState, useEffect } from "react";
import Papa from "papaparse";
import demografiaRaw from "../data/demografia_censo.csv?raw";

// Demografía agregada por comuna (generada por scripts/agregar_censo.py)
export interface DemografiaCenso {
  cod_comuna: string;
  nombre_comuna: string;
  region: string;
  poblacion: number;
  hombres: number;
  mujeres: number;
  edad_0_14: number;
  edad_15_29: number;
  edad_30_44: number;
  edad_45_59: number;
  edad_60_mas: number;
  escolaridad_promedio: number;
}

interface UseDemografiaResult {
  datos: DemografiaCenso[];
  loading: boolean;
  error: string | null;
}

export function useDemografia(): UseDemografiaResult {
  const [datos, setDatos] = useState<DemografiaCenso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const result = Papa.parse<Record<string, string>>(demografiaRaw, {
        header: true,
        skipEmptyLines: true,
      });

      const parsed: DemografiaCenso[] = result.data.map((row) => ({
        cod_comuna: row.cod_comuna?.trim() ?? "",
        nombre_comuna: row.nombre_comuna?.trim() ?? "",
        region: row.region?.trim() ?? "",
        poblacion: parseInt(row.poblacion) || 0,
        hombres: parseInt(row.hombres) || 0,
        mujeres: parseInt(row.mujeres) || 0,
        edad_0_14: parseInt(row.edad_0_14) || 0,
        edad_15_29: parseInt(row.edad_15_29) || 0,
        edad_30_44: parseInt(row.edad_30_44) || 0,
        edad_45_59: parseInt(row.edad_45_59) || 0,
        edad_60_mas: parseInt(row.edad_60_mas) || 0,
        escolaridad_promedio: parseFloat(row.escolaridad_promedio) || 0,
      }));

      setDatos(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al parsear demografía");
    } finally {
      setLoading(false);
    }
  }, []);

  return { datos, loading, error };
}
