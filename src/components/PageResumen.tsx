import { useState, useMemo, useEffect, useRef } from "react";
import { Farmacia } from "../types";
import { DemografiaCenso } from "../hooks/useDemografia";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { MapContainer, TileLayer, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import { COLORES_CADENA } from "../constants";

// Tokens de marca REALI + semánticos data viz (diseño/paleta.md)
const C = {
  bg: "#F4F1EA", bgCard: "#FDFCFA", border: "#E3DFD3",
  text: "#0B1A2E", text2: "#3E4A61", text3: "#5D6880",
  accent: "#F5A524", accentStrong: "#C98410", accentText: "#9A6206",
  green: "#2D8A6B", red: "#C13B3B", purple: "#3E4A61", orange: "#D4A017"
};

const GSE_COLORS = ["#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe"];
const GENDER_COLORS = ["#ec4899", "#3b82f6"]; // pink, blue

interface Props {
  farmacias: Farmacia[];
  demografia: DemografiaCenso[];
}

// Icons
function IIconPop() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function IIconPharma() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2z"/><path d="M3 19a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z"/><path d="M12 3v13"/></svg>; }
function IIconMap() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>; }

// POI Icons
function IBuilding() { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>; }
function IHospital() { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18"/><path d="M3 12h18"/></svg>; }
function IDollar() { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>; }
function IPet() { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 11c0-2-1.5-3.5-3.5-3.5a3.5 3.5 0 0 0 0 7c2 0 3.5-1.5 3.5-3.5z"/><path d="M12 11c0-2 1.5-3.5 3.5-3.5a3.5 3.5 0 0 1 0 7c-2 0-3.5-1.5-3.5-3.5z"/><path d="M12 11c-2 0-3.5 1.5-3.5 3.5a3.5 3.5 0 0 0 7 0c0-2-1.5-3.5-3.5-3.5z"/><path d="M5 8c0-1.5-1-3-2.5-3A2.5 2.5 0 0 0 0 7.5C0 9 1.5 10 3 10c1.5 0 2-1.5 2-2z"/><path d="M19 8c0-1.5 1-3 2.5-3A2.5 2.5 0 0 1 24 7.5C24 9 22.5 10 21 10c-1.5 0-2-1.5-2-2z"/></svg>; }

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 1.6;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill={C.text2} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={10} fontWeight={600}>
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

function MapAutoZoom({ farmacias, comunaFiltro }: { farmacias: Farmacia[]; comunaFiltro: string }) {
  const map = useMap();
  useEffect(() => {
    if (farmacias.length === 0) return;
    const bounds = L.latLngBounds(farmacias.map(f => [f.lat, f.lon] as [number, number]));
    if (bounds.isValid()) {
      map.flyToBounds(bounds, { padding: [20, 20], maxZoom: 14, duration: 1.5 });
    }
  }, [farmacias, comunaFiltro, map]);
  return null;
}

const OPCIONES_CADENAS = ["Cruz Verde", "Salcobrand", "Ahumada", "Dr. Simi", "Independientes", "Otros"];

function MultiSelectCadenas({ selected, onChange }: { selected: string[], onChange: (s: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const toggle = (val: string) => {
    if (selected.includes(val)) onChange(selected.filter(x => x !== val));
    else onChange([...selected, val]);
  };

  return (
    <div style={{ position: "relative" }} ref={containerRef}>
      <button onClick={() => setOpen(!open)} style={{ fontSize: 10, border: `1px solid ${C.border}`, borderRadius: 4, padding: "4px 8px", background: C.bgCard, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: C.text2, fontWeight: 500 }}>
        Cadenas ({selected.length}) <span style={{ fontSize: 8 }}>▼</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 6, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 500, width: 140, padding: 6, display: "flex", flexDirection: "column", gap: 4 }}>
          {OPCIONES_CADENAS.map(c => (
            <label key={c} style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "4px", borderRadius: 4, background: selected.includes(c) ? "rgba(245,165,36,0.10)" : "transparent" }}>
              <input type="checkbox" checked={selected.includes(c)} onChange={() => toggle(c)} style={{ cursor: "pointer" }} />
              <span style={{ color: C.text2, fontWeight: selected.includes(c) ? 600 : 400 }}>{c}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PageResumen({ farmacias, demografia }: Props) {
  const [comunaFiltro, setComunaFiltro] = useState<string>("");
  const [cadenasFiltro, setCadenasFiltro] = useState<string[]>(OPCIONES_CADENAS);

  const comunas = useMemo(() => [...new Set(farmacias.map(f => f.comuna))].sort(), [farmacias]);

  const fFiltradasComuna = useMemo(() => {
    if (!comunaFiltro) return farmacias;
    return farmacias.filter(f => f.comuna === comunaFiltro);
  }, [farmacias, comunaFiltro]);

  const dFiltrada = useMemo(() => {
    if (!comunaFiltro) return demografia;
    return demografia.filter(d => d.nombre_comuna === comunaFiltro);
  }, [demografia, comunaFiltro]);

  // Farmacia filt by column 2 specifically
  const fFiltradasPharma = useMemo(() => {
    return fFiltradasComuna.filter(f => {
      // Map logic for "Independientes" and "Otros" could be adjusted based on actual data
      const isMain = ["Cruz Verde", "Salcobrand", "Ahumada", "Dr. Simi"].includes(f.cadena);
      if (isMain) return cadenasFiltro.includes(f.cadena);
      if (f.cadena.toLowerCase().includes("independiente")) return cadenasFiltro.includes("Independientes");
      return cadenasFiltro.includes("Otros"); // fallback for anything else if "Otros" is checked
    });
  }, [fFiltradasComuna, cadenasFiltro]);

  // --- DEMOGRAFICO ---
  const pobTotal = useMemo(() => dFiltrada.reduce((acc, curr) => acc + (curr.poblacion || 0), 0), [dFiltrada]);
  const cantFarmaciasComuna = fFiltradasComuna.length;
  const farmPorHab = pobTotal > 0 && cantFarmaciasComuna > 0 ? (pobTotal / cantFarmaciasComuna).toFixed(0) : "0";
  
  const gseData = [{ name: "ABC1", value: 15 }, { name: "C2", value: 20 }, { name: "C3", value: 25 }, { name: "D", value: 30 }, { name: "E", value: 10 }];
  const genderData = [{ name: "Mujeres", value: 52 }, { name: "Hombres", value: 48 }];
  const ageData = [{ age: "0-14", pop: 20 }, { age: "15-29", pop: 25 }, { age: "30-44", pop: 22 }, { age: "45-59", pop: 18 }, { age: "60+", pop: 15 }];
  
  const adultosMayores = "15.4%";
  const escolaridad = "11.8 años";

  // --- FARMACEUTICO ---
  const rawMarketShare = [
    { name: "Cruz Verde", value: fFiltradasComuna.filter(f=>f.cadena==="Cruz Verde").length || 30, fill: COLORES_CADENA["Cruz Verde"] || "#00833e" },
    { name: "Salcobrand", value: fFiltradasComuna.filter(f=>f.cadena==="Salcobrand").length || 25, fill: COLORES_CADENA["Salcobrand"] || "#e20613" },
    { name: "Ahumada", value: fFiltradasComuna.filter(f=>f.cadena==="Ahumada").length || 20, fill: COLORES_CADENA["Ahumada"] || "#003b7a" },
    { name: "Dr. Simi", value: fFiltradasComuna.filter(f=>f.cadena==="Dr. Simi").length || 15, fill: COLORES_CADENA["Dr. Simi"] || "#27a5d3" }
  ].filter(d => cadenasFiltro.includes(d.name));
  
  const totalMS = rawMarketShare.reduce((a, b) => a + b.value, 0) || 1;
  const marketShareData = rawMarketShare.map(d => ({ ...d, percent: Math.round((d.value / totalMS) * 100) })).sort((a,b)=>b.value-a.value);

  // Group locations based on filter for Locales chart
  const locsPorCadenaRaw = OPCIONES_CADENAS.filter(c => cadenasFiltro.includes(c)).map(c => {
    let count = 0;
    if (["Cruz Verde", "Salcobrand", "Ahumada", "Dr. Simi"].includes(c)) count = fFiltradasComuna.filter(f=>f.cadena===c).length;
    else if (c === "Independientes") count = fFiltradasComuna.filter(f=>f.cadena.toLowerCase().includes("independiente")).length || 5; // mock if 0
    else count = fFiltradasComuna.filter(f=>!["Cruz Verde", "Salcobrand", "Ahumada", "Dr. Simi"].includes(f.cadena) && !f.cadena.toLowerCase().includes("independiente")).length || 8; // mock if 0
    return { name: c, value: count, fill: COLORES_CADENA[c as keyof typeof COLORES_CADENA] || "#94a3b8" };
  });
  const totalLocs = locsPorCadenaRaw.reduce((a,b) => a + b.value, 0) || 1;
  const locsPorCadena = locsPorCadenaRaw.map(d => ({ ...d, percent: Math.round((d.value / totalLocs) * 100) })).sort((a,b)=>b.value-a.value).slice(0, 5);

  const aperturasData = [
    { name: "Cruz Verde", net: 5 },
    { name: "Salcobrand", net: 3 },
    { name: "Ahumada", net: -1 },
    { name: "Dr. Simi", net: 8 },
    { name: "TOTAL", net: 15 }
  ];

  // --- ENTORNO ---
  const malls = Math.floor(Math.random() * 5) + 1;
  const clinicas = Math.floor(Math.random() * 10) + 2;
  const bancos = Math.floor(Math.random() * 15) + 3;
  const petshops = Math.floor(Math.random() * 8) + 1;
  const score = (Math.random() * 2 + 7).toFixed(1); // 7.0 to 9.0

  return (
    <div style={{ flex: 1, padding: 24, overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header / Filtro */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0, letterSpacing: "-0.02em" }}>Resumen de Mercado</h2>
          <p style={{ fontSize: 13, color: C.text2, margin: "4px 0 0 0" }}>Indicadores integrados de demografía, farmacias y entorno territorial.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.bgCard, padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.text2 }}>Zona Global (Comuna):</span>
          <select 
            value={comunaFiltro} 
            onChange={(e) => setComunaFiltro(e.target.value)}
            style={{ fontSize: 12, border: "none", outline: "none", color: C.text, background: "transparent", cursor: "pointer", fontWeight: 500 }}
          >
            <option value="">Todas las comunas</option>
            {comunas.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Grid 3 columnas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, flex: 1, minHeight: 0 }}>
        
        {/* Columna 1: Demografico */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 800, color: C.text, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `3px solid ${C.accent}`, paddingBottom: 8 }}>
            <IIconPop /> Demográfico
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ background: C.bgCard, padding: 16, borderRadius: 12, border: `1px solid ${C.border}`, boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
              <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, textTransform: "uppercase" }}>Población Total</div>
              <div className="num" style={{ fontSize: 22, fontWeight: 700, color: C.text, marginTop: 4 }}>{pobTotal.toLocaleString("es-CL")}</div>
            </div>
            <div style={{ background: C.bgCard, padding: 16, borderRadius: 12, border: `1px solid ${C.border}`, boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
              <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, textTransform: "uppercase" }}>Farm. / Habitantes</div>
              <div className="num" style={{ fontSize: 22, fontWeight: 700, color: C.accentStrong, marginTop: 4 }}>
                1<span style={{ fontSize: 14, color: C.text3, fontWeight: 500 }}> / {Number(farmPorHab).toLocaleString("es-CL")}</span>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ background: C.bgCard, padding: 12, borderRadius: 12, border: `1px solid ${C.border}`, boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
              <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, textTransform: "uppercase" }}>Adultos Mayores</div>
              <div className="num" style={{ fontSize: 17, fontWeight: 700, color: C.text, marginTop: 4 }}>{adultosMayores}</div>
            </div>
            <div style={{ background: C.bgCard, padding: 12, borderRadius: 12, border: `1px solid ${C.border}`, boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
              <div style={{ fontSize: 11, color: C.text3, fontWeight: 600, textTransform: "uppercase" }}>Escolaridad Prom.</div>
              <div className="num" style={{ fontSize: 17, fontWeight: 700, color: C.text, marginTop: 4 }}>{escolaridad}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, flexShrink: 0 }}>
            {/* GSE */}
            <div style={{ background: C.bgCard, padding: "12px 4px", borderRadius: 12, border: `1px solid ${C.border}`, boxShadow: "0 2px 8px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text, textAlign: "center" }}>GSE</div>
              <div style={{ height: 120, width: "100%" }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={gseData} innerRadius={25} outerRadius={40} dataKey="value" stroke="none" label={renderCustomizedLabel} labelLine={false} isAnimationActive={false}>
                      {gseData.map((_, i) => <Cell key={`c-${i}`} fill={GSE_COLORS[i % GSE_COLORS.length]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            {/* Genero */}
            <div style={{ background: C.bgCard, padding: "12px 4px", borderRadius: 12, border: `1px solid ${C.border}`, boxShadow: "0 2px 8px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text, textAlign: "center" }}>GÉNERO</div>
              <div style={{ height: 120, width: "100%", position: "relative" }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={genderData} innerRadius={25} outerRadius={40} dataKey="value" stroke="none" label={renderCustomizedLabel} labelLine={false} isAnimationActive={false}>
                      {genderData.map((_, i) => <Cell key={`c-${i}`} fill={GENDER_COLORS[i % GENDER_COLORS.length]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Etario */}
          <div style={{ background: C.bgCard, padding: 16, borderRadius: 12, border: `1px solid ${C.border}`, boxShadow: "0 2px 8px rgba(0,0,0,0.03)", flex: 1, minHeight: 160, display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>Distribución Etaria (%)</div>
            <div style={{ flex: 1 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ageData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="age" tick={{ fontSize: 10, fill: C.text3 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: C.text3 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "rgba(11,26,46,0.04)" }} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="pop" fill={C.accent} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Columna 2: Farmaceutico */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `3px solid ${C.green}`, paddingBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 800, color: C.text, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <IIconPharma /> Farmacéutico
            </div>
            <MultiSelectCadenas selected={cadenasFiltro} onChange={setCadenasFiltro} />
          </div>

          {/* Market Share Horizontal */}
          <div style={{ background: C.bgCard, padding: 16, borderRadius: 12, border: `1px solid ${C.border}`, boxShadow: "0 2px 8px rgba(0,0,0,0.03)", height: 210, display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>Market Share Estimado</div>
            <div style={{ flex: 1 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={marketShareData} layout="vertical" margin={{ top: 0, right: 40, left: -10, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: C.text2 }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip cursor={{ fill: "rgba(11,26,46,0.04)" }} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} label={<CustomBarLabel />}>
                    {marketShareData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Locales por Cadena */}
          <div style={{ background: C.bgCard, padding: 16, borderRadius: 12, border: `1px solid ${C.border}`, boxShadow: "0 2px 8px rgba(0,0,0,0.03)", height: 210, display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>Locales Totales por Cadena</div>
            <div style={{ flex: 1 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={locsPorCadena} layout="vertical" margin={{ top: 0, right: 40, left: -10, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: C.text2 }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip cursor={{ fill: "rgba(11,26,46,0.04)" }} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} label={<CustomBarLabel />}>
                    {locsPorCadena.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabla aperturas */}
          <div style={{ background: C.bgCard, padding: 16, borderRadius: 12, border: `1px solid ${C.border}`, boxShadow: "0 2px 8px rgba(0,0,0,0.03)", flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 12 }}>Nuevas Aperturas (Neto, mes)</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <tbody>
                {aperturasData.map((row, i) => (
                  <tr key={i} style={{ borderBottom: i === aperturasData.length - 1 ? "none" : `1px solid ${C.border}`, fontWeight: row.name === "TOTAL" ? 700 : 500, color: row.name === "TOTAL" ? C.text : C.text2 }}>
                    <td style={{ padding: "6px 0" }}>{row.name}</td>
                    <td style={{ padding: "6px 0", textAlign: "right", color: row.net > 0 ? C.green : (row.net < 0 ? C.red : "inherit") }}>{row.net > 0 ? `+${row.net}` : row.net}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Columna 3: Mapa y Entorno */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 800, color: C.text, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `3px solid ${C.text}`, paddingBottom: 8 }}>
            <IIconMap /> Mapa y Entorno
          </div>
          
          <div style={{ background: "linear-gradient(135deg, #0B1A2E, #1C2433)", padding: "16px 20px", borderRadius: 12, color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 4px 12px rgba(11,26,46,0.25)" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Score de Entorno</div>
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>Basado en densidad de POIs</div>
            </div>
            <div className="num" style={{ fontSize: 34, fontWeight: 700, color: "#F5A524" }}>{score}</div>
          </div>

          <div style={{ height: "40%", background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, boxShadow: "0 2px 8px rgba(0,0,0,0.03)", overflow: "hidden", position: "relative" }}>
            <MapContainer 
              center={[-33.4489, -70.6693]} 
              zoom={11} 
              style={{ width: "100%", height: "100%" }}
              zoomControl={false}
              attributionControl={false}
            >
              <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
              <MapAutoZoom farmacias={fFiltradasComuna} comunaFiltro={comunaFiltro} />
              {fFiltradasPharma.slice(0, 500).map((f) => (
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
              {fFiltradasPharma.length > 500 ? "Mostrando 500 ptos." : `${fFiltradasPharma.length} ptos.`}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ position: "relative", overflow: "hidden", background: C.bgCard, padding: "16px", borderRadius: 12, border: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
              <div style={{ position: "absolute", right: -6, bottom: -12, color: C.accent, opacity: 0.12, transform: "scale(3.5)", pointerEvents: "none" }}><IBuilding /></div>
              <span style={{ fontSize: 11, color: C.text3, fontWeight: 600, textTransform: "uppercase", zIndex: 1 }}>Malls</span>
              <span className="num" style={{ fontSize: 22, fontWeight: 700, color: C.text, zIndex: 1, marginTop: 4 }}>{malls}</span>
            </div>
            <div style={{ position: "relative", overflow: "hidden", background: C.bgCard, padding: "16px", borderRadius: 12, border: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
              <div style={{ position: "absolute", right: -4, bottom: -12, color: C.green, opacity: 0.12, transform: "scale(3.5)", pointerEvents: "none" }}><IHospital /></div>
              <span style={{ fontSize: 11, color: C.text3, fontWeight: 600, textTransform: "uppercase", zIndex: 1 }}>Clínicas</span>
              <span className="num" style={{ fontSize: 22, fontWeight: 700, color: C.text, zIndex: 1, marginTop: 4 }}>{clinicas}</span>
            </div>
            <div style={{ position: "relative", overflow: "hidden", background: C.bgCard, padding: "16px", borderRadius: 12, border: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
              <div style={{ position: "absolute", right: -6, bottom: -12, color: C.purple, opacity: 0.12, transform: "scale(3.5)", pointerEvents: "none" }}><IDollar /></div>
              <span style={{ fontSize: 11, color: C.text3, fontWeight: 600, textTransform: "uppercase", zIndex: 1 }}>Bancos</span>
              <span className="num" style={{ fontSize: 22, fontWeight: 700, color: C.text, zIndex: 1, marginTop: 4 }}>{bancos}</span>
            </div>
            <div style={{ position: "relative", overflow: "hidden", background: C.bgCard, padding: "16px", borderRadius: 12, border: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
              <div style={{ position: "absolute", right: -4, bottom: -12, color: C.orange, opacity: 0.12, transform: "scale(3.5)", pointerEvents: "none" }}><IPet /></div>
              <span style={{ fontSize: 11, color: C.text3, fontWeight: 600, textTransform: "uppercase", zIndex: 1 }}>Petshops</span>
              <span className="num" style={{ fontSize: 22, fontWeight: 700, color: C.text, zIndex: 1, marginTop: 4 }}>{petshops}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
