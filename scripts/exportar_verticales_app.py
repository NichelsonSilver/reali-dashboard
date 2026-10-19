"""
exportar_verticales_app.py — Maestros de bencineras y conveniencia → base de la app.

Mismo papel que exportar_farmacias_app.py para los verticales 2 y 3: la
traducción dominio → UI vive acá y solo acá (`lng` → `lon`, `nombre_local` →
`nombre`, región oficial → corta con la misma REGION_CORTA, sin fallback).

Lo que NO viaja a la app:
  · `operador` de conveniencia: dice quién opera la marca, y la guarda del
    espejo público bloquea el nombre del cliente. El dato vive en el maestro.
  · `fuente`, `id_fuente`, `requiere_revision`, `en_fuente`: plomería del pipeline.
  · las filas `cerrada`, igual que en farmacias.

`fecha_dato` (conveniencia) es la fecha del dato, no la del corte: casi siempre
la de la captura, pero una marca leída de un archivo (Spid desde Wayback)
trae la de la copia. Así la edad del dato llega al popup.

Escribe los maestros privados en datos_maestros/; de ahí manda
tools/generar_demo.py, que recorta la muestra publicable.

Uso:
    python scripts/exportar_verticales_app.py \
        --bencineras  SCRAPER/BENCINERAS/EXCEL_WS/MAESTRO_BENCINERAS_<corte>.xlsx \
        --conveniencia SCRAPER/CONVENIENCIA/EXCEL_WS/MAESTRO_CONVENIENCIA_<corte>.xlsx
    # --verificar: valida sin escribir
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
MAESTROS = RAIZ / "datos_maestros"

# Esquemas que consumen src/hooks/useCapasVerticales.ts. Cambiarlos obliga a
# tocar `Bencinera` / `TiendaConveniencia` en src/types.ts en el mismo commit.
ESQUEMA_BENCINERAS = ["id", "nombre", "cadena", "tipo", "formato", "direccion",
                      "comuna", "cod_comuna", "region", "lat", "lon", "combustibles",
                      "atencion", "electrolinera", "coord_dudosa", "estado",
                      "cerrada_desde", "fecha_corte"]
ESQUEMA_CONVENIENCIA = ["id", "nombre", "cadena", "formato", "tipologia", "direccion",
                        "comuna", "cod_comuna", "region", "lat", "lon", "id_estacion_cne",
                        "servicios", "coord_dudosa", "estado", "cerrada_desde",
                        "fecha_dato", "fecha_corte"]

TIPOS_BENCINERAS = {"mayorista", "regional", "independiente"}
FORMATOS_BENCINERAS = {"combustible", "gas_vehicular", "sin_dato"}
FORMATOS_CONVENIENCIA = {"calle", "bencinera"}


def _texto(serie):
    """Opcionales: Excel devuelve NaN donde había vacío, y un astype(str) lo
    llevaría como el literal 'nan' hasta el popup."""
    return serie.fillna("").astype(str).str.strip().replace({"nan": "", "None": ""})


def _comunes(maestro):
    return {
        "id":            maestro["id"],
        "nombre":        maestro["nombre_local"],
        "cadena":        maestro["cadena"],
        "formato":       maestro["formato"],
        "direccion":     _texto(maestro["direccion"]),
        "comuna":        maestro["comuna"],
        "cod_comuna":    pd.to_numeric(maestro["cod_comuna"], errors="coerce").astype("Int64"),
        "region":        maestro["region"].map(REGION_CORTA),
        "lat":           maestro["lat"],
        "lon":           maestro["lng"],
        "coord_dudosa":  maestro["coord_dudosa"].fillna(0).astype(bool).astype(int),
        "estado":        maestro["estado"],
        "cerrada_desde": _texto(maestro["cerrada_desde"]),
        "fecha_corte":   maestro["fecha_corte"],
    }


def traducir_bencineras(maestro):
    df = pd.DataFrame({
        **_comunes(maestro),
        "tipo":          maestro["tipo"],
        "combustibles":  _texto(maestro["combustibles"]),
        "atencion":      _texto(maestro["atencion"]),
        "electrolinera": maestro["electrolinera"].fillna(0).astype(bool).astype(int),
    })
    return df[ESQUEMA_BENCINERAS]


def traducir_conveniencia(maestro):
    df = pd.DataFrame({
        **_comunes(maestro),
        "tipologia":       _texto(maestro["tipologia"]),
        "id_estacion_cne": _texto(maestro["id_estacion_cne"]),
        "servicios":       _texto(maestro["servicios"]),
        # "pronto 2026-10-18" · "spid archivo 2026-07-31 + decisión 2026-09":
        # la primera fecha completa es la del dato.
        "fecha_dato":      maestro["fuente"].astype(str).str.extract(r"(\d{4}-\d{2}-\d{2})")[0],
    })
    return df[ESQUEMA_CONVENIENCIA]


def validar(df, maestro, tipos=None, formatos=None):
    """(problemas, avisos), con el mismo criterio que farmacias: un problema
    para el export, un aviso se publica igual para que se vea."""
    problemas, avisos = [], []
    if df["id"].duplicated().any():
        problemas.append(f"{int(df['id'].duplicated().sum())} ids duplicados")
    # A diferencia de farmacias, no es problema: la CNE publica estaciones reales
    # sin punto (una Shell de Quillota en 2026-09). Se cuentan, no se dibujan.
    sin_coord = int(df["lat"].isna().sum())
    if sin_coord:
        avisos.append(f"{sin_coord} locales sin coordenada: se cuentan pero no se dibujan")
    sin_region = maestro.loc[df["region"].isna(), "region"].dropna().unique()
    if len(sin_region):
        problemas.append(f"regiones sin mapeo en REGION_CORTA: {sorted(sin_region)}")
    if tipos is not None:
        raros = set(df["tipo"].dropna()) - tipos
        if raros or df["tipo"].isna().any():
            problemas.append(f"tipos fuera del catálogo o vacíos: {sorted(raros)}")
    raros = set(df["formato"].dropna()) - formatos
    if raros or df["formato"].isna().any():
        problemas.append(f"formatos fuera del catálogo o vacíos: {sorted(raros)}")
    if df["fecha_corte"].nunique() != 1:
        problemas.append(f"fecha_corte no es única: {sorted(df['fecha_corte'].unique())}")
    if "fecha_dato" in df and df["fecha_dato"].isna().any():
        problemas.append(f"{int(df['fecha_dato'].isna().sum())} filas sin fecha_dato "
                         "(la `fuente` del maestro no trae fecha)")
    huerfanas = int(df["region"].isna().sum())
    if huerfanas:
        avisos.append(f"{huerfanas} locales sin región: mapean, pero no salen en filtros")
    dudosas = int(df["coord_dudosa"].sum())
    if dudosas:
        avisos.append(f"{dudosas} locales con coord_dudosa: se cuentan pero no se dibujan")
    return problemas, avisos


VERTICALES = {
    "bencineras":   (traducir_bencineras, TIPOS_BENCINERAS, FORMATOS_BENCINERAS),
    "conveniencia": (traducir_conveniencia, None, FORMATOS_CONVENIENCIA),
}


def exportar(vertical, maestro_path, salida, solo_verificar=False):
    traducir, tipos, formatos = VERTICALES[vertical]
    maestro = pd.read_excel(maestro_path)
    cerradas = maestro["estado"] == "cerrada"
    maestro = maestro[~cerradas].reset_index(drop=True)
    df = traducir(maestro)
    problemas, avisos = validar(df, maestro, tipos, formatos)

    print(f"  {vertical}: {Path(maestro_path).name} → {len(df)} locales "
          f"({int(cerradas.sum())} cerradas no se publican), corte {df['fecha_corte'].iloc[0]}")
    print(f"  → por cadena: {df['cadena'].value_counts().head(8).to_dict()}")
    for a in avisos:
        print(f"  ⚠  {a}")
    if problemas:
        print("  ✗ PROBLEMAS (no se escribe nada):")
        for p in problemas:
            print(f"      · {p}")
        return problemas
    if not solo_verificar:
        Path(salida).parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(salida, index=False, encoding="utf-8")
        print(f"  ✓ Escrito → {salida}")
    return problemas


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Maestros de bencineras y conveniencia → base de la app")
    ap.add_argument("--bencineras", help="MAESTRO_BENCINERAS_<corte>.xlsx")
    ap.add_argument("--conveniencia", help="MAESTRO_CONVENIENCIA_<corte>.xlsx")
    ap.add_argument("--verificar", action="store_true", help="valida sin escribir; exit 1 si hay problemas")
    args = ap.parse_args()
    if not (args.bencineras or args.conveniencia):
        ap.error("indica --bencineras y/o --conveniencia")
    problemas = []
    for vertical in ("bencineras", "conveniencia"):
        ruta = getattr(args, vertical)
        if ruta:
            problemas += exportar(vertical, ruta, MAESTROS / f"{vertical}.csv", args.verificar)
    if not problemas:
        print("  Siguiente: python tools/generar_demo.py  (recorta la muestra publicable)")
    sys.exit(1 if problemas else 0)
