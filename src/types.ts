// === FARMACIAS ===

export interface Farmacia {
  id: string;
  nombre: string;
  cadena: CadenaFarmaceutica;
  /** Segmento de retail. Siempre presente: el maestro lo garantiza. */
  tipo: SegmentoLocal;
  /** Modelo de tienda. Una perfumería vende farma, pero no es sustituto directo. */
  formato: FormatoLocal;
  direccion: string;
  comuna: string;
  /** CUT del INE — llave de join con el censo. Nulo si la coord cae fuera de comuna. */
  cod_comuna?: number;
  region: string;
  lat: number;
  lon: number;
  /** Modalidad declarada en MINSAL (Privada, Turno, Municipal…). Vacía en cadenas. */
  modalidad?: string;
  telefono?: string;
  horario?: string;
  /** Mes del corte al que pertenece el dato, en ISO 'AAAA-MM'. */
  fecha_corte?: string;
}

/**
 * Cómo compite el local. Una cadena pelea con logística y precio nacional; una
 * independiente, por barrio. 'otra' agrupa lo no comercial (municipal, hospital,
 * veterinaria), que no debe contaminar el análisis de retail privado.
 */
export type SegmentoLocal = "cadena" | "independiente" | "otra";

export type FormatoLocal = "farmacia" | "perfumeria";

/**
 * Las 13 marcas del maestro. Ecofarmacia y La Rebaja tienen scraper propio pero
 * operan como independientes: conservan su marca acá y su `tipo` las clasifica.
 */
export type CadenaFarmaceutica =
  | "Cruz Verde"
  | "Salcobrand"
  | "Ahumada"
  | "Dr. Simi"
  | "Maicao"
  | "Preunic"
  | "Liquimax"
  | "Knop"
  | "Redfarma"
  | "Ecofarmacia"
  | "La Rebaja"
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

/**
 * Una fila de `movimientos.csv` (salida de diff_maestro.py, apilada por
 * scripts/exportar_movimientos_app.py). `mes_deteccion` es el corte en que el
 * id apareció o desapareció del registro — detección, no fecha de inauguración.
 */
export interface MovimientoFarmacia {
  id: string;
  movimiento: "apertura" | "cierre";
  mes_deteccion: string; // AAAA-MM
  nombre: string;
  cadena: CadenaFarmaceutica;
  tipo: SegmentoLocal;
  formato: FormatoLocal;
  direccion: string;
  comuna: string;
  region: string;
  lat: number;
  lon: number;
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
