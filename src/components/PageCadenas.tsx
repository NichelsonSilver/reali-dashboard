import { useState } from "react";
import { COLORES_CADENA, MESES_CORTO, MOCK_ZONAS } from "../constants";
import { CadenaFarmaceutica } from "../types";

const ZONAS = ["Norte", "V Región", "RM", "Sur"];
const CADENAS = ["Ahumada", "Salcobrand", "Cruz Verde"] as const;

// Tokens de marca REALI (diseño/paleta.md)
const C = {
  bg: "#F4F1EA", bg2: "#EAE6DA", bgCard: "#FDFCFA", border: "#E3DFD3", border2: "#CBC5B5",
  text: "#0B1A2E", text2: "#3E4A61", text3: "#5D6880",
  accent: "#F5A524", accentText: "#9A6206",
};

const CADENA_RGB: Record<string, string> = {
  "Ahumada":    "227,25,55",
  "Salcobrand": "0,85,165",
  "Cruz Verde": "0,166,81",
};

export default function PageCadenas() {
  const [anio, setAnio] = useState(2026);

  const HOY = new Date();
  const MES_ACTUAL = `${MESES_CORTO[HOY.getMonth()]} ${HOY.getFullYear()}`;

  const totales = CADENAS.map((c) => ({
    cadena: c,
    total: ZONAS.reduce((s, z) => s + (MOCK_ZONAS[z]?.[c]?.length ?? 0), 0),
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
        {[2024, 2025, 2026].map((a) => (
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
              const maxRows = Math.max(...CADENAS.map((c) => MOCK_ZONAS[zona]?.[c]?.length ?? 0), 1);
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
                    const items = MOCK_ZONAS[zona]?.[c] ?? [];
                    const item = items[ri];
                    const isLast = ri === maxRows - 1;
                    const col = COLORES_CADENA[c as CadenaFarmaceutica];
                    const rgb = CADENA_RGB[c] ?? "100,116,139";
                    const esMesActual = item?.f === MES_ACTUAL;
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
                const t = ZONAS.reduce((s, z) => s + (MOCK_ZONAS[z]?.[c]?.length ?? 0), 0);
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
