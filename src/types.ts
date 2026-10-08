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
  /**
   * El punto no cae en la comuna declarada y Google tampoco lo ubicó ahí. Se
   * cuenta, pero no se dibuja ni entra al motor territorial (utils/coordenadas).
   */
  coord_dudosa?: boolean;
  /**
   * activa | cerrada_temporal. Temporal = #close de MINSAL, cerrada en el
   * registro o ausente de la fuente hace < 3 meses: se dibuja y se cuenta,
   * marcada. A los 3 meses pasa a cerrada y deja de publicarse.
   */
  estado?: EstadoLocal;
  /** Corte 'AAAA-MM' desde el que está cerrada temporalmente. */
  cerrada_desde?: string;
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

export type EstadoLocal = "activa" | "cerrada_temporal";

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

/**
 * Una fila de `demografia_censo.csv`: Censo 2024 agregado por comuna, nacional
 * (scripts/agregar_censo.py). El NSE no vive acá: por comuna es el GSE AIM
 * (`GseComuna`, useGseAim) y por unidad vecinal la capa estimada (`PropsUV`).
 */
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
  hogares: number; // jefes de hogar del censo: pondera el GSE AIM entre comunas
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
  cadena: CadenaFarmaceutica;
  tipo: SegmentoLocal;
  formato: FormatoLocal;
  nombre: string;
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
