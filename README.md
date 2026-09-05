# REALI — Inteligencia Territorial Farmacéutica

Dashboard de análisis geoespacial para decisiones de expansión de cadenas
farmacéuticas en Chile. Desarrollado por [REALI SpA](https://realidata.cl).

**Demo en vivo:** [realidata.cl/dashboard](https://realidata.cl/dashboard) — acceso abierto.

## Qué hace

Responde la pregunta que se hace un área de expansión antes de firmar un
arriendo: *¿cuánto vale este local y a quién le quito venta si abro acá?*

- **Mapa nacional** de ~5.900 farmacias geocodificadas, filtrable por cadena,
  región y comuna.
- **Capa demográfica** por manzana censal y por unidad vecinal, con nivel
  socioeconómico (ABC1/C2/C3/D/E, metodología AIM Chile).
- **Evaluar Sitio** — dosier de sitio imprimible a partir de una dirección:
  competencia por radios, mix NSE, población, tiendas análogas,
  canibalización de red propia y score 0-100.
- **Movimientos** — aperturas y cierres detectados por diff entre snapshots
  del registro MINSAL. ⚠️ **Esta vista corre hoy sobre datos ficticios**
  (`MOCK_MOVIMIENTOS` en `src/constants.ts`): los movimientos que muestra son
  inventados para demostrar la UI y no describen a ninguna cadena real. Se
  reemplazan por la salida de `diff_aperturas.py` cuando haya dos snapshots
  MINSAL consecutivos.

## Motor territorial

La lógica de análisis vive en `src/utils/`:

| Módulo | Qué resuelve |
|---|---|
| `territorio.ts` | Vector de sitio: competencia por radios, mix NSE, población |
| `analogos.ts` | Tiendas análogas por similitud de entorno |
| `canibalizacion.ts` | Modelo de Huff — reparto de demanda entre locales propios |
| `scoring.ts` | Score 0-100 (demanda 40 · NSE 20 · competencia 15 · canibalización 25) |

Hay un CLI equivalente para evaluar un sitio sin levantar la UI:

```bash
npx tsx scripts/evaluar_sitio.ts "Av. Providencia 1234, Santiago"
```

> **Nota sobre las ventas de tiendas análogas:** hoy son *simuladas*
> (40-120M CLP/mes, correlacionadas con el entorno y con seed determinística
> por id). Existen para ejercitar el modelo mientras no haya datos reales de
> facturación; se reemplazan con `aplicarVentasReales()`.

## Stack

React 18 + Vite + TypeScript · Leaflet (react-leaflet) · Recharts ·
Tailwind CSS · Papa Parse · SheetJS. Sin backend: todo se calcula en el
browser sobre archivos locales.

## Correr en local

```bash
npm install
npm run dev
```

Las capas geográficas (`public/data/*.geojson`, ~35 MB) van versionadas, así
que el repo corre tal cual después del clone. No requiere variables de
entorno; `VITE_MAPILLARY_TOKEN` es opcional y solo habilita la foto de
fachada automática en el dosier de sitio.

## Datos

| Archivo | Fuente |
|---|---|
| `src/data/farmacias.csv` | Registro nacional MINSAL, procesado y geocodificado |
| `src/data/demografia_censo.csv` | Censo 2024, agregado por comuna |
| `public/data/manzanas_rm.geojson` | Manzanas censales de la Región Metropolitana |
| `public/data/nse_uv.geojson` | NSE estimado por unidad vecinal |

Los preprocesadores que generan estos archivos están en `scripts/`. Esperan
las fuentes crudas del censo y cartografía, que no se distribuyen en este
repositorio por peso y licencia.

## Licencia

Código propietario de REALI SpA. El repositorio es de código visible, no de
código abierto: no se otorga licencia de uso, copia, modificación ni
redistribución. Para uso comercial, escribir a
[hola@realidata.cl](mailto:hola@realidata.cl).
