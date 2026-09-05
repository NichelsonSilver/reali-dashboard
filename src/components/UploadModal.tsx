import { useState, useRef } from "react";

interface Props {
  onClose: () => void;
  onUpload: (files: { name: string; size: number }[]) => void;
}

// Tokens de marca REALI (diseño/paleta.md)
const C = {
  bg: "#F4F1EA", bgCard: "#FDFCFA", border: "#E3DFD3",
  text: "#0B1A2E", text2: "#3E4A61", text3: "#5D6880",
  accent: "#F5A524", accentText: "#9A6206",
};

// Colores por tipo de archivo (semánticos de dato, no de UI)
const EXT_COLOR: Record<string, string> = {
  xlsx: "#2D8A6B", csv: "#2D8A6B", kml: "#3E4A61", kmz: "#3E4A61",
  shp: "#9A6206", geojson: "#9A6206", json: "#9A6206",
};

function extColor(name: string) {
  return EXT_COLOR[name.split(".").pop()?.toLowerCase() ?? ""] ?? C.text3;
}

export default function UploadModal({ onClose, onUpload }: Props) {
  const [dragging, setDragging] = useState(false);
  const [queued, setQueued] = useState<{ name: string; size: number }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (fl: FileList | null) => {
    if (!fl) return;
    setQueued((q) => [...q, ...Array.from(fl).map((f) => ({ name: f.name, size: f.size }))]);
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(11,26,46,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, width: 480, maxWidth: "94vw", boxShadow: "0 20px 48px rgba(15,23,42,0.16)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Subir archivo al mapa</div>
            <div style={{ fontSize: 11, color: C.text3, marginTop: 3 }}>Formatos: XLSX, CSV, KML, KMZ, SHP, GeoJSON</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.text3, marginTop: 2 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div
          className={`upload-zone ${dragging ? "drag" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
        >
          <div style={{ color: C.text3, marginBottom: 8, fontSize: 28 }}>⬆</div>
          <p style={{ fontSize: 12, color: C.text2, marginBottom: 3 }}>Arrastra aquí o <span style={{ color: C.accentText, fontWeight: 600 }}>selecciona archivos</span></p>
          <p style={{ fontSize: 10.5, color: C.text3 }}>Máx. 50 MB por archivo</p>
          <input
            ref={inputRef} type="file" multiple
            accept=".xlsx,.csv,.kml,.kmz,.shp,.geojson,.json"
            style={{ display: "none" }}
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>

        {queued.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
            {queued.map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: C.bg, borderRadius: 6, border: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: extColor(f.name), background: "rgba(0,0,0,0.06)", padding: "1px 5px", borderRadius: 3 }}>
                    {f.name.split(".").pop()?.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 11, color: C.text2 }}>{f.name}</span>
                </div>
                <button onClick={() => setQueued((q) => q.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: C.text3 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <button
            onClick={onClose}
            className="rl-raise"
            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 13px", borderRadius: 6, fontSize: 11.5, fontWeight: 500, cursor: "pointer", background: C.bgCard, color: C.text2, border: `1px solid ${C.border}`, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}
          >
            Cancelar
          </button>
          <button
            onClick={() => queued.length > 0 && onUpload(queued)}
            className="rl-hover"
            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 13px", borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: queued.length === 0 ? "not-allowed" : "pointer", background: C.accent, color: C.text, border: "none", opacity: queued.length === 0 ? 0.4 : 1 }}
          >
            Cargar {queued.length > 0 ? `(${queued.length})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
