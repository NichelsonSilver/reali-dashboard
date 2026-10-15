# REALI — Inteligencia Territorial Farmacéutica

Dashboard de análisis geoespacial para decisiones de expansión de cadenas
farmacéuticas en Chile. Desarrollado por [REALI SpA](https://realidata.cl).

**Demo en vivo:** [realidata.cl/dashboard](https://realidata.cl/dashboard) — acceso abierto.

## Qué hace

Responde la pregunta que se hace un área de expansión antes de firmar un
arriendo: *¿cuánto vale este local y a quién le quito venta si abro acá?*

- **Resumen** — locales por cadena, aperturas/cierres y perfil demográfico
  y socioeconómico de las comunas cargadas.
- **Mapa farmacéutico** — farmacias geocodificadas, filtrables por cadena,
  región y comuna, con capas de manzanas censales y NSE por unidad vecinal.
- **Aperturas / Cierres** — movimientos detectados por diff mensual del
  registro de farmacias de MINSAL. Un cierre se cuenta después de 3 meses
  cerrado o ausente; una apertura es *detección*, no inauguración.
- **Cadenas** y **Análisis demográfico** (Censo 2024).
- **Evaluar Sitio** — dosier imprimible a partir de una dirección:
  competencia por radios, mix NSE, población, tiendas análogas,
  canibalización de red propia y score 0-100.

## Datos de la demo

La demo publica una **muestra**: Providencia y Ñuñoa (328 farmacias, corte
2026-09). Dos comunas contiguas y densas, para que el motor territorial
tenga vecinos reales; direcciones y coordenadas van exactas, sin teléfonos.
La cobertura nacional es el producto comercial.

| Archivo | Contenido |
|---|---|
| `src/data/farmacias.csv` | Farmacias de la muestra (registro MINSAL + cadenas que MINSAL no cubre) |
| `src/data/movimientos.csv` | Aperturas y cierres de la muestra |
| `src/data/demografia_censo.csv` | Censo 2024 por comuna (INE), nacional |
| `src/data/gse_aim_comuna.csv` | GSE AIM 2023 por comuna (% de hogares) |
| `public/data/manzanas_rm.geojson` | Manzanas censales de la muestra |
| `public/data/nse_uv.geojson` | NSE **estimado** por unidad vecinal |

**Sobre el NSE:** las cifras de una zona salen del GSE AIM publicado por
comuna, ponderado por hogares del censo. La capa por unidad vecinal es una
estimación (tramos del Registro Social de Hogares calibrados a la
distribución AIM de su comuna) y se usa para el mapa y el radio de Evaluar
Sitio, nunca para sumar una cifra de zona.

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

Los datos de la muestra van versionados, así que el repo corre tal cual
después del clone. No requiere variables de entorno; `VITE_MAPILLARY_TOKEN`
es opcional y solo habilita la foto de fachada automática en el dosier.

## Tests

```bash
npm test                          # scoring y modelo de Huff (vitest)
python -m pytest scripts/tests    # contrato de datos CSV ↔ tipos de la app
```

Los preprocesadores de `scripts/` esperan las fuentes crudas del censo y la
cartografía, que no se distribuyen en este repositorio por peso y licencia.

## Licencia

Código propietario de REALI SpA. El repositorio es de código visible, no de
código abierto: no se otorga licencia de uso, copia, modificación ni
redistribución. Para uso comercial, escribir a
[hola@realidata.cl](mailto:hola@realidata.cl).
