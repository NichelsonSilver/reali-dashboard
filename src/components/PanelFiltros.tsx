import { CadenaFarmaceutica, FiltrosActivos } from "../types";
import { CADENAS, COLORES_CADENA } from "../constants";

interface Props {
  comunasDisponibles: string[];
  regionesDisponibles: string[];
  filtros: FiltrosActivos;
  onChange: (filtros: FiltrosActivos) => void;
}

function toggleItem<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

export default function PanelFiltros({
  comunasDisponibles,
  regionesDisponibles,
  filtros,
  onChange,
}: Props) {
  const toggleCadena = (c: CadenaFarmaceutica) =>
    onChange({ ...filtros, cadenas: toggleItem(filtros.cadenas, c) });

  const toggleRegion = (r: string) =>
    onChange({ ...filtros, regiones: toggleItem(filtros.regiones, r) });

  const toggleComuna = (c: string) =>
    onChange({ ...filtros, comunas: toggleItem(filtros.comunas, c) });

  const limpiar = () =>
    onChange({ cadenas: [], regiones: [], comunas: [], zonas: [] });

  const hayFiltros =
    filtros.cadenas.length > 0 ||
    filtros.regiones.length > 0 ||
    filtros.comunas.length > 0;

  return (
    <aside className="w-64 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-300">Filtros</h2>
        {hayFiltros && (
          <button
            onClick={limpiar}
            className="text-xs text-teal-400 hover:text-teal-300"
          >
            Limpiar
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
        {/* Cadenas */}
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Cadena
          </h3>
          <div className="space-y-1">
            {CADENAS.map((c) => {
              const activo = filtros.cadenas.includes(c);
              return (
                <button
                  key={c}
                  onClick={() => toggleCadena(c)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors ${
                    activo
                      ? "bg-gray-700 text-white"
                      : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: COLORES_CADENA[c] }}
                  />
                  {c}
                </button>
              );
            })}
          </div>
        </section>

        {/* Regiones */}
        {regionesDisponibles.length > 1 && (
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Región
            </h3>
            <div className="space-y-1">
              {regionesDisponibles.map((r) => {
                const activo = filtros.regiones.includes(r);
                return (
                  <button
                    key={r}
                    onClick={() => toggleRegion(r)}
                    className={`w-full px-2 py-1.5 rounded text-xs text-left transition-colors ${
                      activo
                        ? "bg-gray-700 text-white"
                        : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                    }`}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Comunas */}
        {comunasDisponibles.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Comuna
            </h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {comunasDisponibles.map((c) => {
                const activo = filtros.comunas.includes(c);
                return (
                  <button
                    key={c}
                    onClick={() => toggleComuna(c)}
                    className={`w-full px-2 py-1.5 rounded text-xs text-left transition-colors ${
                      activo
                        ? "bg-gray-700 text-white"
                        : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}
