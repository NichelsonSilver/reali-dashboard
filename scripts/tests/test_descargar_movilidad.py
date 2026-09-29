"""Nombres reales de la pagina de matrices DTPM (listados el 2026-09-29)."""
import pytest

from descargar_movilidad import coincide_periodo, periodo_de_nombre

URL = "https://www.dtpm.cl/descargas/modelos_y_matrices/"


@pytest.mark.parametrize("nombre,esperado", [
    ("Viajes_2026-04.zip", (2026, 4)),
    ("Etapas-2026-04.zip", (2026, 4)),
    ("Subidas_Paradero_Estacion_2026.04_v3.xlsx", (2026, 4)),
    ("Subida_Paradero_Estacion_2025_04_v2.xlsb", (2025, 4)),
    ("Tablas_viajes_NOV_2025.zip", (2025, 11)),
    ("Etapas_Nov_2025.zip", (2025, 11)),
    ("Tabla-de-Viajes-Nov-24.zip", (2024, 11)),
    ("Tabla-de-Etapas- Nov24.zip", (2024, 11)),
    ("Tablas de subidas y bajadas ago23.zip", (2023, 8)),
    ("viajes_octubre_18.zip", (2018, 10)),
    ("viajes202404_transparencia_15al21.zip", (2024, 4)),
    ("viajes202204_abril_4al10_transparencia-.zip", (2022, 4)),
    ("viajes202111_noviembre_8al14_transparencia.zip", (2021, 11)),
    ("viajes_112023_6al12.zip", (2023, 11)),
    ("viajes082022_8al14_transparencia.zip", (2022, 8)),
    ("MatrizOD_Subidas_Bajadas_2018.04v2.zip", (2018, 4)),
    ("Tabla-de-viajes-011025.zip", (2025, 4)),   # ddmmyy: anotado a mano
])
def test_periodo_de_nombres_reales(nombre, esperado):
    assert periodo_de_nombre(nombre) == esperado


@pytest.mark.parametrize("nombre", [
    "viajes_19.zip",           # solo el anio
    "tabla-viajes.rar",        # nada
    "Tablas de Subidas y Bajadas.zip",
    "Diccionario_campos_tabla_viajes_y_etapas(transparencia).xlsx",
])
def test_ambiguo_no_adivina(nombre):
    assert periodo_de_nombre(nombre) is None


def test_coincide_decodifica_la_url():
    assert coincide_periodo(URL + "Tabla-de-Etapas-%20Nov24.zip", 2024, 11)
    assert not coincide_periodo(URL + "Tabla-de-Etapas-%20Nov24.zip", 2025, 11)
