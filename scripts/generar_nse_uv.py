# Genera datos_maestros/nse_uv.geojson: unidades vecinales de todo Chile
# clasificadas por NSE (AIM Chile) a partir del shapefile de hogares por
# tramo de ingreso (bidat.gob.cl, 202406_shapes_hogares_ant).
#
# Metodología (evolución de knowledge/analisis/NSE_MANZANAS.ipynb):
# - Valores enmascarados por privacidad ("Valores entre 1 y 9") → 5
# - El mapeo 1:1 "tramo predominante → NSE" del notebook degenera (el tramo
#   0-4 concentra ~52% de hogares país y clasifica todo como E), así que se
#   clasifica por RANKING: puntaje de ingreso por UV → percentil nacional
#   ponderado por hogares → cortes según distribución AIM Chile
#
# Uso: python scripts/generar_nse_uv.py

import json
from pathlib import Path

import shapefile  # pyshp
from shapely.geometry import shape, mapping

BASE = Path(__file__).resolve().parent.parent
SHP_PATH = BASE / "knowledge" / "202406_shapes_hogares_ant" / "202406_shapes_hogares_ant.shp"
OUTPUT_PATH = BASE / "datos_maestros" / "nse_uv.geojson"

TRAMOS = ["0-4", "4-5", "5-6", "6-7", "7-8", "8-9", "9-1"]

# Valor ordinal de cada tramo para el puntaje de ingreso de la UV
ORDEN_TRAMO = {t: i + 1 for i, t in enumerate(TRAMOS)}


def clasificar_por_percentil(percentil: float) -> str:
    """
    Asigna el grupo NSE (AIM Chile) según el percentil nacional de la UV.

    Args:
        percentil: posición acumulada de la UV en el ranking nacional de
            puntaje de ingreso, ponderado por hogares. 0.0 = la UV más
            pobre del país, 1.0 = la más rica.

    Returns:
        str: grupo NSE ('AB', 'C1a', 'C1b', 'C2', 'C3', 'D', 'E')
    """
    # Cortes acumulados fieles a la distribución de hogares AIM Chile
    # (aprox. 2023): E 13% · D 37% · C3 25% · C2 12% · C1b 6% · C1a 6% ·
    # AB 1%. Fieles a la distribución nacional = defendibles ante cliente;
    # si la expansión pide más granularidad en el tramo alto, ajustar aquí
    # y regenerar.
    cortes = [
        (0.13, "E"),
        (0.50, "D"),
        (0.75, "C3"),
        (0.87, "C2"),
        (0.93, "C1b"),
        (0.99, "C1a"),
    ]
    for corte, grupo in cortes:
        if percentil < corte:
            return grupo
    return "AB"

# Tolerancia de simplificación en grados (~30 m) para reducir peso del GeoJSON
SIMPLIFY_TOL = 0.0003
COORD_DECIMALS = 5


def limpiar_conteo(valor) -> float:
    """Convierte el texto del DBF a número. Enmascarado INE → 5 (punto medio)."""
    try:
        return float(valor)
    except (ValueError, TypeError):
        if "Valores entre" in str(valor):
            return 5.0
        return 0.0


def redondear_coords(geom_dict: dict) -> dict:
    """Redondea las coordenadas del geojson para reducir tamaño de archivo."""

    def rec(coords):
        if isinstance(coords[0], (int, float)):
            return [round(c, COORD_DECIMALS) for c in coords]
        return [rec(c) for c in coords]

    geom_dict["coordinates"] = rec(geom_dict["coordinates"])
    return geom_dict


def main() -> None:
    sf = shapefile.Reader(str(SHP_PATH), encoding="latin-1")
    campos = [f[0] for f in sf.fields[1:]]  # el primer campo es DeletionFlag

    # Pasada 1: leer UVs y calcular puntaje de ingreso (promedio ponderado
    # del ordinal de tramo por hogares; 1 = todo en 0-4, 7 = todo en 9-10+)
    uvs = []
    omitidas = 0
    for sr in sf.iterShapeRecords():
        row = dict(zip(campos, sr.record))

        hogares = {t: limpiar_conteo(row[f"ndhet{t}-u"]) for t in TRAMOS}
        total = limpiar_conteo(row["totl-uv"])
        if total <= 0:
            omitidas += 1
            continue

        geom = shape(sr.shape.__geo_interface__).simplify(
            SIMPLIFY_TOL, preserve_topology=True
        )
        if geom.is_empty:
            omitidas += 1
            continue

        score = sum(ORDEN_TRAMO[t] * hogares[t] for t in TRAMOS) / total
        uvs.append({"row": row, "hogares": hogares, "total": total,
                    "score": score, "geom": geom})

    # Pasada 2: percentil nacional acumulado ponderado por hogares
    uvs.sort(key=lambda u: u["score"])
    hog_pais = sum(u["total"] for u in uvs)
    acumulado = 0.0
    for u in uvs:
        # percentil en el punto medio de la masa de hogares de la UV
        u["percentil"] = (acumulado + u["total"] / 2) / hog_pais
        acumulado += u["total"]

    features = []
    conteo_nse: dict[str, int] = {}
    for u in uvs:
        row, total = u["row"], u["total"]
        nse = clasificar_por_percentil(u["percentil"])
        conteo_nse[nse] = conteo_nse.get(nse, 0) + 1

        features.append(
            {
                "type": "Feature",
                "properties": {
                    "id": str(row["id_v_rs"]),
                    "comuna": str(row["nmbr_cm"]).title(),
                    "cut": int(row["cod_cmn"]),
                    "region": str(row["nmbr_rg"]).title(),
                    "nse": nse,
                    "hog": int(total),
                    "score": round(u["score"], 2),
                    "percentil": round(u["percentil"], 3),
                },
                "geometry": redondear_coords(mapping(u["geom"])),
            }
        )

    geojson = {"type": "FeatureCollection", "features": features}
    OUTPUT_PATH.write_text(
        json.dumps(geojson, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    peso_mb = OUTPUT_PATH.stat().st_size / 1e6
    print(f"Exportado: {OUTPUT_PATH} ({peso_mb:.1f} MB)")
    print(f"Unidades vecinales: {len(features):,} (omitidas sin hogares: {omitidas})")
    print("Distribución NSE:", dict(sorted(conteo_nse.items())))


if __name__ == "__main__":
    main()
