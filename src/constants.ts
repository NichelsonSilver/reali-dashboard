import { CadenaFarmaceutica, FormatoLocal, SegmentoLocal } from "./types";

// Las 13 marcas del maestro, en orden de tamaño de red. Tiene que coincidir con
// CLASIFICACION en SCRAPER/MINSAL_scraper/maestro_farmacias.py: si el maestro
// emite una marca que no está acá, el filtro la pierde.
export const CADENAS: CadenaFarmaceutica[] = [
  "Cruz Verde",
  "Salcobrand",
  "Ahumada",
  "Dr. Simi",
  "Maicao",
  "Preunic",
  "Liquimax",
  "Knop",
  "Redfarma",
  "Ecofarmacia",
  "La Rebaja",
  "Independiente",
  "Otra",
];

export const SEGMENTOS: { valor: SegmentoLocal; label: string }[] = [
  { valor: "cadena",        label: "Cadena" },
  { valor: "independiente", label: "Independiente" },
  { valor: "otra",          label: "Institucional / otra" },
];

export const ETIQUETA_SEGMENTO: Record<SegmentoLocal, string> =
  Object.fromEntries(SEGMENTOS.map((s) => [s.valor, s.label])) as Record<SegmentoLocal, string>;

// Maicao, Preunic y Liquimax son perfumerías: venden farma dentro de una tienda
// de belleza. Comparten flujo con una farmacia pero no son sustituto directo —
// contarlas como competencia plena infla el entorno de un sitio.
export const FORMATOS: { valor: FormatoLocal; label: string }[] = [
  { valor: "farmacia",   label: "Farmacia" },
  { valor: "perfumeria", label: "Perfumería" },
];

// Logos en public/logos/ (undefined → se renderiza círculo de color de fallback)
export const LOGO_CADENA: Partial<Record<CadenaFarmaceutica, string>> = {
  "Cruz Verde": "/logos/CruzVerde.png",
  "Salcobrand": "/logos/Salcobrand.png",
  "Ahumada":    "/logos/Ahumada.png",
  "Dr. Simi":   "/logos/DrSimi.png",
  "Maicao":     "/logos/Maicao.png",
  "Knop":       "/logos/Knop.png",
  "Redfarma":   "/logos/Redfarma.png",
};

export const COLORES_CADENA: Record<CadenaFarmaceutica, string> = {
  "Cruz Verde": "#00A651",
  "Salcobrand": "#0055A5",
  "Ahumada": "#E31937",
  "Dr. Simi": "#b45309",
  "Maicao": "#7c3aed",
  "Knop": "#1C7521",
  "Redfarma": "#7605E5",
  "Preunic": "#D6006F",
  "Liquimax": "#0EA5E9",
  "Ecofarmacia": "#65A30D",
  "La Rebaja": "#EA580C",
  "Independiente": "#92400e",
  "Otra": "#64748b",
};

export const REGIONES_CHILE = [
  "Arica y Parinacota",
  "Tarapacá",
  "Antofagasta",
  "Atacama",
  "Coquimbo",
  "Valparaíso",
  "Metropolitana",
  "O'Higgins",
  "Maule",
  "Ñuble",
  "Biobío",
  "La Araucanía",
  "Los Ríos",
  "Los Lagos",
  "Aysén",
  "Magallanes",
];

export const NSE_LABELS: Record<string, string> = {
  abc1: "ABC1",
  c2: "C2",
  c3: "C3",
  d: "D",
  e: "E",
};

export const NSE_COLORES: Record<string, string> = {
  abc1: "#2563eb",
  c2: "#7c3aed",
  c3: "#f59e0b",
  d: "#ef4444",
  e: "#6b7280",
};

export const MAP_CENTER: [number, number] = [-33.4489, -70.6693];
export const MAP_ZOOM = 11;

// Destinatario de reportes de pines mal ubicados. Ajustar según cliente.
export const EMAIL_REPORTES = "soporte@realidata.cl";

export const MESES_CORTO = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
