import { useMemo, useState } from "react";
import { COLORES_CADENA, MESES_CORTO } from "../constants";
import { CadenaFarmaceutica } from "../types";
import { useMovimientos } from "../hooks/useMovimientos";

const ZONAS = ["Norte", "V Región", "RM", "Sur"] as const;
type Zona = typeof ZONAS[number];

// Las 4 cadenas con más movimiento en el registro (corte 2026-08).
const CADENAS = ["Cruz Verde", "Salcobrand", "Ahumada", "Dr. Simi"] as const;

// Tokens de marca REALI (diseño/paleta.md)
const C = {
  bg: "#F4F1EA", bg2: "#EAE6DA", bgCard: "#FDFCFA", border: "#E3DFD3", border2: "#CBC5B5",
  text: "#0B1A2E", text2: "#3E4A61", text3: "#5D6880",
  accent: "#F5A524", accentText: "#9A6206",
};

// "#00A651" → "0,166,81", para los fondos translúcidos por cadena.
const rgbDe = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",");

// "2026-08" → "AGO 2026"
const etiquetaMes = (aaaamm: string) =>
  `${MESES_CORTO[Number(aaaamm.slice(5, 7)) - 1]} ${aaaamm.slice(0, 4)}`;

/**
 * Región corta (REGIONES_CHILE) → macrozona de la tabla. Todo lo que queda al
 * norte de la RM es Norte y todo lo que queda al sur es Sur; Valparaíso y la RM
 * van aparte. Se clasifica por región y no por la latitud de cada punto: un
 * geocode malo no debe cambiar de zona una apertura.
 * Las 16 regiones van explícitas: una grafía nueva devuelve null, no cae en
 * una zona por defecto.
 */
const ZONA_POR_REGION: Record<string, Zona> = {
  "Arica y Parinacota": "Norte",
  "Tarapacá":           "Norte",
  "Antofagasta":        "Norte",
  "Atacama":            "Norte",
  "Coquimbo":           "Norte",
  "Valparaíso":         "V Región",
  "Metropolitana":      "RM",
  "O'Higgins":          "Sur",
  "Maule":              "Sur",
  "Ñuble":              "Sur",
  "Biobío":             "Sur",
  "La Araucanía":       "Sur",
  "Los Ríos":           "Sur",
  "Los Lagos":          "Sur",
  "Aysén":              "Sur",
  "Magallanes":         "Sur",
};

function zonaDeRegion(region: string): Zona | null {
  return ZONA_POR_REGION[region] ?? null;
}

interface ItemZona { n: string; c: string; f: string; }

export default function PageCadenas() {
  const movimientos = useMovimientos();

  const anios = useMemo(
    () => [...new Set(movimientos.map((m) => Number(m.mes_deteccion.slice(0, 4))))].sort(),
    [movimientos],
  );
  const [anio, setAnio] = useState(() => anios[anios.length - 1] ?? new Date().getFullYear());

  // "Nuevo" = detectado en el último corte. No el mes calendario: el registro
  // publica con rezago y el mes en curso casi nunca tiene corte todavía.
  const ULTIMO_CORTE = useMemo(() => {
    const u = movimientos.reduce((max, m) => (m.mes_deteccion > max ? m.mes_deteccion : max), "");
    return u ? etiquetaMes(u) : "";
  }, [movimientos]);

  const porZona = useMemo(() => {
    const out = {} as Record<Zona, Record<string, ItemZona[]>>;
    for (const z of ZONAS) out[z] = {};
    for (const m of movimientos) {
      if (m.movimiento !== "apertura" || !m.mes_deteccion.startsWith(`${anio}-`)) continue;
      const zona = zonaDeRegion(m.region);
      if (!zona) continue;
      (out[zona][m.cadena] ??= []).push({
        n: m.direccion || m.nombre,
        c: m.comuna,
        f: etiquetaMes(m.mes_deteccion),
      });
    }
    return out;
  }, [movimientos, anio]);

  const totales = CADENAS.map((c) => ({
    cadena: c,
    total: ZONAS.reduce((s, z) => s + (porZona[z][c]?.length ?? 0), 0),
  }));

  const thSt: React.CSSProperties = {
    padding: "10px 14px", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.07em",
    textTransform: "uppercase", color: C.text3, borderBottom: `1px solid ${C.border}`,
    background: "#F4F1EA",
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: C.bg }}>
      {/* Toolbar */}
      <div style={{ padding: "10px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0, background: C.bgCard }}>
        <span style={{ fontSize: 11, color: C.text3, marginRight: 2 }}>Año:</span>
        {anios.map((a) => (
          <button
            key={a}
            onClick={() => setAnio(a)}
            className="rl-hover"
            style={{ padding: "4px 13px", borderRadius: 6, fontSize: 11, fontWeight: anio === a ? 700 : 500, cursor: "pointer", border: `1px solid ${anio === a ? C.accent : C.border}`, background: anio === a ? C.accent : "transparent", color: anio === a ? C.text : C.text2 }}
          >
            {a}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {totales.map(({ cadena, total }) => (
          <div key={cadena} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 14px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORES_CADENA[cadena as CadenaFarmaceutica], display: "inline-block" }} />
            <span style={{ fontSize: 11, color: C.text2 }}>{cadena}</span>
            <span className="num" style={{ fontSize: 14, fontWeight: 700, color: C.text, marginLeft: 4 }}>{total}</span>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, background: C.bgCard, borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: `1px solid ${C.border}` }}>
          <thead>
            <tr>
              <th style={{ ...thSt, width: 90, textAlign: "left", borderRight: `1px solid ${C.border}` }} />
              {CADENAS.map((c) => (
                <th key={c} colSpan={2} style={{ ...thSt, textAlign: "center", borderLeft: `1px solid ${C.border}`, fontSize: 12, fontWeight: 700, color: COLORES_CADENA[c as CadenaFarmaceutica], letterSpacing: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: COLORES_CADENA[c as CadenaFarmaceutica], display: "inline-block" }} />
                    {c}
                  </div>
                </th>
              ))}
            </tr>
            <tr>
              <th style={{ ...thSt, borderRight: `1px solid ${C.border}` }} />
              {CADENAS.map((c) => (
                <>
                  <th key={`${c}-s`} style={{ ...thSt, borderLeft: `1px solid ${C.border}` }}>Sucursal · Comuna</th>
                  <th key={`${c}-f`} style={{ ...thSt, whiteSpace: "nowrap" }}>Fecha</th>
                </>
              ))}
            </tr>
          </thead>
          <tbody>
            {ZONAS.map((zona) => {
              const maxRows = Math.max(...CADENAS.map((c) => porZona[zona][c]?.length ?? 0), 1);
              return Array.from({ length: maxRows }).map((_, ri) => (
                <tr key={`${zona}-${ri}`} style={{ background: ri % 2 === 0 ? C.bgCard : C.bg }}>
                  {ri === 0 && (
                    <td
                      rowSpan={maxRows}
                      style={{ padding: "12px 14px", verticalAlign: "middle", fontWeight: 700, fontSize: 11.5, color: C.accentText, letterSpacing: "0.04em", textTransform: "uppercase", borderBottom: `2px solid ${C.border}`, borderRight: `1px solid ${C.border}` }}
                    >
                      {zona}
                    </td>
                  )}
                  {CADENAS.map((c) => {
                    const items = porZona[zona][c] ?? [];
                    const item = items[ri];
                    const isLast = ri === maxRows - 1;
                    const col = COLORES_CADENA[c as CadenaFarmaceutica];
                    const rgb = rgbDe(col);
                    const esMesActual = item?.f === ULTIMO_CORTE;
                    return (
                      <>
                        <td
                          key={`${c}-n`}
                          style={{
                            padding: "9px 12px",
                            borderLeft: `3px solid ${item ? (esMesActual ? "#F5A524" : col) : "transparent"}`,
                            borderBottom: isLast ? `2px solid ${C.border}` : `1px solid ${C.border}`,
                            background: esMesActual ? "rgba(245,165,36,0.10)" : item ? `rgba(${rgb},0.04)` : "transparent",
                          }}
                        >
                          {item && (
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
                              <div>
                                <div style={{ color: C.text, fontWeight: 600, fontSize: 11.5, lineHeight: 1.3 }}>{item.n}</div>
                                <div style={{ fontSize: 10, color: C.text3, marginTop: 2 }}>{item.c}</div>
                              </div>
                              {esMesActual && (
                                <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, background: "rgba(245,165,36,0.16)", color: "#7A5205", border: "1px solid rgba(201,132,16,0.4)", borderRadius: 4, padding: "1px 5px", marginTop: 1 }}>NUEVO</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td
                          key={`${c}-f`}
                          style={{
                            padding: "9px 10px",
                            borderBottom: isLast ? `2px solid ${C.border}` : `1px solid ${C.border}`,
                            background: esMesActual ? "rgba(245,165,36,0.10)" : item ? `rgba(${rgb},0.04)` : "transparent",
                          }}
                        >
                          {item && (
                            <span style={{
                              display: "inline-block", padding: "2px 8px", borderRadius: 5, fontWeight: 600, fontSize: 10,
                              background: esMesActual ? "rgba(245,165,36,0.16)" : `rgba(${rgb},0.1)`,
                              color: esMesActual ? "#7A5205" : col,
                              border: esMesActual ? "1px solid rgba(201,132,16,0.4)" : "none",
                            }}>
                              {item.f}
                            </span>
                          )}
                        </td>
                      </>
                    );
                  })}
                </tr>
              ));
            })}
            {/* Total row */}
            <tr style={{ background: C.bg2 }}>
              <td style={{ padding: "11px 14px", fontWeight: 700, fontSize: 10, color: C.text3, textTransform: "uppercase", letterSpacing: "0.07em", borderTop: `1px solid ${C.border2}` }}>TOTAL</td>
              {CADENAS.map((c) => {
                const t = ZONAS.reduce((s, z) => s + (porZona[z][c]?.length ?? 0), 0);
                return (
                  <td key={c} colSpan={2} style={{ padding: "11px 14px", textAlign: "center", fontWeight: 700, fontSize: 19, fontFamily: "var(--font-mono)", color: COLORES_CADENA[c as CadenaFarmaceutica], borderLeft: `1px solid ${C.border}`, borderTop: `1px solid ${C.border2}` }}>
                    {t}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
