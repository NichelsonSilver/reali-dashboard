import { Farmacia } from "../types";
import { COLORES_CADENA, CADENAS } from "../constants";

interface Props {
  farmacias: Farmacia[];
  totalSinFiltro: number;
}

export default function KPIBar({ farmacias, totalSinFiltro }: Props) {
  const total = farmacias.length;

  // Conteo por cadena
  const porCadena = CADENAS.reduce<Record<string, number>>((acc, c) => {
    acc[c] = farmacias.filter((f) => f.cadena === c).length;
    return acc;
  }, {});

  const top3 = Object.entries(porCadena)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const comunas = new Set(farmacias.map((f) => f.comuna)).size;

  return (
    <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-6 overflow-x-auto shrink-0">
      {/* Total */}
      <div className="flex flex-col shrink-0">
        <span className="text-2xl font-bold text-white tabular-nums">
          {total.toLocaleString("es-CL")}
        </span>
        <span className="text-xs text-gray-500">
          farmacias
          {total !== totalSinFiltro && (
            <span className="ml-1 text-teal-400">
              / {totalSinFiltro.toLocaleString("es-CL")} total
            </span>
          )}
        </span>
      </div>

      <div className="w-px h-8 bg-gray-800" />

      {/* Comunas */}
      <div className="flex flex-col shrink-0">
        <span className="text-2xl font-bold text-white tabular-nums">
          {comunas}
        </span>
        <span className="text-xs text-gray-500">comunas</span>
      </div>

      <div className="w-px h-8 bg-gray-800" />

      {/* Top cadenas */}
      <div className="flex items-center gap-4">
        {top3.map(([cadena, count]) => (
          <div key={cadena} className="flex items-center gap-1.5 shrink-0">
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background:
                  COLORES_CADENA[cadena as keyof typeof COLORES_CADENA] ??
                  "#888",
              }}
            />
            <span className="text-xs text-gray-300">
              {cadena}{" "}
              <span className="font-semibold text-white">{count}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
