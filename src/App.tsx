import { useMemo, useState, Suspense, lazy } from "react";
import { useFarmacias } from "./hooks/useFarmacias";
import { useDemografia, DemografiaCenso } from "./hooks/useDemografia";
import { Farmacia } from "./types";
import PanelIzquierdo from "./components/PanelIzquierdo";
import UploadModal from "./components/UploadModal";
import PageMovimientos from "./components/PageMovimientos";
import PageCadenas from "./components/PageCadenas";
import PageDemografia from "./components/PageDemografia";
import PageResumen from "./components/PageResumen";

const MapaFarmacias = lazy(() => import("./components/MapaFarmacias"));
const PageSitios = lazy(() => import("./components/PageSitios"));

type Page = "mapa" | "movimientos" | "cadenas" | "demografia" | "resumen" | "sitios";

interface Filtros { cadenas: string[]; region: string; comuna: string; }

const FILTROS_VACIOS: Filtros = { cadenas: [], region: "", comuna: "" };

// Tokens de marca REALI (diseño/paleta.md): Midnight, Bone, Graphite, acento Amber.
const C = {
  bg: "#F4F1EA", bgCard: "#FDFCFA", border: "#E3DFD3",
  text: "#0B1A2E", text2: "#3E4A61", text3: "#5D6880",
  accent: "#F5A524",       // relleno de acción — texto Midnight encima
  accentText: "#9A6206",   // texto pequeño en acento sobre claro (AA 4.5:1)
  nav: "#0B1A2E", navBorder: "#1C2433",
};

// ── Icons ────────────────────────────────────────────────────────────────────

function IMap() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
      <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
    </svg>
  );
}
function IBar() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  );
}
function IGrid() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>
  );
}
function IUp() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}
function ITarget() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>
      <line x1="12" y1="1" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="1" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="23" y2="12"/>
    </svg>
  );
}
function IChevL() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>;
}
function IChevR() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
}
function IUsers() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function IDashboard() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9"/>
      <rect x="14" y="3" width="7" height="5"/>
      <rect x="14" y="12" width="7" height="9"/>
      <rect x="3" y="16" width="7" height="5"/>
    </svg>
  );
}

// ── Nav Sidebar ──────────────────────────────────────────────────────────────

function NavSidebar({ page, setPage }: { page: Page; setPage: (p: Page) => void }) {
  const [open, setOpen] = useState(true);
  const W = open ? 204 : 48;

  const items: { id: Page; label: string; icon: React.ReactNode }[] = [
    { id: "resumen",     label: "Resumen Integrado",    icon: <IDashboard /> },
    { id: "mapa",        label: "Mapa Farmacéutico",    icon: <IMap /> },
    { id: "movimientos", label: "Aperturas / Cierres",  icon: <IBar /> },
    { id: "cadenas",     label: "Cadenas Principales",  icon: <IGrid /> },
    { id: "demografia",  label: "Análisis Demográfico", icon: <IUsers /> },
    { id: "sitios",      label: "Evaluar Sitio",        icon: <ITarget /> },
  ];

  return (
    <nav style={{
      width: W, minWidth: W, flexShrink: 0, background: C.nav,
      display: "flex", flexDirection: "column",
      padding: open ? "0 10px 14px" : "0 6px 14px",
      overflow: "hidden",
      transition: "width 0.22s cubic-bezier(.4,0,.2,1), min-width 0.22s cubic-bezier(.4,0,.2,1)",
    }}>
      <div style={{ padding: "20px 0 20px", display: "flex", flexDirection: "column", alignItems: open ? "flex-start" : "center", paddingLeft: open ? 8 : 0 }}>
        {open ? (
          <>
            <div style={{ fontSize: 15, fontFamily: "'Archivo Black', Inter, sans-serif", letterSpacing: "0.01em", color: "#F4F1EA", lineHeight: 1 }}>REALI</div>
            <div style={{ fontSize: 9, color: "#8A92A3", marginTop: 4, letterSpacing: "0.05em", textTransform: "uppercase" }}>Intel. Territorial Farm.</div>
          </>
        ) : (
          <div style={{ fontSize: 14, fontFamily: "'Archivo Black', Inter, sans-serif", color: "#F4F1EA" }}>R</div>
        )}
      </div>

      {open && <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "#4A5670", padding: "0 10px", marginBottom: 5 }}>Plataforma</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {items.map((item) => (
          <div
            key={item.id}
            title={!open ? item.label : undefined}
            onClick={() => setPage(item.id)}
            style={{
              display: "flex", alignItems: "center", gap: open ? 8 : 0,
              padding: open ? "7px 10px" : "7px 0",
              justifyContent: open ? "flex-start" : "center",
              borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 500,
              color: page === item.id ? "#F5A524" : "#8A92A3",
              background: page === item.id ? "rgba(245,165,36,0.12)" : "transparent",
              boxShadow: page === item.id ? "inset 2px 0 0 #F5A524" : "none",
              transition: "all 0.12s", whiteSpace: "nowrap", userSelect: "none",
            }}
            onMouseEnter={(e) => { if (page !== item.id) { e.currentTarget.style.color = "#DCD8CE"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; } }}
            onMouseLeave={(e) => { if (page !== item.id) { e.currentTarget.style.color = "#8A92A3"; e.currentTarget.style.background = "transparent"; } }}
          >
            <span style={{ opacity: page === item.id ? 1 : 0.75, flexShrink: 0 }}>{item.icon}</span>
            {open && item.label}
          </div>
        ))}
      </div>

      <div style={{ marginTop: "auto", padding: open ? "14px 8px 0" : "14px 0 0", borderTop: `1px solid ${C.navBorder}` }}>
        {open && (
          <>
            <div style={{ fontSize: 10, color: "#6B7690" }}>Demo · Chile</div>
            <div style={{ fontSize: 9, color: "#4A5670", marginTop: 1 }}>v0.9 · beta</div>
          </>
        )}
        <button
          onClick={() => setOpen((o) => !o)}
          title={open ? "Contraer menú" : "Expandir menú"}
          style={{
            marginTop: open ? 10 : 0, width: "100%", background: "none", border: "none",
            cursor: "pointer", color: "#6B7690",
            display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 0",
          }}
        >
          {open ? <IChevL /> : <IChevR />}
        </button>
      </div>
    </nav>
  );
}

// ── Header ───────────────────────────────────────────────────────────────────

function Header({ page, count, total, onUpload }: { page: Page; count: number; total: number; onUpload: () => void }) {
  const titles: Record<Page, string> = {
    resumen: "Resumen Integrado",
    mapa: "Mapa Farmacéutico",
    movimientos: "Registro de Aperturas y Cierres",
    cadenas: "Cadenas Principales — Aperturas 2026",
    demografia: "Análisis Demográfico",
    sitios: "Evaluar Sitio — Dosier Territorial",
  };
  return (
    <header style={{ height: 52, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", background: C.bgCard, flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{titles[page]}</span>
        {page === "mapa" && (
          <span style={{ fontSize: 11, color: C.text3 }}>
            <span className="num" style={{ color: C.accentText, fontWeight: 700 }}>{count.toLocaleString("es-CL")}</span>
            {count !== total && <span className="num" style={{ color: C.text3 }}> / {total.toLocaleString("es-CL")}</span>}
            {" "}locales
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {page === "mapa" && (
          <button
            onClick={onUpload}
            className="rl-raise"
            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 13px", borderRadius: 6, fontSize: 11.5, fontWeight: 500, cursor: "pointer", background: C.bgCard, color: C.text2, border: `1px solid ${C.border}`, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}
          >
            <IUp /> Subir archivo
          </button>
        )}
      </div>
    </header>
  );
}

// ── Page: Mapa ────────────────────────────────────────────────────────────────

function PageMapa({
  uploadModal, setUploadModal, farmacias, demografia, loading, error, onCountChange,
}: {
  uploadModal: boolean; setUploadModal: (v: boolean) => void;
  farmacias: Farmacia[];
  demografia: DemografiaCenso[];
  loading: boolean; error: string | null;
  onCountChange: (n: number) => void;
}) {
  const [panelOpen, setPanelOpen] = useState(true);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string }[]>([]);

  // Primera pasada: región + comuna (sin cadena) — usada por el gráfico del panel.
  const farmaciasSinCadena = useMemo(
    () => farmacias.filter((f) => {
      if (filtros.region && f.region !== filtros.region) return false;
      if (filtros.comuna && f.comuna !== filtros.comuna) return false;
      return true;
    }),
    [farmacias, filtros.region, filtros.comuna],
  );

  // Segunda pasada: aplica filtro de cadenas sobre el resultado anterior.
  const filtradas = useMemo(() => {
    const result = farmaciasSinCadena.filter((f) =>
      filtros.cadenas.length === 0 || filtros.cadenas.includes(f.cadena),
    );
    onCountChange(result.length);
    return result;
  }, [farmaciasSinCadena, filtros.cadenas]);

  const comunas = useMemo(() => [...new Set(farmacias.map((f) => f.comuna))].sort(), [farmacias]);
  const regiones = useMemo(() => [...new Set(farmacias.map((f) => f.region))].sort(), [farmacias]);

  const PANEL_W = 262;

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
      {/* Panel izquierdo */}
      <div
        className="panel-slide"
        style={{ width: panelOpen ? PANEL_W : 0, minWidth: panelOpen ? PANEL_W : 0, borderRight: `1px solid ${C.border}`, flexShrink: 0 }}
      >
        {panelOpen && !loading && !error && (
          <PanelIzquierdo
            farmacias={filtradas}
            farmaciasSinCadena={farmaciasSinCadena}
            demografia={demografia}
            comunasDisponibles={comunas}
            regionesDisponibles={regiones}
            filtros={filtros}
            onChange={setFiltros}
            uploadedFiles={uploadedFiles}
            onRemoveFile={(i) => setUploadedFiles((fs) => fs.filter((_, j) => j !== i))}
          />
        )}
      </div>

      {/* Toggle */}
      <button
        onClick={() => setPanelOpen((o) => !o)}
        style={{
          position: "absolute", left: panelOpen ? PANEL_W - 1 : 0, top: "50%", transform: "translateY(-50%)",
          zIndex: 500, background: C.bgCard, border: `1px solid ${C.border}`,
          borderLeft: panelOpen ? "none" : `1px solid ${C.border}`,
          borderRadius: "0 6px 6px 0", color: C.text3, cursor: "pointer",
          padding: "10px 4px", display: "flex", alignItems: "center",
          transition: "left 0.22s cubic-bezier(.4,0,.2,1)",
          boxShadow: "2px 0 8px rgba(0,0,0,0.06)",
        }}
      >
        {panelOpen ? <IChevL /> : <IChevR />}
      </button>

      {/* Mapa */}
      <div style={{ flex: 1, position: "relative" }}>
        {loading && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
            <div style={{ textAlign: "center" }}>
              <div className="rl-spinner" style={{ margin: "0 auto 10px" }} />
              <p style={{ fontSize: 13, color: C.text3 }}>Cargando farmacias…</p>
            </div>
          </div>
        )}
        {error && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
            <p style={{ color: "#C13B3B", fontSize: 13 }}>Error: {error}</p>
          </div>
        )}
        {!loading && !error && (
          <Suspense fallback={
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
              <div className="rl-spinner" />
            </div>
          }>
            <MapaFarmacias
              farmacias={filtradas}
              onComunaClick={(c) => setFiltros((prev) => ({ ...prev, comuna: c }))}
            />
          </Suspense>
        )}
      </div>

      {uploadModal && (
        <UploadModal
          onClose={() => setUploadModal(false)}
          onUpload={(files) => { setUploadedFiles((f) => [...f, ...files]); setUploadModal(false); }}
        />
      )}
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const { farmacias, loading, error } = useFarmacias();
  const { datos: demografia } = useDemografia();
  const [page, setPage] = useState<Page>("resumen");
  const [uploadModal, setUploadModal] = useState(false);
  const [count, setCount] = useState(0);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: C.bg }}>
      <NavSidebar page={page} setPage={setPage} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Header
          page={page}
          count={loading ? 0 : count}
          total={farmacias.length}
          onUpload={() => setUploadModal(true)}
        />
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {page === "mapa" && (
            <PageMapa
              uploadModal={uploadModal}
              setUploadModal={setUploadModal}
              farmacias={farmacias}
              demografia={demografia}
              loading={loading}
              error={error}
              onCountChange={setCount}
            />
          )}
          {page === "movimientos" && <PageMovimientos />}
          {page === "cadenas" && <PageCadenas />}
          {page === "demografia" && <PageDemografia farmacias={farmacias} demografia={demografia} />}
          {page === "resumen" && <PageResumen farmacias={farmacias} demografia={demografia} />}
          {page === "sitios" && (
            <Suspense fallback={<div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}><div className="rl-spinner" /></div>}>
              <PageSitios farmacias={farmacias} />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}
