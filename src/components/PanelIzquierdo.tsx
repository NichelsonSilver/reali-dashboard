import { useMemo } from "react";
import { Farmacia } from "../types";
import { DemografiaCenso } from "../hooks/useDemografia";
import { CADENAS, COLORES_CADENA, COLOR_NSE } from "../constants";
import { useGseAim } from "../hooks/useGseAim";
import { gseEnComunas } from "../utils/territorio";

interface Filtros { cadenas: string[]; region: string; comuna: string; }

interface Props {
  farmacias: Farmacia[];
  farmaciasSinCadena: Farmacia[];
  demografia: DemografiaCenso[];
  comunasDisponibles: string[];
  regionesDisponibles: string[];
  filtros: Filtros;
  onChange: (f: Filtros) => void;
  uploadedFiles: { name: string }[];
  onRemoveFile: (i: number) => void;
}

// Tokens de marca REALI (diseño/paleta.md)
const C = {
  bg: "#F4F1EA", bg2: "#EAE6DA", bgCard: "#FDFCFA",
  border: "#E3DFD3", text: "#0B1A2E", text2: "#3E4A61", text3: "#5D6880",
  accent: "#F5A524", accentText: "#9A6206",
};

function HBarChart({
  data,
  selected,
  onToggle,
}: {
  data: { nombre: string; cantidad: number; color: string }[];
  selected?: string[];
  onToggle?: (name: string) => void;
}) {
  const max = Math.max(...data.map((d) => d.cantidad), 1);
  const ROW = 27;
  const LW = 78;
  const anySelected = (selected?.length ?? 0) > 0;
  return (
    <div style={{ position: "relative", height: data.length * ROW }}>
      {data.map((d, i) => {
        const isSelected = selected?.includes(d.nombre) ?? false;
        const dimmed = anySelected && !isSelected;
        return (
          <div
            key={d.nombre}
            onClick={() => onToggle?.(d.nombre)}
            style={{
              position: "absolute", top: i * ROW, left: 0, right: 0,
              height: ROW - 4, display: "flex", alignItems: "center", gap: 6,
              cursor: onToggle ? "pointer" : "default",
              borderRadius: 5, padding: "0 4px",
              opacity: dimmed ? 0.38 : 1,
              transition: "opacity 0.15s",
            }}
          >
            <div style={{ width: LW, fontSize: 10.5, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: isSelected ? 700 : 400, color: isSelected ? d.color : C.text3, transition: "color 0.15s, font-weight 0.15s" }}>
              {d.nombre}
            </div>
            <div style={{ flex: 1, height: 8, background: C.bg2, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${(d.cantidad / max) * 100}%`, height: "100%", background: d.color, borderRadius: 4, transition: "width 0.4s", opacity: 0.85 }} />
            </div>
            <div className="num" style={{ width: 30, fontSize: 10, color: C.text2, fontWeight: 600, textAlign: "right", flexShrink: 0 }}>
              {d.cantidad}
            </div>
            <div style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0, border: `2px solid ${isSelected ? d.color : "#CBC5B5"}`, background: isSelected ? d.color : "transparent", transition: "all 0.15s" }} />
          </div>
        );
      })}
    </div>
  );
}

const labelSt: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, letterSpacing: "0.07em", color: C.text3,
  textTransform: "uppercase", marginBottom: 4, display: "block",
};
const selSt: React.CSSProperties = {
  width: "100%", background: C.bgCard, border: `1px solid ${C.border}`,
  borderRadius: 6, padding: "6px 26px 6px 9px", fontSize: 11, color: C.text,
  cursor: "pointer", outline: "none", boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='%235D6880' d='M4 6l4 4 4-4'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center", backgroundSize: "11px",
};

// 18,5M para el país, 385k para dos comunas, 8.412 para una comuna chica:
// "0.4M" no se lee en una tarjeta de 70 px. `ref` fija la escala, para que
// población, hombres y mujeres se lean en la misma unidad.
function cifraCorta(n: number, ref = n): string {
  if (ref >= 1_000_000) return (n / 1_000_000).toLocaleString("es-CL", { maximumFractionDigits: 1 }) + "M";
  if (ref >= 100_000) return Math.round(n / 1_000).toLocaleString("es-CL") + "k";
  return n.toLocaleString("es-CL");
}

export default function PanelIzquierdo({
  farmacias, farmaciasSinCadena, demografia, comunasDisponibles, regionesDisponibles,
  filtros, onChange, uploadedFiles, onRemoveFile,
}: Props) {
  const hayFiltros = filtros.cadenas.length > 0 || filtros.region || filtros.comuna;

  const datosCadena = useMemo(() => {
    const conteo: Record<string, number> = {};
    for (const c of CADENAS) conteo[c] = 0;
    for (const f of farmaciasSinCadena) {
      if (conteo[f.cadena] !== undefined) conteo[f.cadena]++;
      else conteo["Otra"]++;
    }
    return CADENAS
      .map((c) => ({ nombre: c, cantidad: conteo[c] ?? 0, color: COLORES_CADENA[c] }))
      .filter((d) => d.cantidad > 0)
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [farmaciasSinCadena]);

  // El censo es nacional; la base de farmacias puede ser una muestra y además
  // estar filtrada por región o comuna. El universo demográfico son las
  // comunas (por CUT) de las farmacias que pasan esos filtros. No depende del
  // filtro de cadena: la población de una zona no cambia según la marca.
  const cutsZona = useMemo(
    () => new Set(farmaciasSinCadena.map((f) => f.cod_comuna).filter((c): c is number => c != null)),
    [farmaciasSinCadena],
  );

  const resumenDemo = useMemo(() => {
    const cuts = cutsZona;
    const universo = demografia.filter((d) => cuts.has(Number(d.cod_comuna)));
    if (!universo.length) return null;
    let poblacion = 0, hombres = 0, mujeres = 0;
    let e0_14 = 0, e15_29 = 0, e30_44 = 0, e45_59 = 0, e60 = 0;
    for (const d of universo) {
      poblacion += d.poblacion; hombres += d.hombres; mujeres += d.mujeres;
      e0_14 += d.edad_0_14; e15_29 += d.edad_15_29;
      e30_44 += d.edad_30_44; e45_59 += d.edad_45_59; e60 += d.edad_60_mas;
    }
    const total = e0_14 + e15_29 + e30_44 + e45_59 + e60 || 1;
    return {
      poblacion, hombres, mujeres, comunas: universo.length,
      etaria: [
        { r: "0-14",  pct: Math.round((e0_14  / total) * 100), color: "#22c55e" },
        { r: "15-29", pct: Math.round((e15_29 / total) * 100), color: "#3b82f6" },
        { r: "30-44", pct: Math.round((e30_44 / total) * 100), color: "#8b5cf6" },
        { r: "45-59", pct: Math.round((e45_59 / total) * 100), color: "#f59e0b" },
        { r: "60+",   pct: Math.round((e60    / total) * 100), color: "#ef4444" },
      ],
    };
  }, [demografia, cutsZona]);

  // GSE AIM 2023 de la zona filtrada: mismo universo de comunas que el censo
  const gseAim = useGseAim();
  const nseZona = useMemo(() => {
    const hogaresPorCut = new Map(demografia.map((d) => [Number(d.cod_comuna), d.hogares]));
    return gseEnComunas(gseAim, hogaresPorCut, cutsZona);
  }, [gseAim, demografia, cutsZona]);

  const kpis = useMemo(() => ({
    farmacias: farmacias.length,
    comunas:   new Set(farmacias.map((f) => f.comuna)).size,
    regiones:  new Set(farmacias.map((f) => f.region)).size,
    cadenas:   new Set(farmacias.map((f) => f.cadena)).size,
  }), [farmacias]);

  const secTitle: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, letterSpacing: "0.07em", color: C.text3,
    textTransform: "uppercase", marginBottom: 0,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto", background: C.bg }}>

      {/* Filtros */}
      <section style={{ padding: "14px 14px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>Filtros</span>
          {hayFiltros && (
            <button
              onClick={() => onChange({ cadenas: [], region: "", comuna: "" })}
              style={{ fontSize: 10, color: C.accentText, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
            >
              Limpiar todo
            </button>
          )}
        </div>

        {/* Chips de filtros activos: qué está filtrado, visible de un vistazo */}
        {hayFiltros && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
            {filtros.region && (
              <span className="rl-chip" title={`Región: ${filtros.region}`}>
                <span>{filtros.region}</span>
                <button aria-label={`Quitar filtro región ${filtros.region}`} onClick={() => onChange({ ...filtros, region: "" })}>×</button>
              </span>
            )}
            {filtros.comuna && (
              <span className="rl-chip" title={`Comuna: ${filtros.comuna}`}>
                <span>{filtros.comuna}</span>
                <button aria-label={`Quitar filtro comuna ${filtros.comuna}`} onClick={() => onChange({ ...filtros, comuna: "" })}>×</button>
              </span>
            )}
            {filtros.cadenas.map((c) => (
              <span key={c} className="rl-chip" title={`Cadena: ${c}`}>
                <span>{c}</span>
                <button aria-label={`Quitar filtro cadena ${c}`} onClick={() => onChange({ ...filtros, cadenas: filtros.cadenas.filter((x) => x !== c) })}>×</button>
              </span>
            ))}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { label: "Región", key: "region", opts: regionesDisponibles, ph: "Todas las regiones" },
            { label: "Comuna", key: "comuna", opts: comunasDisponibles,  ph: "Todas las comunas"  },
          ].map(({ label, key, opts, ph }) => (
            <div key={key}>
              <label style={labelSt}>{label}</label>
              <select
                style={selSt}
                value={filtros[key as "region" | "comuna"]}
                onChange={(e) => onChange({ ...filtros, [key]: e.target.value })}
              >
                <option value="">{ph}</option>
                {opts.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
      </section>

      <div style={{ borderTop: `1px solid ${C.border}` }} />

      {/* Capas cargadas */}
      {uploadedFiles.length > 0 && (
        <>
          <section style={{ padding: "12px 14px 10px" }}>
            <div style={{ ...secTitle, marginBottom: 8 }}>Capas cargadas</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {uploadedFiles.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 8px", background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8A92A3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span style={{ fontSize: 10.5, color: C.text2 }}>{f.name}</span>
                  </div>
                  <button onClick={() => onRemoveFile(i)} style={{ background: "none", border: "none", cursor: "pointer", color: C.text3, padding: 2 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              ))}
            </div>
          </section>
          <div style={{ borderTop: `1px solid ${C.border}` }} />
        </>
      )}

      {/* Gráfico cadenas — multiselect interactivo */}
      <section style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={secTitle}>Farmacias por cadena</div>
          {filtros.cadenas.length > 0 && (
            <button
              onClick={() => onChange({ ...filtros, cadenas: [] })}
              style={{ fontSize: 9, color: C.accentText, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
            >
              Limpiar ({filtros.cadenas.length})
            </button>
          )}
        </div>
        <HBarChart
          data={datosCadena}
          selected={filtros.cadenas}
          onToggle={(nombre) => {
            const cadenas = filtros.cadenas.includes(nombre)
              ? filtros.cadenas.filter((c) => c !== nombre)
              : [...filtros.cadenas, nombre];
            onChange({ ...filtros, cadenas });
          }}
        />
      </section>

      <div style={{ borderTop: `1px solid ${C.border}` }} />

      {/* KPIs */}
      <section style={{ padding: "12px 14px" }}>
        <div style={{ ...secTitle, marginBottom: 8 }}>Resumen</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {[
            { label: "Farmacias", val: kpis.farmacias.toLocaleString("es-CL") },
            { label: "Comunas",   val: kpis.comunas },
            { label: "Regiones",  val: kpis.regiones },
            { label: "Cadenas",   val: kpis.cadenas },
          ].map(({ label, val }) => (
            <div key={label} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <div className="num" style={{ fontSize: 17, fontWeight: 700, color: C.text, lineHeight: 1.1 }}>{val}</div>
              <div style={{ fontSize: 10, color: C.text3, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ borderTop: `1px solid ${C.border}` }} />

      {/* Demografía */}
      <section style={{ padding: "12px 14px 16px" }}>
        <div style={{ ...secTitle, marginBottom: 8 }}>
          Demografía — Censo 2024
          {resumenDemo && <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0 }}> · {resumenDemo.comunas} {resumenDemo.comunas === 1 ? "comuna" : "comunas"}</span>}
        </div>
        {resumenDemo ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, marginBottom: 10 }}>
              {[
                { l: "Población", v: cifraCorta(resumenDemo.poblacion) },
                { l: "Hombres",   v: cifraCorta(resumenDemo.hombres, resumenDemo.poblacion) },
                { l: "Mujeres",   v: cifraCorta(resumenDemo.mujeres, resumenDemo.poblacion) },
              ].map(({ l, v }) => (
                <div key={l} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 5px", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                  <div className="num" style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{v}</div>
                  <div style={{ fontSize: 9, color: C.text3, marginTop: 1 }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: C.text3, textTransform: "uppercase", marginBottom: 7 }}>Distribución etaria</div>
            {resumenDemo.etaria.map(({ r, pct, color }) => (
              <div key={r} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                <span style={{ fontSize: 10, color: C.text2, width: 26, flexShrink: 0 }}>{r}</span>
                <div style={{ flex: 1, height: 6, background: C.bg2, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${pct * 4.2}%`, height: "100%", background: color, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 10, color: C.text3, width: 22, textAlign: "right" }}>{pct}%</span>
              </div>
            ))}
          </>
        ) : (
          <p style={{ fontSize: 11, color: C.text3, fontStyle: "italic" }}>Sin datos demográficos</p>
        )}
      </section>

      <div style={{ borderTop: `1px solid ${C.border}` }} />

      {/* Nivel socioeconómico — GSE AIM por comuna, ponderado por hogares */}
      <section style={{ padding: "12px 14px 16px" }}>
        <div style={{ ...secTitle, marginBottom: 8 }}>
          Nivel socioeconómico
          <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0 }}> · % de hogares</span>
        </div>
        {nseZona.hogaresConDato > 0 ? (
          <>
            <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", marginBottom: 9 }}>
              {nseZona.data.map((g) => (
                <div key={g.name} title={`${g.name}: ${(g.pct * 100).toLocaleString("es-CL", { maximumFractionDigits: 1 })}%`}
                  style={{ width: `${g.pct * 100}%`, background: COLOR_NSE[g.name] }} />
              ))}
            </div>
            {nseZona.data.map((g) => (
              <div key={g.name} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: COLOR_NSE[g.name], flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: C.text2, width: 26, flexShrink: 0 }}>{g.name}</span>
                <div style={{ flex: 1, height: 6, background: C.bg2, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${g.pct * 100}%`, height: "100%", background: COLOR_NSE[g.name], borderRadius: 3 }} />
                </div>
                <span className="num" style={{ fontSize: 10, color: C.text3, width: 34, textAlign: "right" }}>
                  {(g.pct * 100).toLocaleString("es-CL", { maximumFractionDigits: 1 })}%
                </span>
              </div>
            ))}
            {nseZona.comunasSinDato > 0 && (
              <p style={{ fontSize: 9.5, color: C.text3, margin: "6px 0 0" }}>
                {nseZona.comunasSinDato} {nseZona.comunasSinDato === 1 ? "comuna" : "comunas"} sin dato AIM, fuera del %.
              </p>
            )}
            <p style={{ fontSize: 9.5, color: C.text3, margin: "6px 0 0", lineHeight: 1.35 }}>
              GSE AIM Chile 2023 (Casen 2017+2022) por comuna, ponderado por hogares del Censo 2024.
            </p>
          </>
        ) : (
          <p style={{ fontSize: 11, color: C.text3, fontStyle: "italic" }}>Sin datos NSE</p>
        )}
      </section>
    </div>
  );
}
