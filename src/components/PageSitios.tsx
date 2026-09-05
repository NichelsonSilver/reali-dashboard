// Página "Evaluar Sitio": dirección → dosier territorial imprimible (Ctrl+P → PDF).
// Orquesta el motor territorial, análogos, canibalización y scoring, y arma
// el dosier con mapa de entorno, imagen satelital (Esri) y foto de fachada
// (Mapillary si hay token VITE_MAPILLARY_TOKEN, o subida manual).

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Circle, CircleMarker, Tooltip } from "react-leaflet";
import { Farmacia } from "../types";
import { COLORES_CADENA } from "../constants";
import { geocodificar, ResultadoGeocode } from "../utils/geocodificar";
import {
  GRUPOS_NSE, GrupoNSE, Punto, VectorSitio, calcularVectorSitio, RADIOS_M,
} from "../utils/territorio";
import {
  RasgosSitio, TiendaConVenta, PrediccionVenta, rasgosDesdeVector,
  simularVentasCadena, seleccionarAnalogos, predecirVenta,
} from "../utils/analogos";
import { ResultadoCanibalizacion, predecirCanibalizacion } from "../utils/canibalizacion";
import { ScoreSitio, calcularScore } from "../utils/scoring";
import { useCapaNSE, useManzanasRM, Manzanas } from "../hooks/useGeoCapas";

const CADENA_CLIENTE = "Cruz Verde" as const;

const COLOR_NSE: Record<GrupoNSE, string> = {
  AB: "#1d4ed8", C1a: "#2563eb", C1b: "#60a5fa",
  C2: "#7c3aed", C3: "#f59e0b", D: "#ef4444", E: "#6b7280",
};

// Pool de tiendas con venta simulada — costoso de calcular, se cachea por sesión.
let poolCache: TiendaConVenta[] | null = null;

interface Evaluacion {
  sitio: ResultadoGeocode;
  vector: VectorSitio;
  rasgos: RasgosSitio;
  prediccion: PrediccionVenta | null;
  canibalizacion: ResultadoCanibalizacion;
  score: ScoreSitio;
}

const fmtCLP = (v: number) => `$${(v / 1e6).toLocaleString("es-CL", { maximumFractionDigits: 1 })} M`;
const fmtPct = (v: number) => `${Math.round(v * 100)}%`;

// ── Imagen satelital (Esri World Imagery export, sin API key) ────────────────

function urlSatelital(p: Punto, radioM: number, w = 640, h = 420): string {
  const dLat = radioM / 111320;
  const dLon = radioM / (111320 * Math.cos((p.lat * Math.PI) / 180));
  const bbox = [p.lon - dLon, p.lat - dLat, p.lon + dLon, p.lat + dLat].join(",");
  return (
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export" +
    `?bbox=${bbox}&bboxSR=4326&imageSR=3857&size=${w},${h}&format=jpg&f=image`
  );
}

// ── Foto de fachada vía Mapillary (gratis, requiere token) ───────────────────

function useFotoMapillary(sitio: Punto | null) {
  const [url, setUrl] = useState<string | null>(null);
  const token = import.meta.env.VITE_MAPILLARY_TOKEN as string | undefined;
  useEffect(() => {
    setUrl(null);
    if (!sitio || !token) return;
    const d = 0.0012; // ~130 m alrededor del sitio
    const bbox = [sitio.lon - d, sitio.lat - d, sitio.lon + d, sitio.lat + d].join(",");
    fetch(
      `https://graph.mapillary.com/images?access_token=${token}&bbox=${bbox}&fields=id,thumb_1024_url&limit=1`,
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => setUrl(j.data?.[0]?.thumb_1024_url ?? null))
      .catch(() => setUrl(null));
  }, [sitio?.lat, sitio?.lon, token]);
  return url;
}

// ── Componentes de UI del dosier ─────────────────────────────────────────────

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 22, breakInside: "avoid" }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#0B1A2E", borderBottom: "2px solid #0B1A2E", paddingBottom: 4, marginBottom: 10 }}>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function BarraMixNSE({ mix }: { mix: Record<GrupoNSE, number> }) {
  return (
    <div>
      <div style={{ display: "flex", height: 22, borderRadius: 4, overflow: "hidden" }}>
        {GRUPOS_NSE.filter((g) => mix[g] > 0.005).map((g) => (
          <div key={g} title={`${g}: ${fmtPct(mix[g])}`} style={{ width: `${mix[g] * 100}%`, background: COLOR_NSE[g] }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
        {GRUPOS_NSE.filter((g) => mix[g] > 0.005).map((g) => (
          <span key={g} style={{ fontSize: 10.5, color: "#3E4A61", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: COLOR_NSE[g], display: "inline-block" }} />
            {g} {fmtPct(mix[g])}
          </span>
        ))}
      </div>
    </div>
  );
}

const celda: React.CSSProperties = { padding: "5px 8px", fontSize: 11.5, borderBottom: "1px solid #E3DFD3", color: "#3E4A61" };
const cabecera: React.CSSProperties = { ...celda, fontWeight: 700, color: "#0B1A2E", background: "#F4F1EA", textAlign: "left" };

// ── Página ───────────────────────────────────────────────────────────────────

export default function PageSitios({ farmacias }: { farmacias: Farmacia[] }) {
  const [direccion, setDireccion] = useState("");
  const [candidatos, setCandidatos] = useState<ResultadoGeocode[]>([]);
  const [estado, setEstado] = useState<"idle" | "geocodificando" | "calculando" | "listo" | "error">("idle");
  const [mensaje, setMensaje] = useState("");
  const [evaluacion, setEvaluacion] = useState<Evaluacion | null>(null);
  const [fotoManual, setFotoManual] = useState<string | null>(null);

  const { data: capaNSE } = useCapaNSE(true);
  const { data: manzanas } = useManzanasRM(true);
  const fotoMapillary = useFotoMapillary(evaluacion ? evaluacion.vector.centro : null);
  const inputFoto = useRef<HTMLInputElement>(null);

  async function buscar() {
    if (!direccion.trim()) return;
    setEstado("geocodificando");
    setMensaje("");
    setCandidatos([]);
    try {
      const res = await geocodificar(direccion);
      if (res.length === 0) {
        setEstado("error");
        setMensaje("No se encontró la dirección. Prueba con formato 'Calle número, Comuna'.");
      } else if (res.length === 1) {
        evaluar(res[0]);
      } else {
        setCandidatos(res);
        setEstado("idle");
      }
    } catch (e) {
      setEstado("error");
      setMensaje(e instanceof Error ? e.message : "Error al geocodificar");
    }
  }

  function evaluar(sitio: ResultadoGeocode) {
    if (!capaNSE) {
      setEstado("error");
      setMensaje("La capa NSE aún se está cargando; reintenta en unos segundos.");
      return;
    }
    setCandidatos([]);
    setEstado("calculando");
    setFotoManual(null);
    // setTimeout deja pintar el spinner antes del cálculo pesado (sincrónico)
    setTimeout(() => {
      try {
        const centro: Punto = { lat: sitio.lat, lon: sitio.lon };
        const vector = calcularVectorSitio(centro, farmacias, capaNSE, manzanas as Manzanas | null);
        const rasgos = rasgosDesdeVector(vector, CADENA_CLIENTE);
        if (!poolCache) poolCache = simularVentasCadena(farmacias, capaNSE, CADENA_CLIENTE);
        const analogos = seleccionarAnalogos(rasgos, poolCache, 5);
        const prediccion = predecirVenta(analogos);
        const canibalizacion = predecirCanibalizacion(centro, farmacias, capaNSE, CADENA_CLIENTE);
        const score = calcularScore(rasgos, canibalizacion);
        setEvaluacion({ sitio, vector, rasgos, prediccion, canibalizacion, score });
        setEstado("listo");
      } catch (e) {
        setEstado("error");
        setMensaje(e instanceof Error ? e.message : "Error en el cálculo");
      }
    }, 30);
  }

  function subirFoto(f: File) {
    const reader = new FileReader();
    reader.onload = () => setFotoManual(reader.result as string);
    reader.readAsDataURL(f);
  }

  const foto = fotoManual ?? fotoMapillary;
  const ev = evaluacion;

  return (
    <div style={{ flex: 1, overflow: "auto", background: "#EAE6DA" }}>
      {/* CSS de impresión: solo el dosier es visible al imprimir */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #dosier, #dosier * { visibility: visible; }
          #dosier { position: absolute; left: 0; top: 0; width: 100%; margin: 0; box-shadow: none !important; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 14mm; }
        }
      `}</style>

      {/* Barra de búsqueda */}
      <div className="no-print" style={{ maxWidth: 820, margin: "18px auto 0", padding: "0 16px" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && buscar()}
            placeholder="Dirección del sitio candidato — ej: Av. Irarrázaval 3400, Ñuñoa"
            style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid #CBC5B5", fontSize: 13, outline: "none", background: "#fff" }}
          />
          <button
            onClick={buscar}
            disabled={estado === "geocodificando" || estado === "calculando"}
            style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#0B1A2E", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            {estado === "geocodificando" ? "Buscando…" : estado === "calculando" ? "Calculando…" : "Evaluar sitio"}
          </button>
          {ev && (
            <button
              onClick={() => window.print()}
              style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #CBC5B5", background: "#fff", color: "#0B1A2E", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              Exportar PDF
            </button>
          )}
        </div>

        {candidatos.length > 0 && (
          <div style={{ background: "#fff", border: "1px solid #E3DFD3", borderRadius: 8, marginTop: 8 }}>
            <div style={{ padding: "8px 14px", fontSize: 11, color: "#5D6880" }}>Se encontraron varias coincidencias — elige la correcta:</div>
            {candidatos.map((c, i) => (
              <div
                key={i}
                onClick={() => evaluar(c)}
                style={{ padding: "9px 14px", fontSize: 12.5, cursor: "pointer", borderTop: "1px solid #EAE6DA", color: "#0B1A2E" }}
              >
                {c.displayName}
              </div>
            ))}
          </div>
        )}

        {estado === "error" && (
          <p style={{ color: "#C13B3B", fontSize: 12.5, marginTop: 8 }}>{mensaje}</p>
        )}
        {estado === "calculando" && (
          <p style={{ color: "#5D6880", fontSize: 12.5, marginTop: 8 }}>
            Analizando entorno, buscando análogos y estimando canibalización… (la primera evaluación de la sesión prepara el modelo y puede tomar unos segundos)
          </p>
        )}
        {!capaNSE && (
          <p style={{ color: "#8A92A3", fontSize: 11.5, marginTop: 8 }}>Cargando capa NSE nacional…</p>
        )}
      </div>

      {/* Dosier */}
      {ev && (
        <div
          id="dosier"
          style={{ maxWidth: 820, margin: "18px auto 40px", background: "#fff", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", padding: "28px 32px", fontFamily: "inherit" }}
        >
          {/* Encabezado */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #0B1A2E", paddingBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "#5D6880" }}>REALI · DOSIER DE SITIO</div>
              <h1 style={{ fontSize: 19, fontWeight: 800, color: "#0B1A2E", margin: "4px 0 2px", lineHeight: 1.25 }}>{ev.sitio.displayName}</h1>
              <div style={{ fontSize: 11, color: "#5D6880" }}>
                {ev.vector.comuna ?? "—"} · lat {ev.vector.centro.lat.toFixed(5)}, lon {ev.vector.centro.lon.toFixed(5)} · {new Date().toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}
              </div>
            </div>
            <div style={{ textAlign: "center", minWidth: 110 }}>
              <div style={{ fontSize: 34, fontWeight: 800, color: ev.score.score >= 55 ? "#2D8A6B" : ev.score.score >= 35 ? "#D4A017" : "#C13B3B", lineHeight: 1 }}>
                {ev.score.score}
              </div>
              <div style={{ fontSize: 10, color: "#5D6880", marginTop: 2 }}>SCORE / 100</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#0B1A2E", marginTop: 4 }}>{ev.score.clasificacion}</div>
            </div>
          </div>

          {/* Resumen ejecutivo */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 16 }}>
            {[
              { k: "Venta mensual estimada", v: ev.prediccion ? fmtCLP(ev.prediccion.ventaEstimadaCLP) : "s/d" },
              { k: "Hogares a 1 km", v: ev.rasgos.hogares1km.toLocaleString("es-CL") },
              { k: "Competencia a 500 m", v: `${ev.rasgos.competidores500} locales` },
              { k: "Canibalización predicha", v: fmtPct(ev.canibalizacion.pctDesdePropias) },
            ].map((c) => (
              <div key={c.k} style={{ background: "#F4F1EA", border: "1px solid #E3DFD3", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#0B1A2E" }}>{c.v}</div>
                <div style={{ fontSize: 9.5, color: "#5D6880", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.04em" }}>{c.k}</div>
              </div>
            ))}
          </div>

          {/* Mapa de entorno + satelital */}
          <Seccion titulo="Entorno competitivo">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ height: 300, borderRadius: 8, overflow: "hidden", border: "1px solid #E3DFD3" }}>
                <MapContainer
                  center={[ev.vector.centro.lat, ev.vector.centro.lon]}
                  zoom={15}
                  style={{ height: "100%", width: "100%" }}
                  dragging={false}
                  scrollWheelZoom={false}
                  zoomControl={false}
                  attributionControl={false}
                >
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                  {RADIOS_M.map((r) => (
                    <Circle key={r} center={[ev.vector.centro.lat, ev.vector.centro.lon]} radius={r} pathOptions={{ color: "#0B1A2E", weight: 1, fillOpacity: 0.02, dashArray: "4 4" }} />
                  ))}
                  {ev.vector.cercanas.map((c) => (
                    <CircleMarker
                      key={c.farmacia.id}
                      center={[c.farmacia.lat, c.farmacia.lon]}
                      radius={6}
                      pathOptions={{ color: "#fff", weight: 1.5, fillColor: COLORES_CADENA[c.farmacia.cadena], fillOpacity: 0.95 }}
                    >
                      <Tooltip>{c.farmacia.nombre} · {Math.round(c.distanciaM)} m</Tooltip>
                    </CircleMarker>
                  ))}
                  <CircleMarker
                    center={[ev.vector.centro.lat, ev.vector.centro.lon]}
                    radius={9}
                    pathOptions={{ color: "#fff", weight: 2, fillColor: "#C13B3B", fillOpacity: 1 }}
                  />
                </MapContainer>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <img
                  src={urlSatelital(ev.vector.centro, 300, 640, 300)}
                  alt="Vista satelital del sitio (Esri World Imagery)"
                  style={{ width: "100%", height: 144, objectFit: "cover", borderRadius: 8, border: "1px solid #E3DFD3" }}
                />
                {foto ? (
                  <img src={foto} alt="Fachada del sitio" style={{ width: "100%", height: 144, objectFit: "cover", borderRadius: 8, border: "1px solid #E3DFD3" }} />
                ) : (
                  <div
                    className="no-print"
                    onClick={() => inputFoto.current?.click()}
                    style={{ height: 144, borderRadius: 8, border: "1.5px dashed #CBC5B5", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#8A92A3", fontSize: 11.5, textAlign: "center", padding: 10 }}
                  >
                    {import.meta.env.VITE_MAPILLARY_TOKEN
                      ? "Sin imagen Mapillary en este punto — clic para subir foto de fachada"
                      : "Clic para subir foto de fachada (o define VITE_MAPILLARY_TOKEN para foto automática)"}
                  </div>
                )}
                <input ref={inputFoto} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && subirFoto(e.target.files[0])} />
              </div>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 14 }}>
              <thead>
                <tr>
                  <th style={cabecera}>Radio</th>
                  <th style={cabecera}>Farmacias</th>
                  <th style={cabecera}>Cruz Verde</th>
                  <th style={cabecera}>Otras cadenas</th>
                  <th style={cabecera}>Población (RM)</th>
                  <th style={cabecera}>Hogares (RM)</th>
                </tr>
              </thead>
              <tbody>
                {ev.vector.radios.map((r) => {
                  const propias = r.porCadena[CADENA_CLIENTE] ?? 0;
                  return (
                    <tr key={r.radioM}>
                      <td style={celda}>{r.radioM} m</td>
                      <td style={celda}>{r.totalFarmacias}</td>
                      <td style={celda}>{propias}</td>
                      <td style={celda}>{r.totalFarmacias - propias}</td>
                      <td style={celda}>{r.poblacion !== null ? r.poblacion.toLocaleString("es-CL") : "s/d"}</td>
                      <td style={celda}>{r.hogares !== null ? r.hogares.toLocaleString("es-CL") : "s/d"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Seccion>

          {/* NSE */}
          <Seccion titulo="Perfil socioeconómico (radio 1 km)">
            <div style={{ fontSize: 11.5, color: "#3E4A61", marginBottom: 8 }}>
              NSE de la unidad vecinal del sitio: <strong>{ev.vector.nseSitio ?? "s/d"}</strong> · {ev.rasgos.hogares1km.toLocaleString("es-CL")} hogares en el radio (metodología AIM Chile sobre tramos de ingreso, bidat.gob.cl)
            </div>
            <BarraMixNSE mix={ev.vector.mixNSE} />
          </Seccion>

          {/* Análogos */}
          {ev.prediccion && (
            <Seccion titulo="Tiendas análogas y venta estimada">
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={cabecera}>Tienda análoga</th>
                    <th style={cabecera}>Comuna</th>
                    <th style={cabecera}>Similitud</th>
                    <th style={cabecera}>Venta mensual</th>
                  </tr>
                </thead>
                <tbody>
                  {ev.prediccion.analogos.map((a) => (
                    <tr key={a.tienda.farmacia.id}>
                      <td style={celda}>{a.tienda.farmacia.nombre}</td>
                      <td style={celda}>{a.tienda.farmacia.comuna}</td>
                      <td style={celda}>{fmtPct(a.similitud)}</td>
                      <td style={celda}>{fmtCLP(a.tienda.ventaMensualCLP)}{a.tienda.ventaSimulada ? " *" : ""}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ ...celda, fontWeight: 700 }} colSpan={3}>Venta estimada del sitio (ponderada por similitud)</td>
                    <td style={{ ...celda, fontWeight: 700 }}>
                      {fmtCLP(ev.prediccion.ventaEstimadaCLP)}
                      <span style={{ fontWeight: 400, color: "#5D6880" }}> · rango {fmtCLP(ev.prediccion.rangoCLP[0])}–{fmtCLP(ev.prediccion.rangoCLP[1])}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
              <p style={{ fontSize: 10, color: "#8A92A3", marginTop: 6 }}>
                * Ventas simuladas (40–120 M CLP/mes, correlacionadas con el entorno) mientras no se disponga de datos reales del cliente. El modelo se recalibra automáticamente al cargar ventas reales.
              </p>
            </Seccion>
          )}

          {/* Canibalización */}
          <Seccion titulo="Canibalización de red propia (modelo Huff)">
            <div style={{ fontSize: 11.5, color: "#3E4A61", marginBottom: 8 }}>
              Se estima que el <strong>{fmtPct(ev.canibalizacion.pctDesdePropias)}</strong> de la demanda que capture el sitio nuevo provendría de tiendas {CADENA_CLIENTE} existentes (β = {ev.canibalizacion.params.beta}, radio de demanda {ev.canibalizacion.params.radioDemandaM / 1000} km).
            </div>
            {ev.canibalizacion.porTienda.length > 0 ? (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={cabecera}>Tienda propia afectada</th>
                    <th style={cabecera}>Distancia</th>
                    <th style={cabecera}>Impacto predicho en su venta</th>
                  </tr>
                </thead>
                <tbody>
                  {ev.canibalizacion.porTienda.slice(0, 6).map((t) => (
                    <tr key={t.farmacia.id}>
                      <td style={celda}>{t.farmacia.nombre}</td>
                      <td style={celda}>{t.distanciaM.toLocaleString("es-CL")} m</td>
                      <td style={{ ...celda, color: t.pctCanibalizado > 0.15 ? "#C13B3B" : "#3E4A61" }}>−{fmtPct(t.pctCanibalizado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ fontSize: 11.5, color: "#5D6880" }}>No hay tiendas {CADENA_CLIENTE} dentro del radio de análisis — canibalización nula.</p>
            )}
          </Seccion>

          {/* Desglose del score */}
          <Seccion titulo="Desglose del score">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={cabecera}>Componente</th>
                  <th style={cabecera}>Peso</th>
                  <th style={cabecera}>Evaluación</th>
                  <th style={cabecera}>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {ev.score.componentes.map((c) => (
                  <tr key={c.nombre}>
                    <td style={celda}>{c.nombre}</td>
                    <td style={celda}>{fmtPct(c.peso)}</td>
                    <td style={celda}>
                      <div style={{ width: 90, height: 8, background: "#E3DFD3", borderRadius: 4, display: "inline-block", verticalAlign: "middle" }}>
                        <div style={{ width: `${c.valor * 100}%`, height: "100%", background: c.valor >= 0.6 ? "#2D8A6B" : c.valor >= 0.3 ? "#D4A017" : "#C13B3B", borderRadius: 4 }} />
                      </div>
                      <span style={{ marginLeft: 6, fontSize: 11 }}>{fmtPct(c.valor)}</span>
                    </td>
                    <td style={celda}>{c.detalle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Seccion>

          {/* Pie */}
          <div style={{ marginTop: 24, paddingTop: 10, borderTop: "1px solid #E3DFD3", fontSize: 9.5, color: "#8A92A3", lineHeight: 1.5 }}>
            Fuentes: registro nacional de farmacias MINSAL · Censo 2024 (INE) · tramos de ingreso por unidad vecinal (bidat.gob.cl, clasificación NSE metodología AIM Chile) · imagen satelital Esri World Imagery · geocodificación OpenStreetMap/Nominatim.
            Documento generado por REALI (realidata.cl). Población y hogares por manzana disponibles solo en Región Metropolitana.
          </div>
        </div>
      )}

      {/* Estado vacío */}
      {!ev && estado !== "calculando" && (
        <div className="no-print" style={{ maxWidth: 820, margin: "60px auto", textAlign: "center", color: "#8A92A3", padding: "0 16px" }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📍</div>
          <p style={{ fontSize: 13.5 }}>Ingresa la dirección de un local candidato y genera su dosier territorial:<br />competencia, perfil NSE, venta estimada por análogos, canibalización y score.</p>
        </div>
      )}
    </div>
  );
}
