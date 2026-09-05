// === FARMACIAS ===

export interface Farmacia {
  id: string;
  nombre: string;
  cadena: CadenaFarmaceutica;
  direccion: string;
  comuna: string;
  region: string;
  lat: number;
  lon: number;
  tipo: string;
  telefono?: string;
  horario?: string;
  fecha_registro?: string;
}

export type CadenaFarmaceutica =
  | "Cruz Verde"
  | "Salcobrand"
  | "Ahumada"
  | "Dr. Simi"
  | "Maicao"
  | "Knop"
  | "Redfarma"
  | "Independiente"
  | "Otra";

// === DEMOGRAFÍA ===

export interface DatosDemograficos {
  zona_censal: string;
  manzana: string;
  poblacion: number;
  hogares: number;
  nse_abc1: number;
  nse_c2: number;
  nse_c3: number;
  nse_d: number;
  nse_e: number;
  ingreso_promedio: number;
}

// === APERTURAS / CIERRES ===

export interface MovimientoFarmacia {
  id: string;
  nombre: string;
  cadena: CadenaFarmaceutica;
  comuna: string;
  region: string;
  lat: number;
  lon: number;
  tipo_movimiento: "apertura" | "cierre";
  fecha_deteccion: string;
}

// === VENTAS ===

export interface VentasCadena {
  cadena: CadenaFarmaceutica;
  periodo: string; // "2026-01", "2026-02", etc.
  monto: number;
  unidades?: number;
}

// === FILTROS ===

export interface FiltrosActivos {
  cadenas: CadenaFarmaceutica[];
  regiones: string[];
  comunas: string[];
  zonas: string[]; // IDs de zonas geográficas del cliente
}

// === ZONAS GEOGRÁFICAS (GeoJSON) ===

export interface ZonaGeografica {
  type: "Feature";
  properties: {
    id: string;
    nombre: string;
    [key: string]: unknown;
  };
  geometry: GeoJSON.Geometry;
}

// === KPIs ===

export interface KPIs {
  total_farmacias: number;
  aperturas_mes: number;
  cierres_mes: number;
  farmacias_por_cadena: Record<CadenaFarmaceutica, number>;
  poblacion_zona: number;
  distribucion_nse: {
    abc1: number;
    c2: number;
    c3: number;
    d: number;
    e: number;
  };
}
