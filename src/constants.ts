import { CadenaFarmaceutica } from "./types";

export const CADENAS: CadenaFarmaceutica[] = [
  "Cruz Verde",
  "Salcobrand",
  "Ahumada",
  "Dr. Simi",
  "Maicao",
  "Knop",
  "Redfarma",
  "Independiente",
  "Otra",
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

// ── Mock data for Movimientos page ──────────────────────────────────────────

interface ItemMovimiento { n: string; c: string; }
interface MesMovimiento { mes: number; ap: ItemMovimiento[]; ci: ItemMovimiento[]; }

// ⚠️ DATOS FICTICIOS — NO SON REGISTROS REALES.
// Aperturas y cierres INVENTADOS con fines de demostración de la UI. Los
// nombres de local no corresponden a establecimientos existentes y no deben
// citarse como información sobre Cruz Verde, Salcobrand ni ninguna otra
// cadena. Se reemplazan por la salida real de diff_aperturas.py en cuanto
// existan dos snapshots MINSAL consecutivos.
export const MOCK_MOVIMIENTOS: Record<string, Record<number, MesMovimiento[]>> = {
  "Cruz Verde": { 2026: [
    { mes:0, ap:[{n:"Cruz Verde Mall Alto Las Condes",c:"Las Condes"},{n:"Cruz Verde Huertos Familiares",c:"Maipú"}], ci:[{n:"Cruz Verde Viejo Alerce",c:"Puerto Montt"}] },
    { mes:1, ap:[{n:"Cruz Verde Barrio Lastarria",c:"Santiago"}], ci:[] },
    { mes:2, ap:[], ci:[{n:"Cruz Verde Los Domínicos",c:"Las Condes"}] },
    { mes:3, ap:[], ci:[{n:"Cruz Verde San Bernardo Norte",c:"San Bernardo"},{n:"Cruz Verde Estación Central",c:"Estación Central"}] },
    ...Array(8).fill(null).map((_,i) => ({ mes:i+4, ap:[], ci:[] })),
  ]},
  "Salcobrand": { 2026: [
    { mes:0, ap:[{n:"Salcobrand Costanera Center",c:"Providencia"},{n:"Salcobrand Portal La Dehesa",c:"Lo Barnechea"}], ci:[{n:"Salcobrand Mapocho",c:"Santiago"}] },
    { mes:1, ap:[{n:"Salcobrand Mall Plaza Egaña",c:"Ñuñoa"}], ci:[{n:"Salcobrand Parque O'Higgins",c:"Santiago"}] },
    { mes:2, ap:[{n:"Salcobrand La Reina",c:"La Reina"}], ci:[] },
    { mes:3, ap:[], ci:[] },
    ...Array(8).fill(null).map((_,i) => ({ mes:i+4, ap:[], ci:[] })),
  ]},
  "Ahumada": { 2026: [
    { mes:0, ap:[{n:"Ahumada Mall Vivo Maipú",c:"Maipú"}], ci:[] },
    { mes:1, ap:[], ci:[{n:"Ahumada San Pablo",c:"Santiago"}] },
    { mes:2, ap:[{n:"Ahumada Portal Bicentenario",c:"Quilicura"}], ci:[] },
    { mes:3, ap:[{n:"Ahumada La Reina",c:"La Reina"}], ci:[{n:"Ahumada Santa Anita",c:"Lo Espejo"}] },
    ...Array(8).fill(null).map((_,i) => ({ mes:i+4, ap:[], ci:[] })),
  ]},
};

// ── Mock data for Cadenas page ───────────────────────────────────────────────

interface ItemZona { n: string; c: string; f: string; }

export const MOCK_ZONAS: Record<string, Record<string, ItemZona[]>> = {
  "Norte": {
    "Ahumada": [{n:"Ahumada Iquique Mall",c:"Iquique",f:"ENE 2026"},{n:"Ahumada Antofagasta 2",c:"Antofagasta",f:"FEB 2026"}],
    "Salcobrand": [{n:"Salcobrand Arica",c:"Arica",f:"ENE 2026"}],
    "Cruz Verde": [{n:"Cruz Verde Calama",c:"Calama",f:"MAR 2026"}],
  },
  "V Región": {
    "Ahumada": [{n:"Ahumada Viña del Mar 2",c:"Viña del Mar",f:"ENE 2026"},{n:"Ahumada Valparaíso Centro",c:"Valparaíso",f:"FEB 2026"}],
    "Salcobrand": [{n:"Salcobrand Quilpué",c:"Quilpué",f:"FEB 2026"}],
    "Cruz Verde": [],
  },
  "RM": {
    "Ahumada": [{n:"Ahumada Mall Vivo Maipú",c:"Maipú",f:"ENE 2026"}],
    "Salcobrand": [
      {n:"Salcobrand Costanera Center",c:"Providencia",f:"ENE 2026"},
      {n:"Salcobrand Portal La Dehesa",c:"Lo Barnechea",f:"ENE 2026"},
      {n:"Salcobrand Mall Plaza Egaña",c:"Ñuñoa",f:"FEB 2026"},
      {n:"Salcobrand La Reina",c:"La Reina",f:"MAR 2026"},
    ],
    "Cruz Verde": [
      {n:"Cruz Verde Mall Alto Las Condes",c:"Las Condes",f:"ENE 2026"},
      {n:"Cruz Verde Huertos Familiares",c:"Maipú",f:"ENE 2026"},
    ],
  },
  "Sur": {
    "Ahumada": [{n:"Ahumada Portal Bicentenario",c:"Quilicura",f:"MAR 2026"},{n:"Ahumada La Reina",c:"La Reina",f:"ABR 2026"}],
    "Salcobrand": [{n:"Salcobrand Concepción 2",c:"Concepción",f:"ENE 2026"}],
    "Cruz Verde": [{n:"Cruz Verde Temuco 2",c:"Temuco",f:"FEB 2026"},{n:"Cruz Verde Puerto Montt",c:"Puerto Montt",f:"MAR 2026"}],
  },
};
