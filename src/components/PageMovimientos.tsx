import { useMemo, useState } from "react";
import { COLORES_CADENA, MESES_CORTO } from "../constants";
import { CadenaFarmaceutica, MovimientoFarmacia } from "../types";
import { useMovimientos } from "../hooks/useMovimientos";

// Tokens de marca REALI + semánticos data viz (diseño/paleta.md)
const C = {
  bg: "#F4F1EA", bg2: "#EAE6DA", bgCard: "#FDFCFA", border: "#E3DFD3", border2: "#CBC5B5",
  text: "#0B1A2E", text2: "#3E4A61", text3: "#5D6880",
  accent: "#F5A524", green: "#2D8A6B", red: "#C13B3B",
};

const netoColor = (n: number) => n > 0 ? C.green : n < 0 ? C.red : C.text3;

// Marcas sin cadena al final: su volumen tapa a las cadenas, que es lo que se compara.
const AL_FINAL = new Set<string>(["Independiente", "Otra"]);

export interface ItemMovimiento { n: string; c: string; }
// `medido`: el mes tiene corte. Sin corte, "0" y "no se midió" no son lo mismo.
export interface MesMovimiento { mes: number; medido: boolean; ap: ItemMovimiento[]; ci: ItemMovimiento[]; }

const item = (m: MovimientoFarmacia): ItemMovimiento =>
  ({ n: `${m.nombre} · ${m.direccion}`, c: m.comuna });

export default function PageMovimientos() {
  const movimientos = useMovimientos();

  // El diff solo existe desde el primer par de cortes: lo que queda fuera de
  // [primer, último] mes detectado no se midió.
  const { anios, primero, ultimo } = useMemo(() => {
    const meses = [...new Set(movimientos.map((m) => m.mes_deteccion))].sort();
    return {
      anios: [...new Set(meses.map((m) => Number(m.slice(0, 4))))],
      primero: meses[0] ?? "",
      ultimo: meses[meses.length - 1] ?? "",
    };
  }, [movimientos]);

  const [anio, setAnio] = useState(() => anios[anios.length - 1] ?? new Date().getFullYear());
  const [exp, setExp] = useState<Record<string, boolean>>({});

  const toggle = (k: string) => setExp((e) => ({ ...e, [k]: !e[k] }));

  const datos = useMemo(() => {
    const delAnio = movimientos.filter((m) => m.mes_deteccion.startsWith(`${anio}-`));
    const cadenas = [...new Set(delAnio.map((m) => m.cadena))];
    const total = (c: string) => delAnio.filter((m) => m.cadena === c).length;
    cadenas.sort((a, b) =>
      Number(AL_FINAL.has(a)) - Number(AL_FINAL.has(b)) || total(b) - total(a) || a.localeCompare(b));

    return cadenas.map((cadena) => {
      const ms: MesMovimiento[] = MESES_CORTO.map((_, i) => {
        const clave = `${anio}-${String(i + 1).padStart(2, "0")}`;
        const delMes = delAnio.filter((m) => m.cadena === cadena && m.mes_deteccion === clave);
        return {
          mes: i,
          medido: clave >= primero && clave <= ultimo,
          ap: delMes.filter((m) => m.movimiento === "apertura").map(item),
          ci: delMes.filter((m) => m.movimiento === "cierre").map(item),
        };
      });
      const totAp = ms.reduce((s, m) => s + m.ap.length, 0);
      const totCi = ms.reduce((s, m) => s + m.ci.length, 0);
      return { cadena, ms, totAp, totCi, neto: totAp - totCi };
    });
  }, [movimientos, anio, primero, ultimo]);

  const thSt: React.CSSProperties = {
    padding: "9px 10px", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.07em",
    color: C.text3, textTransform: "uppercase", borderBottom: `1px solid ${C.border}`,
    background: "#F4F1EA", whiteSpace: "nowrap", textAlign: "left",
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
        <span style={{ fontSize: 10.5, color: C.text3, marginLeft: 8 }}>
          Mes de <b>detección</b> en el registro MINSAL, no de inauguración
          {ultimo && <> · último corte {MESES_CORTO[Number(ultimo.slice(5)) - 1]} {ultimo.slice(0, 4)}</>}
        </span>
        <div style={{ flex: 1 }} />
        {datos.slice(0, 4).map((d) => (
          <div key={d.cadena} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 12px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: COLORES_CADENA[d.cadena as CadenaFarmaceutica], display: "inline-block" }} />
            <span style={{ fontSize: 11, color: C.text2 }}>{d.cadena}</span>
            <span className="num" style={{ fontSize: 12.5, color: netoColor(d.neto), fontWeight: 700, marginLeft: 3 }}>{d.neto > 0 ? "+" : ""}{d.neto}</span>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div style={{ flex: 1, overflowX: "auto", overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 960 }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
            <tr>
              <th style={{ ...thSt, width: 120, borderRight: `1px solid ${C.border}` }}>Cadena</th>
              <th style={{ ...thSt, width: 90, borderRight: `1px solid ${C.border}` }}>Movimiento</th>
              {MESES_CORTO.map((m) => (
                <th key={m} style={{ ...thSt, textAlign: "center", minWidth: 64, borderRight: `1px solid ${C.bg2}` }}>{m}</th>
              ))}
              <th style={{ ...thSt, textAlign: "center", minWidth: 60 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {datos.length === 0 && (
              <tr>
                <td colSpan={MESES_CORTO.length + 3} style={{ padding: 40, textAlign: "center", color: C.text3, fontSize: 12 }}>
                  Sin movimientos detectados en {anio}.
                </td>
              </tr>
            )}
            {datos.map(({ cadena, ms, totAp, totCi, neto }) => (
              <MovimientoRows
                key={cadena}
                cadena={cadena}
                ms={ms}
                totAp={totAp}
                totCi={totCi}
                neto={neto}
                exp={exp}
                toggle={toggle}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const SIN_CORTE_BG = "repeating-linear-gradient(135deg, transparent 0 4px, rgba(203,197,181,0.25) 4px 5px)";

function SinCorte() {
  return <span title="Mes sin corte medido: el diff del registro empieza después" style={{ color: C.border2, fontSize: 12 }}>·</span>;
}

function MovimientoRows({
  cadena, ms, totAp, totCi, neto, exp, toggle,
}: {
  cadena: string;
  ms: MesMovimiento[];
  totAp: number; totCi: number; neto: number;
  exp: Record<string, boolean>;
  toggle: (k: string) => void;
}) {
  const col = COLORES_CADENA[cadena as CadenaFarmaceutica] ?? "#64748b";
  const C = {
    bg: "#F4F1EA", bg2: "#EAE6DA", bgCard: "#FDFCFA", border: "#E3DFD3", border2: "#CBC5B5",
    text: "#0B1A2E", text2: "#3E4A61", text3: "#5D6880",
    green: "#2D8A6B", red: "#C13B3B",
  };
  const netoColor = (n: number) => n > 0 ? C.green : n < 0 ? C.red : C.text3;

  return (
    <>
      {/* Aperturas */}
      <tr style={{ background: C.bgCard }}>
        <td rowSpan={3} style={{ padding: "0 14px", verticalAlign: "middle", borderRight: `1px solid ${C.border}`, borderBottom: `2px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: col, flexShrink: 0, display: "inline-block" }} />
            <span style={{ fontWeight: 600, color: C.text, fontSize: 12 }}>{cadena}</span>
          </div>
        </td>
        <td style={{ padding: "8px 10px", fontWeight: 600, fontSize: 11, color: C.green, borderRight: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>▲ Aperturas</td>
        {ms.map((m, i) => {
          const items = m.ap ?? [];
          const key = `${cadena}-${i}-ap`;
          return (
            <td key={i} style={{ padding: "6px 4px", textAlign: "center", borderRight: `1px solid ${C.bg2}`, verticalAlign: "top", background: m.medido ? undefined : SIN_CORTE_BG }}>
              {items.length > 0 ? (
                <div>
                  <button onClick={() => toggle(key)} className="badge-ap">{items.length}</button>
                  {exp[key] && (
                    <div style={{ marginTop: 4, textAlign: "left" }}>
                      {items.map((a, j) => (
                        <div key={j} style={{ fontSize: 10, padding: "3px 0", borderTop: j > 0 ? `1px solid ${C.border}` : "none" }}>
                          <div style={{ color: C.text, fontWeight: 500, lineHeight: 1.3 }}>{a.n}</div>
                          <div style={{ color: C.text3 }}>{a.c}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : m.medido ? <span style={{ color: C.border2, fontSize: 12 }}>—</span> : <SinCorte />}
            </td>
          );
        })}
        <td className="num" style={{ padding: "6px 10px", textAlign: "center", fontWeight: 700, color: C.green, fontSize: 14 }}>{totAp}</td>
      </tr>

      {/* Cierres */}
      <tr style={{ background: C.bg }}>
        <td style={{ padding: "8px 10px", fontWeight: 600, fontSize: 11, color: C.red, borderRight: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>▼ Cierres</td>
        {ms.map((m, i) => {
          const items = m.ci ?? [];
          const key = `${cadena}-${i}-ci`;
          return (
            <td key={i} style={{ padding: "6px 4px", textAlign: "center", borderRight: `1px solid ${C.bg2}`, verticalAlign: "top", background: m.medido ? undefined : SIN_CORTE_BG }}>
              {items.length > 0 ? (
                <div>
                  <button onClick={() => toggle(key)} className="badge-ci">{items.length}</button>
                  {exp[key] && (
                    <div style={{ marginTop: 4, textAlign: "left" }}>
                      {items.map((c, j) => (
                        <div key={j} style={{ fontSize: 10, padding: "3px 0", borderTop: j > 0 ? `1px solid ${C.border}` : "none" }}>
                          <div style={{ color: C.text, fontWeight: 500, lineHeight: 1.3 }}>{c.n}</div>
                          <div style={{ color: C.text3 }}>{c.c}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : m.medido ? <span style={{ color: C.border2, fontSize: 12 }}>—</span> : <SinCorte />}
            </td>
          );
        })}
        <td className="num" style={{ padding: "6px 10px", textAlign: "center", fontWeight: 700, color: C.red, fontSize: 14 }}>{totCi}</td>
      </tr>

      {/* Neto */}
      <tr style={{ background: "#F4F1EA", borderBottom: `2px solid ${C.border}` }}>
        <td style={{ padding: "5px 10px", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: C.text3, borderRight: `1px solid ${C.border}` }}>Neto</td>
        {ms.map((m, i) => {
          const n = (m.ap?.length ?? 0) - (m.ci?.length ?? 0);
          return (
            <td key={i} className="num" style={{ padding: "5px 4px", textAlign: "center", fontWeight: 700, fontSize: 11.5, borderRight: `1px solid ${C.bg2}`, color: netoColor(n) }}>
              {!m.medido ? <SinCorte /> : n > 0 ? `+${n}` : n === 0 ? "—" : n}
            </td>
          );
        })}
        <td className="num" style={{ padding: "5px 10px", textAlign: "center", fontWeight: 700, fontSize: 15, color: netoColor(neto) }}>
          {neto > 0 ? `+${neto}` : neto}
        </td>
      </tr>
    </>
  );
}
