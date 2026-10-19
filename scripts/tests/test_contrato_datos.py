"""Contrato de datos entre el pipeline (Python) y la app (TypeScript).

El maestro y la app hablan esquemas distintos a propósito (`lng`/`lon`,
`nombre_local`/`nombre`, región oficial/corta) y la traducción vive solo en
los exportadores. Lo que estos tests cuidan es que los dos lados no se
desincronicen en silencio: una columna que el exportador deja de emitir, o
una marca que el maestro clasifica y la app no conoce, no rompen el build —
la app lee el CSV con `?raw` y un campo faltante llega como vacío. Por eso
el chequeo tiene que ser explícito.

Leen archivos fuente, no datos de un corte: prueban el contrato, no un mes.

El repo público (reali-dashboard) recibe este archivo pero no el pipeline
(`SCRAPER/`): ahí los tests del catálogo se saltan y los de esquema corren.
"""
import csv
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "SCRAPER" / "MINSAL_scraper"))
sys.path.insert(0, str(RAIZ / "SCRAPER" / "CONVENIENCIA"))

import pytest  # noqa: E402

import exportar_farmacias_app  # noqa: E402
import exportar_movimientos_app  # noqa: E402
import exportar_verticales_app  # noqa: E402

try:
    from maestro_farmacias import CLASIFICACION
except ImportError:  # repo público: sin pipeline
    CLASIFICACION = None

requiere_pipeline = pytest.mark.skipif(CLASIFICACION is None,
                                       reason="sin SCRAPER/ (repo público)")

TYPES = (RAIZ / "src" / "types.ts").read_text(encoding="utf-8")
CONSTANTS = (RAIZ / "src" / "constants.ts").read_text(encoding="utf-8")


def campos_interface(nombre):
    """Campos de una `export interface` de types.ts, en orden."""
    m = re.search(rf"export interface {nombre} \{{(.*?)\n\}}", TYPES, re.S)
    assert m, f"no encontré la interface {nombre} en src/types.ts"
    return re.findall(r"^\s+(\w+)\??:", m.group(1), re.M)


def literales(texto):
    return re.findall(r'"([^"]+)"', texto)


def cabecera(ruta):
    with open(ruta, encoding="utf-8", newline="") as f:
        return next(csv.reader(f))


# ── B3: un solo catálogo de cadenas ───────────────────────────────────────────

@requiere_pipeline
def test_catalogo_de_cadenas_igual_en_pipeline_tipo_y_constantes():
    union = re.search(r"export type CadenaFarmaceutica =(.*?);", TYPES, re.S)
    lista = re.search(r"export const CADENAS: CadenaFarmaceutica\[\] = \[(.*?)\];",
                      CONSTANTS, re.S)
    assert union and lista
    pipeline = set(CLASIFICACION)
    assert set(literales(union.group(1))) == pipeline, "types.ts ≠ CLASIFICACION"
    assert set(literales(lista.group(1))) == pipeline, "CADENAS (constants.ts) ≠ CLASIFICACION"


def test_cada_cadena_tiene_color():
    union = re.search(r"export type CadenaFarmaceutica =(.*?);", TYPES, re.S)
    bloque = re.search(r"export const COLORES_CADENA[^=]*= \{(.*?)\};", CONSTANTS, re.S)
    assert union and bloque
    con_color = set(re.findall(r'"([^"]+)":', bloque.group(1)))
    assert set(literales(union.group(1))) <= con_color


# ── B2: el CSV que emite el exportador es el que lee la app ──────────────────

def test_farmacias_exportador_coincide_con_tipo_farmacia():
    assert exportar_farmacias_app.ESQUEMA_APP == campos_interface("Farmacia")


def test_movimientos_exportador_coincide_con_tipo_movimiento():
    assert exportar_movimientos_app.ESQUEMA_APP == campos_interface("MovimientoFarmacia")


def test_csvs_publicados_respetan_el_esquema():
    datos = RAIZ / "src" / "data"
    assert cabecera(datos / "farmacias.csv") == exportar_farmacias_app.ESQUEMA_APP
    assert cabecera(datos / "movimientos.csv") == exportar_movimientos_app.ESQUEMA_APP


@requiere_pipeline
def test_tipos_y_formatos_del_exportador_son_los_del_pipeline():
    assert exportar_farmacias_app.TIPOS_VALIDOS == {t for t, _ in CLASIFICACION.values()}
    assert exportar_farmacias_app.FORMATOS_VALIDOS == {f for _, f in CLASIFICACION.values()}


# ── B4: capas de bencineras y conveniencia ───────────────────────────────────

def test_verticales_exportador_coincide_con_sus_tipos():
    assert exportar_verticales_app.ESQUEMA_BENCINERAS == campos_interface("Bencinera")
    assert exportar_verticales_app.ESQUEMA_CONVENIENCIA == campos_interface("TiendaConveniencia")


def test_csvs_de_verticales_publicados_respetan_el_esquema():
    datos = RAIZ / "src" / "data"
    assert cabecera(datos / "bencineras.csv") == exportar_verticales_app.ESQUEMA_BENCINERAS
    assert cabecera(datos / "conveniencia.csv") == exportar_verticales_app.ESQUEMA_CONVENIENCIA


def test_catalogos_de_verticales_igual_en_tipos_y_exportador():
    for union, catalogo in (("SegmentoBencinera", exportar_verticales_app.TIPOS_BENCINERAS),
                            ("FormatoBencinera", exportar_verticales_app.FORMATOS_BENCINERAS),
                            ("FormatoConveniencia", exportar_verticales_app.FORMATOS_CONVENIENCIA)):
        m = re.search(rf"export type {union} =(.*?);", TYPES, re.S)
        assert m and set(literales(m.group(1))) == catalogo, union


@requiere_pipeline
def test_marcas_de_conveniencia_iguales_en_pipeline_tipo_y_constantes():
    from maestro_conveniencia import ADAPTADORES, OPERADOR
    union = re.search(r"export type MarcaConveniencia =(.*?);", TYPES, re.S)
    lista = re.search(r"export const MARCAS_CONVENIENCIA[^=]*= \[(.*?)\];", CONSTANTS, re.S)
    colores = re.search(r"export const COLORES_CONVENIENCIA[^=]*= \{(.*?)\};", CONSTANTS, re.S)
    assert union and lista and colores
    pipeline = set(OPERADOR)
    assert len(ADAPTADORES) == len(pipeline), "una marca del scraper sin operador"
    assert set(literales(union.group(1))) == pipeline, "types.ts ≠ OPERADOR"
    assert set(literales(lista.group(1))) == pipeline, "MARCAS_CONVENIENCIA ≠ OPERADOR"
    assert set(re.findall(r'"([^"]+)":', colores.group(1))) == pipeline


# ── B1: la demografía tipada es la del CSV real ──────────────────────────────

def test_demografia_censo_coincide_con_su_tipo():
    ruta = RAIZ / "src" / "data" / "demografia_censo.csv"
    assert cabecera(ruta) == campos_interface("DemografiaCenso")
