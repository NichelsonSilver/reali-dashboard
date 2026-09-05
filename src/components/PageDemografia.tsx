import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  PieChart, Pie, ResponsiveContainer,
} from "recharts";
import { Farmacia } from "../types";
import { DemografiaCenso } from "../hooks/useDemografia";

interface Props {
  farmacias: Farmacia[];
  demografia: DemografiaCenso[];
}

const C = {
  bg: "#F4F1EA", bgCard: "#FDFCFA", border: "#E3DFD3",
  text: "#0B1A2E", text2: "#3E4A61", text3: "#5D6880",
};

const secTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 12,
};

export default function PageDemografia({ farmacias, demografia }: Props) {
  const kpis = useMemo(() => {
    if (!demografia.length) return null;
    let poblacion = 0, e60 = 0, escolaridad = 0, count = 0;
    for (const d of demografia) {
      poblacion += d.poblacion;
      e60 += d.edad_60_mas;
      if (d.escolaridad_promedio > 0) { escolaridad += d.escolaridad_promedio; count++; }
    }
    return {
      poblacion: (poblacion / 1_000_000).toFixed(1) + "M",
      farmPor100k: poblacion > 0 ? ((farmacias.length / poblacion) * 100_000).toFixed(1) : "–",
      pct60: poblacion > 0 ? Math.round((e60 / poblacion) * 100) + "%" : "–",
      escolaridad: count > 0 ? (escolaridad / count).toFixed(1) + " años" : "–",
    };
  }, [farmacias, demografia]);

  const etaria = useMemo(() => {
    if (!demografia.length) return [];
    let e0_14 = 0, e15_29 = 0, e30_44 = 0, e45_59 = 0, e60 = 0;
    for (const d of demografia) {
      e0_14 += d.edad_0_14; e15_29 += d.edad_15_29;
      e30_44 += d.edad_30_44; e45_59 += d.edad_45_59; e60 += d.edad_60_mas;
    }
    const total = e0_14 + e15_29 + e30_44 + e45_59 + e60 || 1;
    return [
      { rango: "0–14",  pct: Math.round((e0_14  / total) * 100), color: "#22c55e" },
      { rango: "15–29", pct: Math.round((e15_29 / total) * 100), color: "#3b82f6" },
      { rango: "30–44", pct: Math.round((e30_44 / total) * 100), color: "#8b5cf6" },
      { rango: "45–59", pct: Math.round((e45_59 / total) * 100), color: "#f59e0b" },
      { rango: "60+",   pct: Math.round((e60    / total) * 100), color: "#ef4444" },
    ];
  }, [demografia]);

  const genero = useMemo(() => {
    if (!demografia.length) return [];
    let hombres = 0, mujeres = 0;
    for (const d of demografia) { hombres += d.hombres; mujeres += d.mujeres; }
    const total = hombres + mujeres || 1;
    return [
      { name: "Hombres", value: Math.round((hombres / total) * 100), color: "#3b82f6" },
      { name: "Mujeres", value: Math.round((mujeres / total) * 100), color: "#ec4899" },
    ];
  }, [demografia]);

  const topComunas = useMemo(() => {
    if (!farmacias.length || !demografia.length) return [];

    const conteo: Record<string, number> = {};
    for (const f of farmacias) conteo[f.comuna] = (conteo[f.comuna] ?? 0) + 1;

    const pobPorComuna: Record<string, number> = {};
    for (const d of demografia) pobPorComuna[d.nombre_comuna] = d.poblacion;

    // 10-stop blue scale: darkest = highest density
    const BLUES = [
      "#1e3a8a", "#1e40af", "#1d4ed8", "#2563eb", "#3b82f6",
      "#60a5fa", "#7cb9fb", "#93c5fd", "#a8d0fe", "#bfdbfe",
    ];

    return Object.entries(conteo)
      .filter(([comuna]) => (pobPorComuna[comuna] ?? 0) > 0)
      .map(([comuna, count]) => ({
        comuna,
        density: (count / pobPorComuna[comuna]) * 100_000,
      }))
      .sort((a, b) => b.density - a.density)
      .slice(0, 10)
      .map((item, i) => ({ ...item, color: BLUES[i] }));
  }, [farmacias, demografia]);

  const topAdultosMayores = useMemo(() => {
    if (!demografia.length) return [];
    return [...demografia]
      .filter((d) => d.poblacion > 0)
      .map((d) => ({
        comuna: d.nombre_comuna,
        pct: (d.edad_60_mas / d.poblacion) * 100,
        color: "#D4A017"
      }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 10);
  }, [demografia]);

  const gseData = useMemo(() => {
    if (!demografia.length) return [];
    let abc1 = 0, c2 = 0, c3 = 0, dClass = 0, eClass = 0;
    for (const d of demografia) {
      if (d.poblacion <= 0) continue;
      const esc = d.escolaridad_promedio;
      if (esc >= 13.5) abc1 += d.poblacion;
      else if (esc >= 12.5) c2 += d.poblacion;
      else if (esc >= 11.0) c3 += d.poblacion;
      else if (esc >= 9.5) dClass += d.poblacion;
      else eClass += d.poblacion;
    }
    const total = abc1 + c2 + c3 + dClass + eClass || 1;
    return [
      { name: "ABC1 (Alto)", value: Math.round((abc1 / total) * 100), color: "#10b981" },
      { name: "C2 (Medio Alto)", value: Math.round((c2 / total) * 100), color: "#3b82f6" },
      { name: "C3 (Medio)", value: Math.round((c3 / total) * 100), color: "#f59e0b" },
      { name: "D (Vulnerable)", value: Math.round((dClass / total) * 100), color: "#f97316" },
      { name: "E (Pobreza)", value: Math.round((eClass / total) * 100), color: "#ef4444" },
    ].filter(item => item.value > 0);
  }, [demografia]);

  const kpiItems = kpis ? [
    { label: "Población total",       val: kpis.poblacion,    color: "#C98410" },
    { label: "Farmacias / 100k hab",  val: kpis.farmPor100k,  color: "#3E4A61" },
    { label: "Adultos mayores (60+)", val: kpis.pct60,        color: "#C13B3B" },
    { label: "Escolaridad promedio",  val: kpis.escolaridad,  color: "#2D8A6B" },
  ] : [];

  return (
    <div style={{ flex: 1, overflowY: "auto", background: C.bg, padding: "24px 28px" }}>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {kpiItems.map(({ label, val, color }) => (
          <div key={label} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ width: 28, height: 3, background: color, borderRadius: 2, marginBottom: 10 }} />
            <div style={{ fontSize: 24, fontWeight: 700, color: C.text, lineHeight: 1.1 }}>{val}</div>
            <div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>{label}</div>
          </div>
        ))}
        {!kpis && (
          <div style={{ gridColumn: "1/-1", fontSize: 12, color: C.text3, fontStyle: "italic" }}>
            Sin datos demográficos
          </div>
        )}
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

        {/* Distribución etaria */}
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={secTitle}>Distribución etaria</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={etaria} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <XAxis dataKey="rango" tick={{ fontSize: 11, fill: C.text3 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: C.text3 }} axisLine={false} tickLine={false} tickFormatter={(v) => v + "%"} />
              <Tooltip
                formatter={(v) => [v + "%", "Porcentaje"]}
                contentStyle={{ fontSize: 11, border: `1px solid ${C.border}`, borderRadius: 6 }}
              />
              <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                {etaria.map((e) => <Cell key={e.rango} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Distribución género */}
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={secTitle}>Distribución por género</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={genero} dataKey="value"
                cx="50%" cy="50%"
                innerRadius={55} outerRadius={80}
                paddingAngle={3}
                label={({ name, value }) => `${name} ${value}%`}
                labelLine={false}
              >
                {genero.map((g) => <Cell key={g.name} fill={g.color} />)}
              </Pie>
              <Tooltip
                formatter={(v) => [v + "%", ""]}
                contentStyle={{ fontSize: 11, border: `1px solid ${C.border}`, borderRadius: 6 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2: GSE y Adultos Mayores */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* GSE */}
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={secTitle}>Estrato Socioeconómico Predominante (GSE)</div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={gseData} dataKey="value"
                cx="50%" cy="50%"
                innerRadius={60} outerRadius={90}
                paddingAngle={3}
                label={({ name, value }) => `${name} ${value}%`}
                labelLine={false}
              >
                {gseData.map((g) => <Cell key={g.name} fill={g.color} />)}
              </Pie>
              <Tooltip
                formatter={(v) => [v + "%", "Población"]}
                contentStyle={{ fontSize: 11, border: `1px solid ${C.border}`, borderRadius: 6 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Adultos mayores */}
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={secTitle}>Top 10 comunas — % Adultos Mayores (60+)</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={topAdultosMayores} layout="vertical" margin={{ top: 0, right: 20, left: 80, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: C.text3 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="comuna" tick={{ fontSize: 11, fill: C.text3 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip
                formatter={(v: number) => [v.toFixed(1) + "%", "Adultos Mayores"]}
                contentStyle={{ fontSize: 11, border: `1px solid ${C.border}`, borderRadius: 6 }}
              />
              <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                {topAdultosMayores.map((d) => <Cell key={d.comuna} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top 10 comunas — pendiente implementación */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div style={secTitle}>Top 10 comunas — densidad farmacéutica (farmacias / 100k hab)</div>
        {topComunas.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topComunas} layout="vertical" margin={{ top: 0, right: 20, left: 80, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: C.text3 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="comuna" tick={{ fontSize: 11, fill: C.text3 }} axisLine={false} tickLine={false} width={75} />
              <Tooltip
                formatter={(v) => [Number(v).toFixed(1), "Farm / 100k"]}
                contentStyle={{ fontSize: 11, border: `1px solid ${C.border}`, borderRadius: 6 }}
              />
              <Bar dataKey="density" radius={[0, 4, 4, 0]}>
                {topComunas.map((d) => <Cell key={d.comuna} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ fontSize: 12, color: C.text3, fontStyle: "italic" }}>Implementa la lógica en topComunas para ver el gráfico</p>
        )}
      </div>
    </div>
  );
}
