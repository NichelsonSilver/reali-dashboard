"""
exportar_farmacias_app.py — Último tramo del pipeline: maestro → base de la app.

Cierra el hueco que tenía el pipeline: existía hasta MAESTRO_FARMACIAS_<mes>.xlsx
y ahí se cortaba, así que la app quedó sirviendo el CSV de abril mientras el
maestro bueno avanzaba sin llegar nunca al dashboard. Este script es el puente,
y es parte de la corrida mensual, no un trámite aparte.

DOS CONTRATOS, UNA TRADUCCIÓN
El maestro habla el idioma del dominio: `lng`, `nombre_local`, y la región con
su nombre oficial completo ('Región del Libertador Bernardo O'Higgins'), que es
el vocabulario del shapefile y el que permite joins. La app habla el idioma de
la UI: `lon`, `nombre`, y la región corta ("O'Higgins"), que es la que cabe en
un filtro. La traducción vive acá y solo acá — un único lugar donde mirar cuando
algo no calza.

De `datos_maestros/farmacias.csv` en adelante manda tools/generar_demo.py, que
recorta la muestra publicable. Este script escribe el MAESTRO privado, nunca
`src/data/` directamente.

Uso:
    python scripts/exportar_farmacias_app.py \
        --maestro SCRAPER/FARMACIAS/EXCEL_WS/MAESTRO_FARMACIAS_agosto.xlsx

    # solo validar, sin escribir:
    python scripts/exportar_farmacias_app.py --maestro <ruta> --verificar
"""

import argparse
import sys
from pathlib import Path

import pandas as pd

if hasattr(sys.stdout, "reconfigure"):
    # La salida lleva flechas y acentos, y la consola de Windows arranca en
    # cp1252: sin esto el script muere con UnicodeEncodeError DESPUES de haber
    # leido y traducido el maestro, en el print del resumen. El mismo patron
    # esta en WB_MINSAL_5_4_scrapling.py. Las tools de tools/ resuelven lo
    # mismo al reves, restringiendo su salida a ASCII.
    sys.stdout.reconfigure(encoding="utf-8")

RAIZ = Path(__file__).resolve().parents[1]
SALIDA_DEFECTO = RAIZ / "datos_maestros" / "farmacias.csv"

# Esquema que consume src/hooks/useFarmacias.ts. Cambiarlo obliga a tocar
# src/types.ts en el mismo commit.
ESQUEMA_APP = ["id", "nombre", "cadena", "tipo", "formato", "direccion",
               "comuna", "cod_comuna", "region", "lat", "lon", "modalidad",
               "telefono", "horario", "fecha_corte"]

# Nombre oficial (shapefile) → nombre corto (REGIONES_CHILE en src/constants.ts).
# Las 16 regiones están mapeadas a propósito, sin fallback silencioso: si el
# shapefile cambia una grafía, queremos enterarnos acá y no ver un filtro vacío.
REGION_CORTA = {
    "Región de Arica y Parinacota":               "Arica y Parinacota",
    "Región de Tarapacá":                         "Tarapacá",
    "Región de Antofagasta":                      "Antofagasta",
    "Región de Atacama":                          "Atacama",
    "Región de Coquimbo":                         "Coquimbo",
    "Región de Valparaíso":                       "Valparaíso",
    "Región Metropolitana de Santiago":           "Metropolitana",
    "Región del Libertador Bernardo O'Higgins":   "O'Higgins",
    "Región del Maule":                           "Maule",
    "Región de Ñuble":                            "Ñuble",
    "Región del Bío-Bío":                         "Biobío",
    "Región de La Araucanía":                     "La Araucanía",
    "Región de Los Ríos":                         "Los Ríos",
    "Región de Los Lagos":                        "Los Lagos",
    "Región de Aysén del Gral.Ibañez del Campo":  "Aysén",
    "Región de Magallanes y Antártica Chilena":   "Magallanes",
}

TIPOS_VALIDOS = {"cadena", "independiente", "otra"}
FORMATOS_VALIDOS = {"farmacia", "perfumeria"}


def traducir(maestro):
    """Maestro (dominio) → DataFrame con el esquema que espera la app."""
    df = pd.DataFrame({
        "id":          maestro["id"],
        "nombre":      maestro["nombre_local"],
        "cadena":      maestro["cadena"],
        "tipo":        maestro["tipo"],
        "formato":     maestro["formato"],
        "direccion":   maestro["direccion"],
        "comuna":      maestro["comuna"],
        "cod_comuna":  maestro["cod_comuna"],
        "region":      maestro["region"].map(REGION_CORTA),
        "lat":         maestro["lat"],
        "lon":         maestro["lng"],          # lng (dominio) → lon (app)
        "modalidad":   maestro["modalidad"],
        "telefono":    maestro["telefono"],
        "horario":     maestro["horario"],
        "fecha_corte": maestro["fecha_corte"],
    })
    # Excel no distingue "" de vacío: al releer el maestro los campos opcionales
    # vuelven como NaN, y un astype(str) los convertiría en el literal "nan"
    # viajando hasta el popup del mapa. Se normalizan antes de tocarlos.
    # Excel guarda todo número como double, así que el CUT vuelve del maestro
    # como 15101.0 y se escribiría así en el CSV. Es un código, no una cantidad.
    df["cod_comuna"] = pd.to_numeric(df["cod_comuna"], errors="coerce").astype("Int64")

    for col in ("modalidad", "telefono", "horario"):
        df[col] = df[col].fillna("").astype(str).str.strip()
        df[col] = df[col].replace({"nan": "", "None": ""})

    # El horario de MINSAL trae saltos de línea; en un CSV que se parsea en el
    # browser eso es una fila rota esperando a pasar.
    df["horario"] = df["horario"].str.replace(r"\s*\n\s*", " · ", regex=True).str.strip()
    return df[ESQUEMA_APP]


def validar(df, maestro):
    """(problemas, avisos).

    PROBLEMA = el export no sirve y hay que parar (ids rotos, catálogo violado,
    una región entera sin traducir). AVISO = dato incompleto en filas puntuales,
    que se publica igual porque ocultarlo sería peor: hay que verlo para poder
    arreglarlo aguas arriba.
    """
    problemas, avisos = [], []

    if df["id"].duplicated().any():
        n = int(df["id"].duplicated().sum())
        problemas.append(f"{n} ids duplicados")

    sin_coord = int(df["lat"].isna().sum() + df["lon"].isna().sum())
    if sin_coord:
        problemas.append(f"{sin_coord} filas sin coordenada (no se pueden mapear)")

    # Una región sin traducir deja el filtro de la app sin esa zona completa.
    sin_region = maestro.loc[df["region"].isna(), "region"].dropna().unique()
    if len(sin_region):
        problemas.append(f"regiones sin mapeo en REGION_CORTA: {sorted(sin_region)}")

    tipos = set(df["tipo"].dropna()) - TIPOS_VALIDOS
    if tipos:
        problemas.append(f"tipos fuera del catálogo: {sorted(tipos)}")

    formatos = set(df["formato"].dropna()) - FORMATOS_VALIDOS
    if formatos:
        problemas.append(f"formatos fuera del catálogo: {sorted(formatos)}")

    if df["tipo"].isna().any():
        problemas.append(f"{int(df['tipo'].isna().sum())} filas sin tipo")

    cortes = df["fecha_corte"].dropna().unique()
    if len(cortes) != 1:
        problemas.append(f"fecha_corte no es única: {sorted(cortes)}")

    # Coordenada válida pero fuera de todo polígono comunal (borde, mar, error de
    # geocodificación). Mapean bien, pero no aparecen en ningún filtro por región.
    huerfanas = int(df["region"].isna().sum())
    if huerfanas:
        avisos.append(f"{huerfanas} locales sin región: su coordenada cae fuera "
                      f"de todo polígono comunal. Mapean, pero no salen en filtros.")

    sin_cod = int(df["cod_comuna"].isna().sum())
    if sin_cod:
        avisos.append(f"{sin_cod} locales sin cod_comuna: no joinean con el censo")

    return problemas, avisos


def exportar(maestro_path, salida, solo_verificar=False):
    maestro = pd.read_excel(maestro_path)
    faltan = set(["id", "nombre_local", "cadena", "tipo", "formato", "lng",
                  "fecha_corte"]) - set(maestro.columns)
    if faltan:
        raise ValueError(f"{Path(maestro_path).name} no tiene {sorted(faltan)}: "
                         f"no es un maestro del esquema nuevo")

    df = traducir(maestro)
    problemas, avisos = validar(df, maestro)

    corte = df["fecha_corte"].dropna().iloc[0] if not df.empty else "?"
    print(f"  Maestro: {Path(maestro_path).name} ({len(maestro)} locales, corte {corte})")
    print(f"  → tipo:    {df['tipo'].value_counts().to_dict()}")
    print(f"  → formato: {df['formato'].value_counts().to_dict()}")
    print(f"  → regiones: {df['region'].nunique()} | comunas: {df['comuna'].nunique()}")
    print(f"  → con teléfono: {int((df['telefono'].astype(str) != '').sum())} | "
          f"con horario: {int((df['horario'].astype(str) != '').sum())}")

    for a in avisos:
        print(f"  ⚠  {a}")

    if problemas:
        print("  ✗ PROBLEMAS (no se escribe nada):")
        for p in problemas:
            print(f"      · {p}")
        return df, problemas

    print("  ✓ validación OK")
    if solo_verificar:
        print("  (--verificar: no se escribió nada)")
        return df, problemas

    salida = Path(salida)
    salida.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(salida, index=False, encoding="utf-8")
    print(f"  ✓ Escrito → {salida} ({len(df)} filas)")
    print("  Siguiente: python tools/generar_demo.py  (recorta la muestra publicable)")
    return df, problemas


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Maestro de farmacias → base de la app")
    parser.add_argument("--maestro", required=True, help="MAESTRO_FARMACIAS_<mes>.xlsx")
    parser.add_argument("--output", default=str(SALIDA_DEFECTO),
                        help=f"CSV de salida (default: {SALIDA_DEFECTO})")
    parser.add_argument("--verificar", action="store_true",
                        help="Valida sin escribir; exit 1 si hay problemas")
    args = parser.parse_args()
    _, problemas = exportar(args.maestro, args.output, args.verificar)
    sys.exit(1 if problemas else 0)
