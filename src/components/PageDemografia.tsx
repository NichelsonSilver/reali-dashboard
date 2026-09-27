import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  PieChart, Pie, ResponsiveContainer,
} from "recharts";
import { Farmacia } from "../types";
import { DemografiaCenso } from "../hooks/useDemografia";
import { useCapaNSE } from "../hooks/useGeoCapas";
import { hogaresNSEEnComunas } from "../utils/territorio";
import { COLOR_NSE } from "../constants";

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

const TOP = 10;

// "Top 10 comunas" con 2 comunas cargadas promete algo que no hay.
const tituloRanking = (n: number, que: string) =>
  n >= TOP ? `Top ${TOP} comunas — ${que}` : `Comunas cargadas (${n}) — ${que}`;

function cifra(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toLocaleString("es-CL", { maximumFractionDigits: 1 }) + "M";
  if (n >= 100_000) return Math.round(n / 1_000).toLocaleString("es-CL") + "k";
  return n.toLocaleString("es-CL");
}

export default function PageDemografia({ farmacias, demografia }: Props) {
  const { data: capaNSE } = useCapaNSE(true);

  // El censo es nacional; la base de farmacias puede ser una muestra. Todo en
  // esta página se calcula sobre las comunas (por CUT) que tienen farmacias
  // cargadas: si no, "farmacias / 100k hab" divide 321 locales por todo Chile.
  const cuts = useMemo(
    () => new Set(farmacias.map((f) => f.cod_comuna).filter((c): c is number => c != null)),
    [farmacias],
  );
  const universo = useMemo(
    () => demografia.filter((d) => cuts.has(Number(d.cod_comuna)) && d.poblacion > 0),
    [demografia, cuts],
  );

  const kpis = useMemo(() => {
    if (!universo.length) return null;
    let poblacion = 0, e60 = 0, escPonderada = 0, pobConEsc = 0;
    for (const d of universo) {
      poblacion += d.poblacion;
      e60 += d.edad_60_mas;
      // La escolaridad es un promedio comunal: se pondera por población.
      if (d.escolaridad_promedio > 0) { escPonderada += d.escolaridad_promedio * d.poblacion; pobConEsc += d.poblacion; }
    }
    return {
      comunas: universo.length,
      poblacion: cifra(poblacion),
      farmPor100k: ((farmacias.length / poblacion) * 100_000).toLocaleString("es-CL", { maximumFractionDigits: 1 }),
      pct60: ((e60 / poblacion) * 100).toLocaleString("es-CL", { maximumFractionDigits: 1 }) + "%",
      escolaridad: pobConEsc > 0 ? (escPonderada / pobConEsc).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " años" : "s/d",
    };
  }, [farmacias, universo]);

  const etaria = useMemo(() => {
    if (!universo.length) return [];
    let e0_14 = 0, e15_29 = 0, e30_44 = 0, e45_59 = 0, e60 = 0;
    for (const d of universo) {
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
  }, [universo]);

  const genero = useMemo(() => {
    if (!universo.length) return [];
    let hombres = 0, mujeres = 0;
    for (const d of universo) { hombres += d.hombres; mujeres += d.mujeres; }
    const total = hombres + mujeres || 1;
    return [
      { name: "Hombres", value: Math.round((hombres / total) * 100), color: "#3b82f6" },
      { name: "Mujeres", value: Math.round((mujeres / total) * 100), color: "#ec4899" },
    ];
  }, [universo]);

  const topComunas = useMemo(() => {
    const conteo = new Map<number, number>();
    for (const f of farmacias) if (f.cod_comuna != null) conteo.set(f.cod_comuna, (conteo.get(f.cod_comuna) ?? 0) + 1);

    // 10-stop blue scale: darkest = highest density
    const BLUES = [
      "#1e3a8a", "#1e40af", "#1d4ed8", "#2563eb", "#3b82f6",
      "#60a5fa", "#7cb9fb", "#93c5fd", "#a8d0fe", "#bfdbfe",
    ];

    return universo
      .map((d) => ({
        comuna: d.nombre_comuna,
        density: ((conteo.get(Number(d.cod_comuna)) ?? 0) / d.poblacion) * 100_000,
      }))
      .sort((a, b) => b.density - a.density)
      .slice(0, TOP)
      .map((item, i) => ({ ...item, color: BLUES[i] }));
  }, [farmacias, universo]);

  const topAdultosMayores = useMemo(() => {
    return universo
      .map((d) => ({
        comuna: d.nombre_comuna,
        pct: (d.edad_60_mas / d.poblacion) * 100,
        color: "#D4A017"
      }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, TOP);
  }, [universo]);

  // NSE real: hogares por grupo de las unidades vecinales de estas comunas
  // (metodología AIM Chile). Reemplaza un "GSE" que se inventaba con umbrales
  // de escolaridad elegidos a mano y rotulaba "E (Pobreza)" a comunas enteras.
  const nse = useMemo(() => {
    if (!capaNSE) return null;
    const { total, data } = hogaresNSEEnComunas(capaNSE, cuts);
    return {
      total,
      data: data.map((d) => ({ ...d, pct: Math.round((d.value / (total || 1)) * 100), color: COLOR_NSE[d.name] })),
    };
  }, [capaNSE, cuts]);

  const kpiItems = kpis ? [
    { label: "Población total",       val: kpis.poblacion,    color: "#C98410" },
    { label: "Farmacias / 100k hab",  val: kpis.farmPor100k,  color: "#3E4A61" },
    { label: "Adultos mayores (60+)", val: kpis.pct60,        color: "#C13B3B" },
    { label: "Escolaridad promedio",  val: kpis.escolaridad,  color: "#2D8A6B" },
  ] : [];

  return (
    <div style={{ flex: 1, overflowY: "auto", background: C.bg, padding: "24px 28px" }}>

      {kpis && (
        <p style={{ fontSize: 12, color: C.text2, margin: "0 0 12px 0" }}>
          Censo 2024 (INE) de las {kpis.comunas} {kpis.comunas === 1 ? "comuna" : "comunas"} con farmacias cargadas · {farmacias.length.toLocaleString("es-CL")} farmacias.
        </p>
      )}

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
                innerRadius={45} outerRadius={68}
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

      {/* Charts row 2: NSE y Adultos Mayores */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* NSE */}
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={secTitle}>Nivel socioeconómico — % de hogares</div>
          {nse && nse.total > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={nse.data} dataKey="value"
                  cx="50%" cy="50%"
                  innerRadius={60} outerRadius={90}
                  paddingAngle={2}
                  label={({ name, pct }) => (pct >= 3 ? `${name} ${pct}%` : "")}
                  labelLine={false}
                >
                  {nse.data.map((g) => <Cell key={g.name} fill={g.color} />)}
                </Pie>
                <Tooltip
                  formatter={(v: number) => [`${v.toLocaleString("es-CL")} hogares`, "NSE"]}
                  contentStyle={{ fontSize: 11, border: `1px solid ${C.border}`, borderRadius: 6 }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ fontSize: 12, color: C.text3, fontStyle: "italic" }}>{nse ? "Sin datos NSE para estas comunas" : "Cargando…"}</p>
          )}
          <div style={{ fontSize: 10, color: C.text3, marginTop: 4 }}>
            Hogares por unidad vecinal, metodología AIM Chile (tramos de ingreso, bidat.gob.cl).
          </div>
        </div>

        {/* Adultos mayores */}
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={secTitle}>{tituloRanking(topAdultosMayores.length, "% adultos mayores (60+)")}</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={topAdultosMayores} layout="vertical" margin={{ top: 0, right: 20, left: 80, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: C.text3 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="comuna" tick={{ fontSize: 11, fill: C.text3 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip
                formatter={(v: number) => [v.toFixed(1) + "%", "Adultos Mayores"]}
                contentStyle={{ fontSize: 11, border: `1px solid ${C.border}`, borderRadius: 6 }}
              />
              <Bar dataKey="pct" radius={[0, 4, 4, 0]} maxBarSize={36}>
                {topAdultosMayores.map((d) => <Cell key={d.comuna} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Densidad farmacéutica */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div style={secTitle}>{tituloRanking(topComunas.length, "densidad farmacéutica (farmacias / 100k hab)")}</div>
        {topComunas.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topComunas} layout="vertical" margin={{ top: 0, right: 20, left: 80, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: C.text3 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="comuna" tick={{ fontSize: 11, fill: C.text3 }} axisLine={false} tickLine={false} width={75} />
              <Tooltip
                formatter={(v) => [Number(v).toFixed(1), "Farm / 100k"]}
                contentStyle={{ fontSize: 11, border: `1px solid ${C.border}`, borderRadius: 6 }}
              />
              <Bar dataKey="density" radius={[0, 4, 4, 0]} maxBarSize={36}>
                {topComunas.map((d) => <Cell key={d.comuna} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ fontSize: 12, color: C.text3, fontStyle: "italic" }}>Sin datos de población para las comunas cargadas</p>
        )}
      </div>
    </div>
  );
}
