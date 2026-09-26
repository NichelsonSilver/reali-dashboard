import { useState, useMemo, useEffect, useRef } from "react";
import { Farmacia, CadenaFarmaceutica, MovimientoFarmacia } from "../types";
import { DemografiaCenso } from "../hooks/useDemografia";
import { useMovimientos } from "../hooks/useMovimientos";
import { useCapaNSE } from "../hooks/useGeoCapas";
import { GRUPOS_NSE, GrupoNSE } from "../utils/territorio";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { MapContainer, TileLayer, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import { CADENAS, COLORES_CADENA, COLOR_NSE, TILES } from "../constants";

// Tokens de marca REALI + semánticos data viz (diseño/paleta.md)
const C = {
  bg: "#F4F1EA", bgCard: "#FDFCFA", border: "#E3DFD3",
  text: "#0B1A2E", text2: "#3E4A61", text3: "#5D6880",
  accent: "#F5A524", accentStrong: "#C98410", accentText: "#9A6206",
  green: "#2D8A6B", red: "#C13B3B",
};

const GENDER_COLORS = ["#ec4899", "#3b82f6"];

const tarjeta: React.CSSProperties = {
  background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
};
const etiquetaKPI: React.CSSProperties = { fontSize: 11, color: C.text3, fontWeight: 600, textTransform: "uppercase" };
const nota: React.CSSProperties = { fontSize: 10, color: C.text3, marginTop: 8, lineHeight: 1.4 };

interface Props {
  farmacias: Farmacia[];
  demografia: DemografiaCenso[];
}

function IIconPop() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function IIconPharma() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2z"/><path d="M3 19a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z"/><path d="M12 3v13"/></svg>; }
function IIconMap() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>; }

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
  if (percent < 0.04) return null; // rebanadas mínimas: la etiqueta se monta sobre la vecina
  const radius = innerRadius + (outerRadius - innerRadius) * 1.35; // más afuera se corta en tarjetas angostas
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill={C.text2} textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize={10} fontWeight={600}>
      {`${name} ${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const CustomBarLabel = ({ x, y, width, height, value, payload, insideColor = "#fff", outsideColor = C.text2 }: any) => {
  if (width < 25) {
    return <text x={x + width + 5} y={y + height / 2} fill={outsideColor} textAnchor="start" dominantBaseline="central" fontSize={10}>{value}</text>;
  }
  return (
    <g>
      {payload?.percent !== undefined && (
        <text x={x + width - 5} y={y + height / 2} fill={insideColor} textAnchor="end" dominantBaseline="central" fontSize={10} fontWeight={600}>
          {`${payload.percent}%`}
        </text>
      )}
      <text x={x + width + 5} y={y + height / 2} fill={outsideColor} textAnchor="start" dominantBaseline="central" fontSize={10} fontWeight={600}>
        {value}
      </text>
    </g>
  );
};

function MapAutoZoom({ farmacias }: { farmacias: Farmacia[] }) {
  const map = useMap();
  useEffect(() => {
    if (farmacias.length === 0) return;
    const bounds = L.latLngBounds(farmacias.map(f => [f.lat, f.lon] as [number, number]));
    if (bounds.isValid()) map.flyToBounds(bounds, { padding: [20, 20], maxZoom: 14, duration: 1.5 });
  }, [farmacias, map]);
  return null;
}

function MultiSelectCadenas({ opciones, selected, onChange }: {
  opciones: CadenaFarmaceutica[]; selected: CadenaFarmaceutica[]; onChange: (s: CadenaFarmaceutica[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const toggle = (val: CadenaFarmaceutica) => {
    if (selected.includes(val)) onChange(selected.filter(x => x !== val));
    else onChange([...selected, val]);
  };

  return (
    <div style={{ position: "relative" }} ref={containerRef}>
      <button onClick={() => setOpen(!open)} style={{ fontSize: 10, border: `1px solid ${C.border}`, borderRadius: 4, padding: "4px 8px", background: C.bgCard, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: C.text2, fontWeight: 500 }}>
        Marcas ({opciones.filter(o => selected.includes(o)).length}/{opciones.length}) <span style={{ fontSize: 8 }}>▼</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 6, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 500, width: 160, padding: 6, display: "flex", flexDirection: "column", gap: 4 }}>
          {opciones.map(c => (
            <label key={c} style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "4px", borderRadius: 4, background: selected.includes(c) ? "rgba(245,165,36,0.10)" : "transparent" }}>
              <input type="checkbox" checked={selected.includes(c)} onChange={() => toggle(c)} style={{ cursor: "pointer" }} />
              <span style={{ width: 8, height: 8, borderRadius: 2, background: COLORES_CADENA[c] }} />
              <span style={{ color: C.text2, fontWeight: selected.includes(c) ? 600 : 400 }}>{c}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);

export interface FilaNeto {
  cadena: CadenaFarmaceutica;
  aperturas: number;
  cierres: number;
  neto: number;
}

// No son una marca comparable con una cadena: van relegadas, igual que en PageMovimientos.
const RELEGADAS = new Set<CadenaFarmaceutica>(["Independiente", "Otra"]);
const MIN_FILAS = 4;

/**
 * Resume los movimientos de UN corte en una fila por marca, ordenada por
 * actividad (aperturas + cierres): una marca con +5/−5 neta 0, pero es la que
 * más rota y tiene que verse arriba. Desempate: neto, luego nombre.
 * Recibe los movimientos ya filtrados por comuna, marca y mes.
 */
export function netoPorCadena(movs: MovimientoFarmacia[]): FilaNeto[] {
  const porCadena = new Map<CadenaFarmaceutica, FilaNeto>();
  for (const m of movs) {
    const fila = porCadena.get(m.cadena) ?? { cadena: m.cadena, aperturas: 0, cierres: 0, neto: 0 };
    if (m.movimiento === "apertura") fila.aperturas++;
    else fila.cierres++;
    fila.neto = fila.aperturas - fila.cierres;
    porCadena.set(m.cadena, fila);
  }
  const actividad = (f: FilaNeto) => f.aperturas + f.cierres;
  return [...porCadena.values()].sort((a, b) =>
    Number(RELEGADAS.has(a.cadena)) - Number(RELEGADAS.has(b.cadena)) ||
    actividad(b) - actividad(a) ||
    b.neto - a.neto ||
    a.cadena.localeCompare(b.cadena, "es"));
}

/**
 * Qué filas se listan: todas las marcas con movimiento; las relegadas solo
 * entran a rellenar hasta MIN_FILAS cuando las marcas no alcanzan.
 */
export function filasVisibles(filas: FilaNeto[]): FilaNeto[] {
  const marcas = filas.filter(f => !RELEGADAS.has(f.cadena));
  const relleno = filas.filter(f => RELEGADAS.has(f.cadena)).slice(0, Math.max(0, MIN_FILAS - marcas.length));
  return [...marcas, ...relleno];
}

export default function PageResumen({ farmacias, demografia }: Props) {
  const movimientos = useMovimientos();
  const { data: capaNSE } = useCapaNSE(true);

  // Comunas del dataset cargado, con su CUT. El censo es nacional pero la base de
  // farmacias puede ser una muestra: el universo lo define lo que hay en farmacias.
  const comunas = useMemo(() => {
    const m = new Map<number, string>();
    for (const f of farmacias) if (f.cod_comuna) m.set(f.cod_comuna, f.comuna);
    return [...m.entries()].map(([cut, nombre]) => ({ cut, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [farmacias]);

  const [cutFiltro, setCutFiltro] = useState<number | null>(null);
  const marcasPresentes = useMemo(() => {
    const s = new Set(farmacias.map(f => f.cadena));
    return CADENAS.filter(c => s.has(c));
  }, [farmacias]);
  const [cadenasFiltro, setCadenasFiltro] = useState<CadenaFarmaceutica[]>(CADENAS);

  const cutsActivos = useMemo(
    () => new Set(cutFiltro != null ? [cutFiltro] : comunas.map(c => c.cut)),
    [cutFiltro, comunas],
  );
  const nombresActivos = useMemo(
    () => new Set(comunas.filter(c => cutsActivos.has(c.cut)).map(c => c.nombre)),
    [comunas, cutsActivos],
  );

  const fComuna = useMemo(
    () => farmacias.filter(f => f.cod_comuna != null && cutsActivos.has(f.cod_comuna)),
    [farmacias, cutsActivos],
  );
  const fMarca = useMemo(() => fComuna.filter(f => cadenasFiltro.includes(f.cadena)), [fComuna, cadenasFiltro]);
  const dComuna = useMemo(() => demografia.filter(d => cutsActivos.has(Number(d.cod_comuna))), [demografia, cutsActivos]);

  // --- DEMOGRÁFICO (Censo 2024, INE) ---
  const demo = useMemo(() => {
    const s = (k: keyof DemografiaCenso) => dComuna.reduce((a, d) => a + (d[k] as number), 0);
    const pob = s("poblacion");
    // Escolaridad es un promedio comunal: se pondera por población, no se promedia plano.
    const escolaridad = pob > 0 ? dComuna.reduce((a, d) => a + d.escolaridad_promedio * d.poblacion, 0) / pob : 0;
    const tramos = [
      { edad: "0-14", n: s("edad_0_14") }, { edad: "15-29", n: s("edad_15_29") }, { edad: "30-44", n: s("edad_30_44") },
      { edad: "45-59", n: s("edad_45_59") }, { edad: "60+", n: s("edad_60_mas") },
    ];
    return {
      pob,
      escolaridad,
      pct60: pct(s("edad_60_mas"), pob),
      genero: [{ name: "Mujeres", value: s("mujeres") }, { name: "Hombres", value: s("hombres") }],
      etaria: tramos.map(t => ({ edad: t.edad, pct: +pct(t.n, pob).toFixed(1) })),
    };
  }, [dComuna]);

  const habPorFarmacia = fComuna.length > 0 && demo.pob > 0 ? Math.round(demo.pob / fComuna.length) : null;

  // --- NSE: hogares por grupo, agregados desde las unidades vecinales ---
  const nse = useMemo(() => {
    if (!capaNSE) return null;
    const hog = Object.fromEntries(GRUPOS_NSE.map(g => [g, 0])) as Record<GrupoNSE, number>;
    for (const f of capaNSE.features) {
      if (cutsActivos.has(Number(f.properties.cut)) && f.properties.nse in hog) hog[f.properties.nse] += f.properties.hog || 0;
    }
    const total = GRUPOS_NSE.reduce((a, g) => a + hog[g], 0);
    return { total, data: GRUPOS_NSE.filter(g => hog[g] > 0).map(g => ({ name: g, value: hog[g] })) };
  }, [capaNSE, cutsActivos]);

  // --- FARMACÉUTICO ---
  const locsPorMarca = useMemo(() => {
    const cuenta = new Map<CadenaFarmaceutica, number>();
    for (const f of fMarca) cuenta.set(f.cadena, (cuenta.get(f.cadena) ?? 0) + 1);
    return [...cuenta.entries()]
      .map(([name, value]) => ({ name, value, percent: Math.round(pct(value, fMarca.length)), fill: COLORES_CADENA[name] }))
      .sort((a, b) => b.value - a.value);
  }, [fMarca]);

  const segmentos = useMemo(() => ({
    cadena: fMarca.filter(f => f.tipo === "cadena").length,
    independiente: fMarca.filter(f => f.tipo === "independiente").length,
    perfumeria: fMarca.filter(f => f.formato === "perfumeria").length,
  }), [fMarca]);

  const corte = farmacias[0]?.fecha_corte ?? "";

  // Movimientos: se muestra el último corte con diff. movimientos.csv no trae CUT,
  // así que se cruza por nombre de comuna tomado del maestro.
  const ultimoMes = useMemo(() => movimientos.reduce((m, x) => (x.mes_deteccion > m ? x.mes_deteccion : m), ""), [movimientos]);
  const movsFiltrados = useMemo(
    () => movimientos.filter(m => m.mes_deteccion === ultimoMes && nombresActivos.has(m.comuna) && cadenasFiltro.includes(m.cadena)),
    [movimientos, ultimoMes, nombresActivos, cadenasFiltro],
  );
  const filasNeto = useMemo(() => netoPorCadena(movsFiltrados), [movsFiltrados]);
  const filasTabla = useMemo(() => filasVisibles(filasNeto), [filasNeto]);
  const ocultas = filasNeto.length - filasTabla.length;
  // El total cuenta todo el corte, también las relegadas que no se listan.
  const totalNeto = filasNeto.reduce(
    (a, r) => ({ aperturas: a.aperturas + r.aperturas, cierres: a.cierres + r.cierres, neto: a.neto + r.neto }),
    { aperturas: 0, cierres: 0, neto: 0 },
  );

  const fmt = (n: number, dec = 0) => n.toLocaleString("es-CL", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const signo = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  const colorNeto = (n: number) => (n > 0 ? C.green : n < 0 ? C.red : C.text3);

  return (
    <div style={{ flex: 1, padding: 24, overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header / Filtro */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0, letterSpacing: "-0.02em" }}>Resumen de Mercado</h2>
          <p style={{ fontSize: 13, color: C.text2, margin: "4px 0 0 0" }}>
            Demografía y oferta farmacéutica de las comunas cargadas{corte && ` · corte ${corte}`}.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.bgCard, padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.text2 }}>Comuna:</span>
          <select
            value={cutFiltro ?? ""}
            onChange={(e) => setCutFiltro(e.target.value ? Number(e.target.value) : null)}
            style={{ fontSize: 12, border: "none", outline: "none", color: C.text, background: "transparent", cursor: "pointer", fontWeight: 500 }}
          >
            <option value="">Todas ({comunas.length})</option>
            {comunas.map(c => <option key={c.cut} value={c.cut}>{c.nombre}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, flex: 1, minHeight: 0 }}>

        {/* Columna 1: Demográfico */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 800, color: C.text, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `3px solid ${C.accent}`, paddingBottom: 8 }}>
            <IIconPop /> Demográfico
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ ...tarjeta, padding: 16 }}>
              <div style={etiquetaKPI}>Población</div>
              <div className="num" style={{ fontSize: 22, fontWeight: 700, color: C.text, marginTop: 4 }}>{fmt(demo.pob)}</div>
            </div>
            <div style={{ ...tarjeta, padding: 16 }}>
              <div style={etiquetaKPI}>Habitantes / farmacia</div>
              <div className="num" style={{ fontSize: 22, fontWeight: 700, color: C.accentStrong, marginTop: 4 }}>
                {habPorFarmacia != null ? fmt(habPorFarmacia) : "s/d"}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ ...tarjeta, padding: 12 }}>
              <div style={etiquetaKPI}>Adultos mayores (60+)</div>
              <div className="num" style={{ fontSize: 17, fontWeight: 700, color: C.text, marginTop: 4 }}>{fmt(demo.pct60, 1)}%</div>
            </div>
            <div style={{ ...tarjeta, padding: 12 }}>
              <div style={etiquetaKPI}>Escolaridad prom.</div>
              <div className="num" style={{ fontSize: 17, fontWeight: 700, color: C.text, marginTop: 4 }}>
                {demo.escolaridad > 0 ? `${fmt(demo.escolaridad, 1)} años` : "s/d"}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, flexShrink: 0 }}>
            <div style={{ ...tarjeta, padding: "12px 4px", display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text, textAlign: "center" }}>NSE (hogares)</div>
              <div style={{ height: 120, width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {nse && nse.total > 0 ? (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={nse.data} innerRadius={25} outerRadius={40} dataKey="value" stroke="none" label={renderCustomizedLabel} labelLine={false} isAnimationActive={false}>
                        {nse.data.map(d => <Cell key={d.name} fill={COLOR_NSE[d.name]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => [`${fmt(v)} hogares`, "NSE"]} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <span style={{ fontSize: 11, color: C.text3 }}>{nse ? "Sin datos NSE" : "Cargando…"}</span>
                )}
              </div>
            </div>
            <div style={{ ...tarjeta, padding: "12px 4px", display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text, textAlign: "center" }}>GÉNERO</div>
              <div style={{ height: 120, width: "100%" }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={demo.genero} innerRadius={25} outerRadius={40} dataKey="value" stroke="none" label={renderCustomizedLabel} labelLine={false} isAnimationActive={false}>
                      {demo.genero.map((_, i) => <Cell key={i} fill={GENDER_COLORS[i]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div style={{ ...tarjeta, padding: 16, flex: 1, minHeight: 160, display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>Distribución etaria (%)</div>
            <div style={{ flex: 1 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={demo.etaria} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="edad" tick={{ fontSize: 10, fill: C.text3 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: C.text3 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => [`${v}%`, "Población"]} cursor={{ fill: "rgba(11,26,46,0.04)" }} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="pct" fill={C.accent} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={nota}>Fuente: Censo 2024 (INE). NSE: hogares por unidad vecinal, metodología AIM Chile.</div>
          </div>
        </div>

        {/* Columna 2: Farmacéutico */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `3px solid ${C.green}`, paddingBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 800, color: C.text, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <IIconPharma /> Farmacéutico
            </div>
            <MultiSelectCadenas opciones={marcasPresentes} selected={cadenasFiltro} onChange={setCadenasFiltro} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div style={{ ...tarjeta, padding: 12 }}>
              <div style={etiquetaKPI}>Locales</div>
              <div className="num" style={{ fontSize: 20, fontWeight: 700, color: C.text, marginTop: 4 }}>{fmt(fMarca.length)}</div>
            </div>
            <div style={{ ...tarjeta, padding: 12 }}>
              <div style={etiquetaKPI}>De cadena</div>
              <div className="num" style={{ fontSize: 20, fontWeight: 700, color: C.text, marginTop: 4 }}>{fmt(pct(segmentos.cadena, fMarca.length))}%</div>
            </div>
            <div style={{ ...tarjeta, padding: 12 }} title="Maicao, Preunic y Liquimax: venden farma pero no son sustituto directo">
              <div style={etiquetaKPI}>Perfumerías</div>
              <div className="num" style={{ fontSize: 20, fontWeight: 700, color: C.text, marginTop: 4 }}>{fmt(segmentos.perfumeria)}</div>
            </div>
          </div>

          <div style={{ ...tarjeta, padding: 16, height: Math.max(180, 40 + locsPorMarca.length * 24), display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>Participación en locales, por marca</div>
            <div style={{ flex: 1 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={locsPorMarca} layout="vertical" margin={{ top: 0, right: 40, left: -10, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: C.text2 }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip cursor={{ fill: "rgba(11,26,46,0.04)" }} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" name="Locales" radius={[0, 4, 4, 0]} label={<CustomBarLabel />}>
                    {locsPorMarca.map(e => <Cell key={e.name} fill={e.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ ...tarjeta, padding: 16, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 12 }}>
              Aperturas y cierres{ultimoMes && ` · detectados en ${ultimoMes}`}
            </div>
            {filasNeto.length === 0 ? (
              <div style={{ fontSize: 12, color: C.text3 }}>
                {ultimoMes ? "Sin movimientos en la selección." : "Sin corte con diff todavía."}
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ color: C.text3, fontSize: 10, textTransform: "uppercase" }}>
                    <th style={{ textAlign: "left", fontWeight: 600, paddingBottom: 4 }}>Marca</th>
                    <th style={{ textAlign: "right", fontWeight: 600 }}>Aper.</th>
                    <th style={{ textAlign: "right", fontWeight: 600 }}>Cierres</th>
                    <th style={{ textAlign: "right", fontWeight: 600 }}>Neto</th>
                  </tr>
                </thead>
                <tbody>
                  {[...filasTabla, { cadena: "TOTAL" as const, ...totalNeto }].map(r => {
                    const total = r.cadena === "TOTAL";
                    return (
                      <tr key={r.cadena} style={{ borderTop: `1px solid ${C.border}`, fontWeight: total ? 700 : 500, color: total ? C.text : C.text2 }}>
                        <td style={{ padding: "6px 0" }}>{r.cadena}</td>
                        <td className="num" style={{ textAlign: "right" }}>{r.aperturas}</td>
                        <td className="num" style={{ textAlign: "right" }}>{r.cierres}</td>
                        <td className="num" style={{ textAlign: "right", color: colorNeto(r.neto) }}>{signo(r.neto)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <div style={nota}>
              {ocultas > 0 && "El total incluye independientes y otras, que no se listan. "}
              Detección en el registro, no fecha de inauguración: el registro publica altas y bajas con rezago.
            </div>
          </div>
        </div>

        {/* Columna 3: Mapa */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 800, color: C.text, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `3px solid ${C.text}`, paddingBottom: 8 }}>
            <IIconMap /> Mapa
          </div>

          <div style={{ ...tarjeta, flex: 1, minHeight: 420, overflow: "hidden", position: "relative" }}>
            <MapContainer center={[-33.4489, -70.6693]} zoom={11} style={{ width: "100%", height: "100%" }} zoomControl={false} attributionControl={false}>
              <TileLayer url={TILES.claro.url} maxNativeZoom={TILES.claro.maxNativeZoom} />
              <MapAutoZoom farmacias={fComuna} />
              {fMarca.slice(0, 1500).map((f) => (
                <CircleMarker
                  key={f.id}
                  center={[f.lat, f.lon]}
                  radius={4}
                  color="rgba(255,255,255,0.5)"
                  weight={1}
                  fillColor={COLORES_CADENA[f.cadena] || "#64748b"}
                  fillOpacity={0.8}
                />
              ))}
            </MapContainer>
            <div style={{ position: "absolute", bottom: 8, left: 8, zIndex: 400, background: "rgba(253,252,250,0.92)", padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 600, color: C.text2, border: `1px solid ${C.border}` }}>
              {fMarca.length > 1500 ? `Mostrando 1.500 de ${fmt(fMarca.length)} locales` : `${fmt(fMarca.length)} locales`}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
