import { useState, useEffect } from "react";
import Papa from "papaparse";
import { Farmacia, CadenaFarmaceutica } from "../types";
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
          tipo: row.tipo?.trim() ?? "",
          telefono: row.telefono?.trim() || undefined,
          horario: row.horario?.trim() || undefined,
          fecha_registro: row.fecha_registro?.trim() || undefined,
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
