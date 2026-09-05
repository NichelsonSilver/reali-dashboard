// Geocodificación de direcciones en Chile vía Nominatim (OpenStreetMap).
// Gratis y sin API key; la política de uso pide máximo 1 request/segundo
// e identificar la aplicación — suficiente para evaluación puntual de sitios.

export interface ResultadoGeocode {
  lat: number;
  lon: number;
  displayName: string; // dirección normalizada que entiende OSM
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export async function geocodificar(direccion: string): Promise<ResultadoGeocode[]> {
  const params = new URLSearchParams({
    q: direccion,
    countrycodes: "cl",
    format: "jsonv2",
    limit: "5",
    "accept-language": "es",
  });
  const resp = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) throw new Error(`Nominatim respondió ${resp.status}`);
  const data: Array<{ lat: string; lon: string; display_name: string }> = await resp.json();
  return data.map((d) => ({
    lat: parseFloat(d.lat),
    lon: parseFloat(d.lon),
    displayName: d.display_name,
  }));
}
