import { useState, useEffect } from "react";
import Papa from "papaparse";
import { Farmacia, CadenaFarmaceutica, FormatoLocal, SegmentoLocal } from "../types";
import farmaciasRaw from "../data/farmacias.csv?raw";

interface UseFarmaciasResult {
  farmacias: Farmacia[];
  loading: boolean;
  error: string | null;
}

export function useFarmacias(): UseFarmaciasResult {
  const [farmacias, setFarmacias] = useState<Farmacia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const result = Papa.parse<Record<string, string>>(farmaciasRaw, {
        header: true,
        skipEmptyLines: true,
      });

      const parsed: Farmacia[] = result.data
        .filter((row) => row.lat && row.lon)
        .map((row) => ({
          id: row.id?.trim() ?? "",
          nombre: row.nombre?.trim() ?? "",
          cadena: (row.cadena?.trim() as CadenaFarmaceutica) ?? "Otra",
          direccion: row.direccion?.trim() ?? "",
          comuna: row.comuna?.trim() ?? "",
          region: row.region?.trim() ?? "",
          lat: parseFloat(row.lat),
          lon: parseFloat(row.lon),
          // El maestro garantiza que `tipo` viene siempre; el fallback existe
          // solo por si alguien carga un CSV viejo sin la columna.
          tipo: (row.tipo?.trim() as SegmentoLocal) || "independiente",
          formato: (row.formato?.trim() as FormatoLocal) || "farmacia",
          cod_comuna: row.cod_comuna ? Number(row.cod_comuna) : undefined,
          modalidad: row.modalidad?.trim() || undefined,
          telefono: row.telefono?.trim() || undefined,
          horario: row.horario?.trim() || undefined,
          fecha_corte: row.fecha_corte?.trim() || undefined,
        }));

      setFarmacias(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al parsear farmacias");
    } finally {
      setLoading(false);
    }
  }, []);

  return { farmacias, loading, error };
}
