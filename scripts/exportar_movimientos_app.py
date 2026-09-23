"""
exportar_movimientos_app.py — Movimientos de todos los cortes → maestro de la app.

diff_maestro.py deja un `movimientos_<corte>.csv` por mes en
SCRAPER/FARMACIAS/EXCEL_WS/. La página Movimientos necesita la serie completa,
no el último mes, así que este script los apila en un solo maestro privado:

    SCRAPER/FARMACIAS/EXCEL_WS/movimientos_*.csv  ->  datos_maestros/movimientos.csv

Misma traducción de contrato que exportar_farmacias_app.py (y la misma tabla
REGION_CORTA, importada de ahí para que no haya dos): `nombre_local` → `nombre`,
`lng` → `lon`, región oficial → región corta.

Como con farmacias, de `datos_maestros/` en adelante manda tools/generar_demo.py:
este script NUNCA escribe en `src/data/`.

Uso:
    python scripts/exportar_movimientos_app.py
    python scripts/exportar_movimientos_app.py --verificar   # solo validar
"""

import argparse
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from exportar_farmacias_app import REGION_CORTA  # noqa: E402

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

RAIZ = Path(__file__).resolve().parents[1]
ENTRADAS = RAIZ / "SCRAPER" / "FARMACIAS" / "EXCEL_WS"
SALIDA_DEFECTO = RAIZ / "datos_maestros" / "movimientos.csv"

# Esquema que consume src/hooks/useMovimientos.ts. Cambiarlo obliga a tocar
# src/types.ts en el mismo commit.
ESQUEMA_APP = ["id", "movimiento", "mes_deteccion", "cadena", "tipo", "formato",
               "nombre", "direccion", "comuna", "region", "lat", "lon"]

MOVIMIENTOS_VALIDOS = {"apertura", "cierre"}


def cargar(entradas):
    archivos = sorted(entradas.glob("movimientos_*.csv"))
    # Los movimientos_cadenas/independientes viejos (diff_aperturas, abril-junio)
    # no traen mes_deteccion: se ignoran por nombre, solo cuentan los <AAAA_MM>.
    archivos = [a for a in archivos if a.stem.removeprefix("movimientos_")[:4].isdigit()]
    if not archivos:
        raise SystemExit(f"ABORTA: no hay movimientos_<AAAA_MM>.csv en {entradas}")
    partes = [pd.read_csv(a, dtype={"id": str}, keep_default_na=False) for a in archivos]
    return pd.concat(partes, ignore_index=True), archivos


def traducir(mov):
    df = pd.DataFrame({
        "id":            mov["id"],
        "movimiento":    mov["movimiento"],
        "mes_deteccion": mov["mes_deteccion"],
        "cadena":        mov["cadena"],
        "tipo":          mov["tipo"],
        "formato":       mov["formato"],
        "nombre":        mov["nombre_local"],
        "direccion":     mov["direccion"],
        "comuna":        mov["comuna"],
        "region":        mov["region"].map(REGION_CORTA),
        "lat":           mov["lat"],
        "lon":           mov["lng"],
    })
    # Re-exportar un corte no debe duplicarlo: un local se detecta abriendo o
    # cerrando una sola vez por mes.
    return (df.drop_duplicates(["id", "movimiento", "mes_deteccion"])
              .sort_values(["mes_deteccion", "movimiento", "cadena", "comuna", "id"])
              .reset_index(drop=True))


def verificar(mov):
    """Se corre sobre el crudo, antes de traducir: los errores citan el valor original."""
    problemas = []
    sin_region = sorted(set(mov["region"]) - set(REGION_CORTA))
    if sin_region:
        problemas.append(f"regiones sin mapeo en REGION_CORTA: {sin_region}")
    raros = set(mov["movimiento"]) - MOVIMIENTOS_VALIDOS
    if raros:
        problemas.append(f"movimientos desconocidos: {sorted(raros)}")
    malos = mov.loc[~mov["mes_deteccion"].str.fullmatch(r"\d{4}-\d{2}"), "mes_deteccion"]
    if len(malos):
        problemas.append(f"mes_deteccion fuera de AAAA-MM: {sorted(malos.unique())[:5]}")
    return problemas


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--entradas", type=Path, default=ENTRADAS)
    ap.add_argument("--output", type=Path, default=SALIDA_DEFECTO)
    ap.add_argument("--verificar", action="store_true", help="valida sin escribir")
    args = ap.parse_args()

    mov, archivos = cargar(args.entradas)
    problemas = verificar(mov)
    if problemas:
        for p in problemas:
            print("  ✗ " + p, file=sys.stderr)
        raise SystemExit(1)
    df = traducir(mov)

    print(f"  cortes: {', '.join(a.stem.removeprefix('movimientos_') for a in archivos)}")
    resumen = df.groupby(["mes_deteccion", "movimiento"]).size().unstack(fill_value=0)
    print(resumen.to_string())
    if args.verificar:
        return
    args.output.parent.mkdir(parents=True, exist_ok=True)
    df[ESQUEMA_APP].to_csv(args.output, index=False, encoding="utf-8", lineterminator="\n")
    print(f"  → {args.output.relative_to(RAIZ)}  ({len(df)} movimientos)")


if __name__ == "__main__":
    main()
