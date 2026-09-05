"""
Preprocesa Microdatos_Manzana.shp → GeoJSON filtrado a Región Metropolitana.

Salida:
  datos_maestros/manzanas_rm.geojson — 48k manzanas con atributos censales

Requisitos: pip install pyshp pyproj shapely
"""
import json
import sys
from pathlib import Path

import shapefile
from pyproj import Transformer
from shapely.geometry import shape, mapping

ROOT = Path(__file__).resolve().parent.parent
SHP = ROOT / "knowledge" / "microdatos_manzana" / "Microdatos_Manzana"
OUT_MANZANAS = ROOT / "datos_maestros" / "manzanas_rm.geojson"

# El .shp está en EPSG:3857 (Web Mercator). Lo convertimos a EPSG:4326 para Leaflet.
TRANSFORMER = Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True)

# Tolerancia de simplificación en metros (Web Mercator). 8m ≈ medio ancho de calle.
SIMPLIFY_TOLERANCE_M = 8.0

# Solo columnas útiles para la coropleta (el resto engorda el JSON sin aportar).
CAMPOS = [
    "CUT", "COMUNA", "PROVINCIA", "MANZENT",
    "TOTAL_PERS", "TOTAL_HOMB", "TOTAL_MUJE",
    "TOTAL_VIVI", "CANTIDAD_H",
]


def round_coords(geom, ndigits=5):
    """Trunca decimales de coordenadas para reducir tamaño del JSON."""
    def _round(coords):
        if isinstance(coords, (list, tuple)):
            if coords and isinstance(coords[0], (int, float)):
                return [round(c, ndigits) for c in coords]
            return [_round(c) for c in coords]
        return coords
    geom["coordinates"] = _round(geom["coordinates"])
    return geom


def reproject_geom(geom_shapely):
    """Reproyecta una geometría shapely de EPSG:3857 a EPSG:4326."""
    from shapely.ops import transform
    return transform(lambda x, y, z=None: TRANSFORMER.transform(x, y), geom_shapely)


def to_int(v):
    try:
        return int(str(v).strip())
    except (ValueError, TypeError):
        return 0


def main():
    print(f"[1/4] Leyendo {SHP}.shp ...")
    reader = shapefile.Reader(str(SHP))
    total = len(reader)
    print(f"      {total:,} registros en el país")

    manzanas_features = []

    print("[2/3] Filtrando RM y simplificando ...")
    for i, sr in enumerate(reader.iterShapeRecords(fields=CAMPOS), start=1):
        cut = sr.record["CUT"]
        if not (13000 < cut < 14000):
            continue

        geom_sh = shape(sr.shape.__geo_interface__)
        if geom_sh.is_empty:
            continue

        # Simplificar en metros (el CRS es Mercator)
        geom_sh = geom_sh.simplify(SIMPLIFY_TOLERANCE_M, preserve_topology=True)
        if geom_sh.is_empty:
            continue

        pers = to_int(sr.record["TOTAL_PERS"])

        # Reproyectar a 4326 para salida
        geom_4326 = reproject_geom(geom_sh)
        geom_json = round_coords(mapping(geom_4326))

        manzanas_features.append({
            "type": "Feature",
            "geometry": geom_json,
            "properties": {
                "id": sr.record["MANZENT"].strip(),
                "cut": cut,
                "comuna": sr.record["COMUNA"].strip(),
                "pob": pers,
                "hom": to_int(sr.record["TOTAL_HOMB"]),
                "muj": to_int(sr.record["TOTAL_MUJE"]),
                "viv": to_int(sr.record["TOTAL_VIVI"]),
                "hog": to_int(sr.record["CANTIDAD_H"]),
            },
        })

        if i % 20000 == 0:
            print(f"      procesados {i:,}/{total:,}")

    print(f"      manzanas RM: {len(manzanas_features):,}")

    print("[3/3] Escribiendo GeoJSON ...")
    OUT_MANZANAS.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_MANZANAS, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": manzanas_features}, f,
                  ensure_ascii=False, separators=(",", ":"))

    size_m = OUT_MANZANAS.stat().st_size / 1_048_576
    print(f"      {OUT_MANZANAS.name}: {size_m:.1f} MB")
    print("[OK] listo")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
