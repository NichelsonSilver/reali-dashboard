import { Farmacia } from "../types";

/**
 * Locales cuyo punto se puede dibujar y usar en cálculos de distancia.
 *
 * Un local con `coord_dudosa` existe y se cuenta en KPIs, tablas y movimientos,
 * pero su coordenada no cae en la comuna que declara y Google tampoco lo ubicó
 * ahí (ver process_minsal.resolver_local). Dibujarlo pone una farmacia de
 * Linares en el centro de Santiago; meterlo al motor territorial inventa
 * competencia donde no la hay.
 */
export function conCoordConfiable<T extends Pick<Farmacia, "coord_dudosa">>(fs: T[]): T[] {
  return fs.filter((f) => !f.coord_dudosa);
}
