import { useState, useMemo, useEffect, useRef } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import type { Feature } from "geojson";
import L from "leaflet";
import { Farmacia } from "../types";
import { COLORES_CADENA, LOGO_CADENA, EMAIL_REPORTES } from "../constants";
import { useManzanasRM, type ManzanaProps } from "../hooks/useGeoCapas";
import {
  colorParaValor, CORTES, PALETA, ETIQUETA_VARIABLE, type VariableCoropleta,
} from "../utils/coropleta";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function mailtoReporte(f: Farmacia): string {
  const asunto = `Pin mal ubicado — ${f.nombre}`;
  const cuerpo =
`Hola,

El siguiente local parece tener coordenadas incorrectas:

ID: ${f.id}
Nombre: ${f.nombre}
Cadena: ${f.cadena}
Dirección declarada: ${f.direccion}
Comuna: ${f.comuna}, ${f.region}
Coordenadas actuales: ${f.lat}, ${f.lon}
Google Maps: https://www.google.com/maps?q=${f.lat},${f.lon}

Ubicación correcta / comentario:
(describa el problema o pegue la lat,lon correcta)

— Reportado desde REALI`;
  return `mailto:${EMAIL_REPORTES}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
}

function popupHTML(f: Farmacia, col: string): string {
  const svUrl = `https://maps.google.com/maps?q=&layer=c&cbll=${f.lat},${f.lon}`;
  const row = (lbl: string, val: string, color?: string) =>
    `<span class="lbl">${lbl}</span><span class="val"${color ? ` style="color:${color}"` : ""}>${escapeHtml(val)}</span>`;
  return `<div class="fpopup">
    <h4>${escapeHtml(f.nombre)}</h4>
    <div class="addr">${escapeHtml(f.direccion)}</div>
    <div class="grid2">
      ${row("Cadena", f.cadena, col)}
      ${row("Comuna", f.comuna)}
      ${row("Región", f.region)}
      ${row("Tipo", f.tipo)}
      ${f.horario ? row("Horario", f.horario) : ""}
      ${f.telefono ? row("Teléfono", f.telefono) : ""}
    </div>
    <a href="${svUrl}" target="_blank" rel="noreferrer" class="sv">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="5" r="2"/><path d="M12 7v6"/><path d="M8 11l4 2 4-2"/><path d="M6 20c1.5-1.5 6-2 6-2s4.5.5 6 2"/>
      </svg>
      Ver en Street View
    </a>
    <a href="${mailtoReporte(f)}" class="rep" title="Abre tu cliente de correo con el reporte prearmado">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      Reportar ubicación incorrecta
    </a>
  </div>`;
}

function FarmaciasLayer({ farmacias, logosOn }: { farmacias: Farmacia[]; logosOn: boolean }) {
  const map = useMap();

  useEffect(() => {
    const group = L.layerGroup();

    for (const f of farmacias) {
      const col = COLORES_CADENA[f.cadena] ?? "#64748b";
      let layer: L.Layer;

      if (logosOn) {
        const logo = LOGO_CADENA[f.cadena];
        const html = logo
          ? `<div class="farm-icon" style="border-color:${col}"><img src="${logo}" alt=""/></div>`
          : `<div class="farm-icon" style="border-color:${col};background:${col}"><div class="farm-dot" style="background:${col};border-color:#fff"></div></div>`;
        const icon = L.divIcon({
          html, className: "", iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -13],
        });
        layer = L.marker([f.lat, f.lon], { icon });
      } else {
        layer = L.circleMarker([f.lat, f.lon], {
          radius: 7, color: "rgba(255,255,255,0.8)", weight: 1.5,
          fillColor: col, fillOpacity: 0.9,
        });
      }

      layer.bindPopup(popupHTML(f, col), { maxWidth: 270, minWidth: 220 }).addTo(group);
    }

    group.addTo(map);
    return () => { map.removeLayer(group); };
  }, [map, farmacias, logosOn]);

  return null;
}

interface ResultadoBusqueda { lat: number; lon: number; display: string; }

function BuscadorEfecto({ resultado }: { resultado: ResultadoBusqueda | null }) {
  const map = useMap();
  useEffect(() => {
    if (!resultado) return;
    const { lat, lon, display } = resultado;
    map.flyTo([lat, lon], 16, { duration: 0.8 });
    const marker = L.marker([lat, lon], {
      icon: L.divIcon({
        html: `<div class="search-pin"></div>`,
        className: "", iconSize: [22, 22], iconAnchor: [11, 11],
      }),
    })
      .bindPopup(`<div class="fpopup"><h4>Dirección</h4><div class="addr">${display.replace(/</g, "&lt;")}</div></div>`, { maxWidth: 260 })
      .addTo(map)
      .openPopup();
    return () => { map.removeLayer(marker); };
  }, [map, resultado]);
  return null;
}

// Auto-centra el mapa en los datos visibles cada vez que cambia el filtrado.
// Salta el primer render para no desplazar el encuadre inicial.
function FitBounds({ farmacias }: { farmacias: Farmacia[] }) {
  const map = useMap();
  const isFirst = useRef(true);
  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    if (!farmacias.length) return;
    const b = L.latLngBounds(farmacias.map((f) => [f.lat, f.lon] as [number, number]));
    if (b.isValid()) map.fitBounds(b, { padding: [50, 50], maxZoom: 14 });
  }, [farmacias, map]);
  return null;
}

// Color determinista por nombre de comuna para la capa de comunas.
function hashColor(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return `hsl(${((h >>> 0) % 360)},52%,42%)`;
}

interface Props {
  farmacias: Farmacia[];
  onComunaClick?: (c: string) => void;
}

const TILES = {
  claro:    { url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",    attr: "© CARTO · OSM" },
  oscuro:   { url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",     attr: "© CARTO · OSM" },
  satelite: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attr: "© Esri" },
  osm:      { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",                attr: "© OpenStreetMap" },
};

type TileKey = keyof typeof TILES;

const LEGEND_CADENAS = ["Cruz Verde","Salcobrand","Ahumada","Dr. Simi","Maicao","Knop"] as const;

// Tokens de marca REALI (diseño/paleta.md)
const C = {
  bg: "#F4F1EA", bgCard: "#FDFCFA", border: "#E3DFD3",
  text: "#0B1A2E", text2: "#3E4A61", text3: "#5D6880",
  accent: "#F5A524", accentText: "#9A6206",
};
const CTRL_BG = "rgba(253,252,250,0.95)";

export default function MapaFarmacias({ farmacias, onComunaClick }: Props) {
  const [tile, setTile] = useState<TileKey>("claro");
  const [manzanasOn, setManzanasOn] = useState(false);
  const [comunasOn, setComunasOn] = useState(false);
  const [logosOn, setLogosOn] = useState(false);
  const [variable, setVariable] = useState<VariableCoropleta>("pob");
  const [busqueda, setBusqueda] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
  const [resultadoBusqueda, setResultadoBusqueda] = useState<ResultadoBusqueda | null>(null);

  // Ref para que los handlers del GeoJSON de comunas siempre llamen la versión fresca del callback.
  const onComunaClickRef = useRef(onComunaClick);
  onComunaClickRef.current = onComunaClick;

  async function buscarDireccion() {
    const q = busqueda.trim();
    if (!q) return;
    setBuscando(true); setErrorBusqueda(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=cl&limit=1&q=${encodeURIComponent(q)}`;
      const r = await fetch(url, { headers: { "Accept-Language": "es" } });
      const data = (await r.json()) as Array<{ lat: string; lon: string; display_name: string }>;
      if (!data.length) {
        setErrorBusqueda("Sin resultados");
        setResultadoBusqueda(null);
      } else {
        setResultadoBusqueda({
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon),
          display: data[0].display_name,
        });
      }
    } catch (e) {
      setErrorBusqueda(e instanceof Error ? e.message : "Error");
    } finally {
      setBuscando(false);
    }
  }

  // Descarga manzanas cuando se activa cualquiera de las dos capas que lo necesita.
  const { data: manzanas, loading: loadingManz } = useManzanasRM(manzanasOn || comunasOn);

  const estiloManzana = useMemo(
    () => (feat?: Feature) => {
      const props = (feat?.properties ?? {}) as ManzanaProps;
      return {
        fillColor: colorParaValor(props[variable] ?? 0, variable),
        fillOpacity: 0.6,
        color: "#ffffff",
        weight: 0.2,
      };
    },
    [variable],
  );

  const estiloComunas = useMemo(
    () => (feat?: Feature) => {
      const p = (feat?.properties ?? {}) as ManzanaProps;
      const color = hashColor(p.comuna ?? "");
      return { fillColor: color, fillOpacity: 0.18, color, weight: 1.5 };
    },
    [],
  );

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <MapContainer
        center={[-33.4489, -70.6693]}
        zoom={11}
        style={{ width: "100%", height: "100%" }}
        preferCanvas
        zoomControl={false}
      >
        <TileLayer key={tile} url={TILES[tile].url} attribution={TILES[tile].attr} maxZoom={19} />

        {/* Auto-centra el mapa al filtrar */}
        <FitBounds farmacias={farmacias} />

        {/* Capa comunas — colorea manzanas por nombre de comuna; clic filtra */}
        {comunasOn && manzanas && (
          <GeoJSON
            key="comunas"
            data={manzanas}
            style={estiloComunas}
            onEachFeature={(feat, layer) => {
              const p = feat.properties as ManzanaProps;
              layer.bindTooltip(
                `<b>${p.comuna}</b><br/><span style="font-size:10px;color:#6b7280">Clic para filtrar por esta comuna</span>`,
                { sticky: true, direction: "top" },
              );
              layer.on("click", () => { onComunaClickRef.current?.(p.comuna); });
            }}
          />
        )}

        {/* Coropleta manzanas (demografía) */}
        {manzanasOn && manzanas && (
          <GeoJSON
            key={`manz-${variable}`}
            data={manzanas}
            style={estiloManzana}
            onEachFeature={(feat, layer) => {
              const p = feat.properties as ManzanaProps;
              layer.bindTooltip(
                `<b>${p.comuna}</b><br/>Pob: ${p.pob.toLocaleString("es-CL")} · Viv: ${p.viv.toLocaleString("es-CL")} · Hog: ${p.hog.toLocaleString("es-CL")}`,
                { sticky: true, direction: "top" },
              );
            }}
          />
        )}

        <FarmaciasLayer farmacias={farmacias} logosOn={logosOn} />
        <BuscadorEfecto resultado={resultadoBusqueda} />
      </MapContainer>

      {/* Buscador de dirección */}
      <div style={{
        position: "absolute", top: 10, right: 12, zIndex: 400,
        background: CTRL_BG, border: `1px solid ${C.border}`,
        borderRadius: 8, padding: "4px 6px 4px 10px", display: "flex", alignItems: "center", gap: 6,
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)", backdropFilter: "blur(4px)",
        width: 280,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3E4A61" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          placeholder="Buscar dirección en Chile…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") buscarDireccion(); }}
          style={{ flex: 1, border: "none", outline: "none", fontSize: 11.5, color: C.text2, background: "transparent" }}
        />
        {busqueda && (
          <button
            onClick={() => { setBusqueda(""); setErrorBusqueda(null); setResultadoBusqueda(null); }}
            style={{ border: "none", background: "transparent", color: C.text3, cursor: "pointer", fontSize: 13, padding: 0, lineHeight: 1 }}
            title="Limpiar"
          >×</button>
        )}
        <button
          onClick={buscarDireccion}
          disabled={buscando || !busqueda.trim()}
          className="rl-hover"
          style={{ padding: "4px 10px", borderRadius: 4, border: "none", background: C.accent, color: C.text, fontSize: 10.5, fontWeight: 700, cursor: buscando ? "wait" : "pointer", opacity: buscando || !busqueda.trim() ? 0.5 : 1 }}
        >
          {buscando ? "…" : "Ir"}
        </button>
      </div>
      {errorBusqueda && (
        <div style={{
          position: "absolute", top: 46, right: 12, zIndex: 400,
          background: "#FBEDED", border: "1px solid rgba(193,59,59,0.35)", color: "#A32F2F",
          borderRadius: 6, padding: "3px 10px", fontSize: 10.5,
        }}>
          {errorBusqueda}
        </div>
      )}

      {/* Tile picker */}
      <div style={{
        position: "absolute", top: 10, left: 12, zIndex: 400,
        background: CTRL_BG, border: `1px solid ${C.border}`,
        borderRadius: 8, padding: "5px 7px", display: "flex", alignItems: "center", gap: 4,
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)", backdropFilter: "blur(4px)",
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3E4A61" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2"/>
          <polyline points="2 17 12 22 22 17"/>
          <polyline points="2 12 12 17 22 12"/>
        </svg>
        {(["claro","oscuro","satelite","osm"] as TileKey[]).map((t) => (
          <button
            key={t}
            onClick={() => setTile(t)}
            style={{
              padding: "3px 10px", borderRadius: 4, fontSize: "10.5px", fontWeight: tile === t ? 700 : 500,
              cursor: "pointer", border: "none", transition: "all 0.12s",
              background: tile === t ? C.accent : "transparent",
              color: tile === t ? C.text : C.text3,
            }}
          >
            {{ claro: "Claro", oscuro: "Oscuro", satelite: "Satélite", osm: "OSM" }[t]}
          </button>
        ))}
      </div>

      {/* Panel de capas */}
      <div style={{
        position: "absolute", top: 54, left: 12, zIndex: 400,
        background: CTRL_BG, border: `1px solid ${C.border}`,
        borderRadius: 8, padding: "8px 10px", minWidth: 200,
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)", backdropFilter: "blur(4px)",
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: C.text3, marginBottom: 6 }}>
          Capas
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.text2, cursor: "pointer", marginBottom: 4 }}>
          <input type="checkbox" checked={logosOn} onChange={(e) => setLogosOn(e.target.checked)} />
          Logos de cadenas
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.text2, cursor: "pointer", marginBottom: 4 }}>
          <input type="checkbox" checked={comunasOn} onChange={(e) => setComunasOn(e.target.checked)} />
          Comunas {loadingManz && comunasOn && <span style={{ color: C.text3 }}>· cargando…</span>}
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.text2, cursor: "pointer", marginBottom: 4 }}>
          <input type="checkbox" checked={manzanasOn} onChange={(e) => setManzanasOn(e.target.checked)} />
          Manzanas censo 2024 {loadingManz && manzanasOn && <span style={{ color: C.text3 }}>· cargando…</span>}
        </label>

        {manzanasOn && (
          <div style={{ marginLeft: 18, marginBottom: 6 }}>
            <select
              value={variable}
              onChange={(e) => setVariable(e.target.value as VariableCoropleta)}
              style={{ fontSize: 11, padding: "2px 4px", border: `1px solid ${C.border}`, borderRadius: 4, background: C.bgCard, color: C.text2, width: "100%" }}
            >
              {(Object.keys(ETIQUETA_VARIABLE) as VariableCoropleta[]).map((k) => (
                <option key={k} value={k}>{ETIQUETA_VARIABLE[k]}</option>
              ))}
            </select>

            {/* Leyenda */}
            <div style={{ marginTop: 6 }}>
              <div style={{ display: "flex", height: 8, borderRadius: 3, overflow: "hidden" }}>
                {PALETA.map((c) => <div key={c} style={{ flex: 1, background: c }} />)}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: C.text3, marginTop: 2 }}>
                <span>0</span>
                {CORTES[variable].map((v, i) => <span key={i}>{v}</span>)}
                <span>+</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Count badge */}
      <div style={{
        position: "absolute", bottom: 14, left: 14, zIndex: 400,
        background: CTRL_BG, border: `1px solid ${C.border}`,
        borderRadius: 6, padding: "5px 12px", fontSize: 11, color: C.text2,
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      }}>
        <span className="num" style={{ color: C.accentText, fontWeight: 700 }}>{farmacias.length}</span> locales visibles
      </div>

      {/* Leyenda cadenas */}
      <div style={{
        position: "absolute", bottom: 14, right: 14, zIndex: 400,
        background: CTRL_BG, border: `1px solid ${C.border}`,
        borderRadius: 8, padding: "10px 12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: C.text3, marginBottom: 6 }}>Cadenas</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {LEGEND_CADENAS.map((c) => {
            const logo = LOGO_CADENA[c];
            const col = COLORES_CADENA[c];
            return (
              <div key={c} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {logo ? (
                  <span style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", border: `1.5px solid ${col}`, display: "inline-flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                    <img src={logo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 1 }} />
                  </span>
                ) : (
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: col, flexShrink: 0 }} />
                )}
                <span style={{ fontSize: 10, color: C.text2 }}>{c}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
