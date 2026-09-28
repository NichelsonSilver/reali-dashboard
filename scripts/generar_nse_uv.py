# Genera datos_maestros/nse_uv.geojson: unidades vecinales de todo Chile
# con un NSE ESTIMADO en los grupos AIM, a partir del shapefile de hogares por
# tramo de Calificación Socioeconómica del Registro Social de Hogares
# (bidat.gob.cl, 202406_shapes_hogares_ant). `hog` son hogares inscritos en
# el RSH, no hogares censales.
#
# Metodología (evolución de knowledge/analisis/NSE_MANZANAS.ipynb):
# - Valores enmascarados por privacidad ("Valores entre 1 y 9") → 5
# - El mapeo 1:1 "tramo predominante → NSE" del notebook degenera (el tramo
#   0-4 concentra ~52% de hogares país y clasifica todo como E), así que se
#   clasifica por RANKING: puntaje de ingreso por UV → percentil ponderado
#   por hogares → cortes de la distribución GSE de AIM.
# - Los cortes son los de la COMUNA de la UV (src/data/gse_aim_comuna.csv):
#   el RSH decide qué UV es más rica que otra dentro de la comuna, AIM decide
#   cuántos hogares de la comuna son de cada grupo. Con cortes nacionales
#   (hasta 2026-09) la capa se alejaba ~29 puntos de la distribución AIM de
#   cada comuna: el percentil nacional del RSH no sabe que el RSH sub-registra
#   los hogares de ingreso alto. Las comunas que AIM no publica usan los
#   cortes nacionales y quedan con `calib: "nacional"`.
#
# Requiere haber corrido scripts/exportar_gse_aim.py.
# Uso: python scripts/generar_nse_uv.py

import csv
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


GRUPOS = ["E", "D", "C3", "C2", "C1b", "C1a", "AB"]  # de menor a mayor ingreso

# Distribución nacional de hogares GSE AIM 2023 ("Total General" del Excel
# Perfiles-por-Regiones-y-Comunas-GSE-AIM-2023, Casen 2017+2022), en %.
# Hasta 2026-09 eran E 13 · D 37 · C3 25 · C2 12 · C1b 6 · C1a 6 · AB 1,
# rotulados "aprox. 2023" pero que son la distribución de 2018 (Casen 2015).
DIST_NACIONAL = {"E": 6.13, "D": 30.54, "C3": 29.03, "C2": 14.69,
                 "C1b": 8.41, "C1a": 9.15, "AB": 2.06}

GSE_AIM = BASE / "src" / "data" / "gse_aim_comuna.csv"


def cargar_gse_aim() -> dict[int, dict[str, float]]:
    """% de hogares por grupo de cada comuna (CUT), según AIM."""
    if not GSE_AIM.exists():
        raise SystemExit(f"Falta {GSE_AIM}: correr antes scripts/exportar_gse_aim.py")
    with open(GSE_AIM, encoding="utf-8") as f:
        return {int(r["cod_comuna"]): {g: float(r[g]) for g in GRUPOS}
                for r in csv.DictReader(f)}


def clasificar_por_percentil(percentil: float, dist: dict[str, float]) -> str:
    """
    Asigna el grupo NSE (AIM Chile) según la posición de la UV en su ranking.

    Args:
        percentil: posición acumulada de la UV en el ranking de puntaje de
            ingreso, ponderado por hogares. 0.0 = la UV más pobre, 1.0 = la
            más rica.
        dist: % de hogares por grupo del universo del ranking (la comuna, o
            el país si AIM no publica la comuna).

    Returns:
        str: grupo NSE ('AB', 'C1a', 'C1b', 'C2', 'C3', 'D', 'E')
    """
    total = sum(dist.values())
    acumulado = 0.0
    for grupo in GRUPOS[:-1]:
        acumulado += dist[grupo] / total
        if percentil < acumulado:
            return grupo
    return "AB"


def percentiles(uvs: list[dict]) -> list[float]:
    """Percentil de cada UV (ya ordenadas por puntaje) en el punto medio de su
    masa de hogares."""
    total = sum(u["total"] for u in uvs)
    salida, acumulado = [], 0.0
    for u in uvs:
        salida.append((acumulado + u["total"] / 2) / total)
        acumulado += u["total"]
    return salida

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

    # Pasada 2: percentil nacional (se conserva como propiedad) y percentil
    # dentro de la comuna, que es el que clasifica contra la distribución AIM
    uvs.sort(key=lambda u: u["score"])
    for u, pct in zip(uvs, percentiles(uvs)):
        u["percentil"] = pct

    gse_aim = cargar_gse_aim()
    por_comuna: dict[int, list[dict]] = {}
    for u in uvs:
        por_comuna.setdefault(int(u["row"]["cod_cmn"]), []).append(u)
    for cut, grupo_uvs in por_comuna.items():
        dist = gse_aim.get(cut)
        if dist is None:
            for u in grupo_uvs:
                u["nse"] = clasificar_por_percentil(u["percentil"], DIST_NACIONAL)
                u["calib"] = "nacional"
            continue
        for u, pct in zip(grupo_uvs, percentiles(grupo_uvs)):  # ya ordenadas
            u["nse"] = clasificar_por_percentil(pct, dist)
            u["calib"] = "aim_comuna"

    features = []
    conteo_nse: dict[str, int] = {}
    for u in uvs:
        row, total = u["row"], u["total"]
        nse = u["nse"]
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
                    "calib": u["calib"],
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
    nacionales = sum(1 for u in uvs if u["calib"] == "nacional")
    print(f"UV con cortes nacionales (comuna sin dato AIM): {nacionales}")


if __name__ == "__main__":
    main()
