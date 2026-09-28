"""
Exporta el GSE oficial de AIM Chile por comuna a src/data/gse_aim_comuna.csv.

Entrada: knowledge/aim/Perfiles-por-Regiones-y-Comunas-GSE-AIM-2023.xlsx
         (Comité GSE AIM; fusión de hogares Casen 2017 + Casen 2022).
         Descarga: https://aimchile.cl/gse-chile/
Salida:  src/data/gse_aim_comuna.csv — una fila por comuna, % de hogares por
         grupo (AB, C1a, C1b, C2, C3, D, E), llave `cod_comuna` (CUT del INE).

Por qué existe: el NSE de nse_uv.geojson es una ESTIMACIÓN nuestra (tramos
CSE del Registro Social de Hogares llevados a grupos AIM por percentil
nacional). Cada UV queda con un solo grupo, así que al agregarlas se pierde la
mezcla de hogares dentro de la UV: Providencia salía 80% C1a contra 45% en el
dato AIM. Para cifras por comuna manda el dato publicado; la capa por UV
sigue sirviendo para el mapa y el radio de un sitio, marcada como estimada.

Uso: python scripts/exportar_gse_aim.py
"""

import csv
import json
import sys
import unicodedata
from pathlib import Path

import openpyxl

BASE = Path(__file__).resolve().parent.parent
XLSX = BASE / "knowledge" / "aim" / "Perfiles-por-Regiones-y-Comunas-GSE-AIM-2023.xlsx"
SALIDA = BASE / "src" / "data" / "gse_aim_comuna.csv"
# Fuentes del nombre → CUT: el maestro NSE (todas las UV del país) y el censo
NSE_MAESTRO = BASE / "datos_maestros" / "nse_uv.geojson"
CENSO = BASE / "src" / "data" / "demografia_censo.csv"

GRUPOS = ["AB", "C1a", "C1b", "C2", "C3", "D", "E"]

# Grafías de AIM que no calzan con el nombre INE/RSH normalizado
ALIAS = {
    "calera": "la calera",
    "marchigue": "marchihue",
    "aysen": "aisen",
    "coyhaique": "coihaique",
    "o'higgins": "ohiggins",
    "llay-llay": "llaillay",
    "llay llay": "llaillay",
    "cabo de hornos": "cabo de hornos",
    "trehuaco": "treguaco",
    "paiguano": "paihuano",
    "til til": "tiltil",
}


def norm(txt: str) -> str:
    """Minúsculas, sin tildes ni eñes, espacios simples."""
    s = unicodedata.normalize("NFKD", str(txt)).encode("ascii", "ignore").decode()
    s = " ".join(s.lower().replace("'", "").split())
    return ALIAS.get(s, s)


def mapa_cut() -> dict[str, int]:
    cuts: dict[str, int] = {}
    with open(NSE_MAESTRO, encoding="utf-8") as f:
        for feat in json.load(f)["features"]:
            p = feat["properties"]
            cuts.setdefault(norm(p["comuna"]), int(p["cut"]))
    with open(CENSO, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if not row["nombre_comuna"].startswith("Comuna "):
                cuts.setdefault(norm(row["nombre_comuna"]), int(row["cod_comuna"]))
    return cuts


def main() -> None:
    if not XLSX.exists():
        sys.exit(f"Falta {XLSX}. Descargarlo de https://aimchile.cl/gse-chile/")

    ws = openpyxl.load_workbook(XLSX, data_only=True, read_only=True).active
    filas = list(ws.iter_rows(values_only=True))
    encabezado = next(i for i, r in enumerate(filas) if r and r[1] == "AB")
    if list(filas[encabezado][1:8]) != GRUPOS:
        sys.exit(f"ABORTA: cambió el encabezado del Excel AIM: {filas[encabezado]}")

    cuts = mapa_cut()
    salida, sin_cut = [], []
    for r in filas[encabezado + 1:]:
        nombre = r[0]
        if not nombre or str(nombre).startswith(("Región", "Regi")) or str(nombre).startswith("Total"):
            continue
        cut = cuts.get(norm(nombre))
        if cut is None:
            sin_cut.append(str(nombre))
            continue
        pct = [float(v or 0) for v in r[1:8]]
        if abs(sum(pct) - 100) > 0.5:
            sys.exit(f"ABORTA: {nombre} suma {sum(pct):.2f}%, no 100")
        salida.append({"cod_comuna": cut, "comuna": nombre,
                       **{g: round(v, 2) for g, v in zip(GRUPOS, pct)}})

    if sin_cut:
        sys.exit(f"ABORTA: {len(sin_cut)} comunas AIM sin CUT (agregar a ALIAS): {sin_cut}")
    repetidos = len(salida) - len({s["cod_comuna"] for s in salida})
    if repetidos:
        sys.exit(f"ABORTA: {repetidos} CUT repetidos: revisar ALIAS")

    salida.sort(key=lambda s: s["cod_comuna"])
    with open(SALIDA, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["cod_comuna", "comuna", *GRUPOS])
        w.writeheader()
        w.writerows(salida)
    print(f"Exportado: {SALIDA} ({len(salida)} comunas)")


if __name__ == "__main__":
    main()
