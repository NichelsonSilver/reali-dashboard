"""Descarga datos de movilidad DTPM para un periodo dado (costo 0, stdlib puro).

Fuentes:
  - Matrices de viaje DTPM (viajes / etapas / subidas por paradero cada 30 min)
    https://www.dtpm.cl/index.php/documentos/matrices-de-viaje
  - GTFS vigente de Red Movilidad (coordenadas de paraderos)
  - Kontur: hexagonos H3 de poblacion, todo Chile (opcional)

Uso:
  python scripts/descargar_movilidad.py --listar            # ver periodos publicados
  python scripts/descargar_movilidad.py 2026 04             # bajar viajes+etapas+subidas
  python scripts/descargar_movilidad.py 2026 04 --solo subidas
  python scripts/descargar_movilidad.py 2026 04 --kontur    # ademas baja hexagonos

Los archivos quedan en knowledge/movilidad/ (gitignored por peso).
Descarga con reanudacion (Range): si se corta, volver a correr y continua.
"""

import argparse
import re
import sys
import urllib.request
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent / "knowledge" / "movilidad"
PAGINA_MATRICES = "https://www.dtpm.cl/index.php/documentos/matrices-de-viaje"
URL_GTFS = "https://www.dtpm.cl/descargas/gtfs/GTFS.zip"
URL_KONTUR = (
    "https://geodata-eu-central-1-kontur-public.s3.amazonaws.com"
    "/kontur_datasets/kontur_population_CL_20231101.gpkg.gz"
)
UA = {"User-Agent": "Mozilla/5.0 (REALI descarga movilidad)"}


def listar_enlaces() -> list[str]:
    """Extrae todos los enlaces de descarga de la pagina de matrices DTPM."""
    req = urllib.request.Request(PAGINA_MATRICES, headers=UA)
    html = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "ignore")
    hrefs = re.findall(r'href="([^"]+)"', html)
    enlaces = []
    for h in hrefs:
        if "descargas" in h and re.search(r"\.(zip|rar|xlsx|xlsb|csv)$", h, re.I):
            if h.startswith("/"):
                h = "https://www.dtpm.cl" + h
            enlaces.append(h)
    # sin duplicados, preservando orden (la pagina lista de mas nuevo a mas viejo)
    return list(dict.fromkeys(enlaces))


def clasificar(url: str) -> str | None:
    """Clasifica un enlace como viajes / etapas / subidas, o None si es otra cosa."""
    nombre = url.rsplit("/", 1)[-1].lower()
    if "etapa" in nombre:
        return "etapas"
    if "viaje" in nombre:
        return "viajes"
    if "subida" in nombre:
        return "subidas"
    return None


def coincide_periodo(url: str, anio: int, mes: int) -> bool:
    """Decide si un enlace corresponde al periodo pedido (anio, mes).

    DTPM no usa un formato estable en los nombres de archivo. Ejemplos reales:
      Viajes_2026-04.zip            -> 2026-04
      Subidas_Paradero_Estacion_2026.04_v3.xlsx -> 2026.04
      Tablas_viajes_NOV_2025.zip    -> NOV_2025
      Etapas_Nov_2025.zip           -> Nov 2025
      Tabla-de-viajes-011025.zip    -> ddmmyy (01-10-25... publicado como abril 2025!)
    """
    nombre = url.rsplit("/", 1)[-1]
    # TODO(human): implementar el matching de periodo.
    # Debe devolver True si `nombre` corresponde a (anio, mes), False si no.
    # Considerar: anio con 4 digitos con separador . - _ contra el mes numerico
    # (04) y contra el mes en texto español abreviado o completo (ABR/ABRIL),
    # en cualquier capitalizacion. Ante ambiguedad (ej: solo aparece el anio),
    # decidir si conviene ser permisivo (bajar de mas) o estricto (bajar de
    # menos) — documentar la eleccion en un comentario.
    return False


def descargar(url: str, destino: Path) -> None:
    """Descarga con reanudacion: continua un .part existente via header Range."""
    destino.parent.mkdir(parents=True, exist_ok=True)
    if destino.exists():
        print(f"  ya existe, se omite: {destino.name}")
        return
    parcial = destino.with_suffix(destino.suffix + ".part")
    avance = parcial.stat().st_size if parcial.exists() else 0
    headers = dict(UA)
    if avance:
        headers["Range"] = f"bytes={avance}-"
        print(f"  reanudando desde {avance / 1e6:.0f} MB")
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=120) as resp:
        total = int(resp.headers.get("Content-Length", 0)) + avance
        modo = "ab" if avance and resp.status == 206 else "wb"
        with open(parcial, modo) as f:
            while True:
                bloque = resp.read(1 << 20)  # 1 MB
                if not bloque:
                    break
                f.write(bloque)
                avance += len(bloque)
                if avance % (50 << 20) < (1 << 20):  # progreso cada ~50 MB
                    pct = f" ({avance / total * 100:.0f}%)" if total else ""
                    print(f"  {avance / 1e6:.0f} MB{pct}", flush=True)
    parcial.rename(destino)
    print(f"  OK: {destino.name} ({destino.stat().st_size / 1e6:.0f} MB)")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("anio", nargs="?", type=int, help="anio del periodo, ej: 2026")
    ap.add_argument("mes", nargs="?", type=int, help="mes del periodo, ej: 4")
    ap.add_argument("--listar", action="store_true", help="solo listar enlaces publicados")
    ap.add_argument("--solo", choices=["viajes", "etapas", "subidas"],
                    help="bajar solo una tabla del periodo")
    ap.add_argument("--kontur", action="store_true", help="bajar hexagonos de poblacion")
    ap.add_argument("--sin-gtfs", action="store_true", help="no refrescar el GTFS vigente")
    args = ap.parse_args()

    enlaces = listar_enlaces()
    if args.listar:
        for e in enlaces:
            tipo = clasificar(e) or "?"
            print(f"{tipo:8} {e}")
        return 0

    if args.anio is None or args.mes is None:
        ap.error("indicar anio y mes (o usar --listar)")

    objetivos = [e for e in enlaces
                 if clasificar(e) and coincide_periodo(e, args.anio, args.mes)
                 and (not args.solo or clasificar(e) == args.solo)]
    if not objetivos:
        print(f"No se encontraron archivos para {args.anio}-{args.mes:02d}. "
              "Revisar con --listar (el formato de nombres de DTPM cambia).")
        return 1

    for url in objetivos:
        tipo = clasificar(url)
        print(f"[{tipo}] {url}")
        descargar(url, BASE / "dtpm" / url.rsplit("/", 1)[-1])

    if not args.sin_gtfs:
        print("[gtfs] refrescando GTFS vigente")
        gtfs = BASE / "dtpm" / "GTFS.zip"
        gtfs.unlink(missing_ok=True)  # siempre la version vigente
        descargar(URL_GTFS, gtfs)

    if args.kontur:
        print("[kontur] hexagonos H3 de poblacion")
        descargar(URL_KONTUR, BASE / "kontur" / URL_KONTUR.rsplit("/", 1)[-1])

    return 0


if __name__ == "__main__":
    sys.exit(main())
