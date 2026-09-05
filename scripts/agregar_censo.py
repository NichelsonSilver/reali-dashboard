"""
Agrega microdatos del Censo 2024 por comuna para el dashboard REALI.
Entrada: knowledge/personas_censo2024/personas_censo2024.csv (18.5M filas, separador ;)
Salida:  public/data/demografia_censo.csv (una fila por comuna)

Columnas de salida:
  cod_comuna, nombre_comuna, region, poblacion, hombres, mujeres,
  edad_0_14, edad_15_29, edad_30_44, edad_45_59, edad_60_mas,
  escolaridad_promedio
"""

import csv
import os
import sys
from collections import defaultdict

# Mapeo código INE → nombre de comuna (comunas presentes en farmacias.csv + otras principales)
# Fuente: codificación oficial INE Chile
COMUNAS_INE = {
    "13101": "Santiago",
    "13102": "Cerrillos",
    "13103": "Cerro Navia",
    "13104": "Conchalí",
    "13105": "El Bosque",
    "13106": "Estación Central",
    "13107": "Huechuraba",
    "13108": "Independencia",
    "13109": "La Cisterna",
    "13110": "La Florida",
    "13111": "La Granja",
    "13112": "La Pintana",
    "13113": "La Reina",
    "13114": "Las Condes",
    "13115": "Lo Barnechea",
    "13116": "Lo Espejo",
    "13117": "Lo Prado",
    "13118": "Macul",
    "13119": "Maipú",
    "13120": "Ñuñoa",
    "13121": "Pedro Aguirre Cerda",
    "13122": "Peñalolén",
    "13123": "Providencia",
    "13124": "Pudahuel",
    "13125": "Quilicura",
    "13126": "Quinta Normal",
    "13127": "Recoleta",
    "13128": "Renca",
    "13129": "San Joaquín",
    "13130": "San Miguel",
    "13131": "San Ramón",
    "13132": "Vitacura",
    "13201": "Puente Alto",
    "13202": "Pirque",
    "13203": "San José de Maipo",
    "13301": "Colina",
    "13302": "Lampa",
    "13303": "Tiltil",
    "13401": "San Bernardo",
    "13402": "Buin",
    "13403": "Calera de Tango",
    "13404": "Paine",
    "13501": "Melipilla",
    "13601": "Talagante",
    "13602": "El Monte",
    "13603": "Isla de Maipo",
    "13604": "Padre Hurtado",
    "13605": "Peñaflor",
    # Valparaíso
    "5101": "Valparaíso",
    "5102": "Casablanca",
    "5103": "Concón",
    "5104": "Juan Fernández",
    "5105": "Puchuncaví",
    "5106": "Quintero",
    "5107": "Viña del Mar",
    "5201": "Isla de Pascua",
    "5301": "Los Andes",
    "5302": "Calle Larga",
    "5303": "Rinconada",
    "5304": "San Esteban",
    "5401": "La Ligua",
    "5402": "Cabildo",
    "5403": "Papudo",
    "5404": "Petorca",
    "5405": "Zapallar",
    "5501": "Quillota",
    "5502": "Calera",
    "5503": "Hijuelas",
    "5504": "La Cruz",
    "5505": "Nogales",
    "5601": "San Antonio",
    "5602": "Algarrobo",
    "5603": "Cartagena",
    "5604": "El Quisco",
    "5605": "El Tabo",
    "5606": "Santo Domingo",
    "5701": "San Felipe",
    "5702": "Catemu",
    "5703": "Llaillay",
    "5704": "Panquehue",
    "5705": "Putaendo",
    "5706": "Santa María",
    "5801": "Quilpué",
    "5802": "Limache",
    "5803": "Olmué",
    "5804": "Villa Alemana",
    # Biobío
    "8101": "Concepción",
    "8102": "Coronel",
    "8103": "Chiguayante",
    "8104": "Florida",
    "8105": "Hualqui",
    "8106": "Lota",
    "8107": "Penco",
    "8108": "San Pedro de la Paz",
    "8109": "Santa Juana",
    "8110": "Talcahuano",
    "8111": "Tomé",
    "8112": "Hualpén",
    "8201": "Lebu",
    "8301": "Los Ángeles",
    "8302": "Antuco",
    "8303": "Cabrero",
    "8304": "Laja",
    "8305": "Mulchén",
    "8306": "Nacimiento",
    "8307": "Negrete",
    "8308": "Quilaco",
    "8309": "Quilleco",
    "8310": "San Rosendo",
    "8311": "Santa Bárbara",
    "8312": "Tucapel",
    "8313": "Yumbel",
    "8314": "Alto Biobío",
    # Arica y Parinacota
    "15101": "Arica",
    "15102": "Camarones",
    "15201": "Putre",
    "15202": "General Lagos",
    # Tarapacá
    "1101": "Iquique",
    "1107": "Alto Hospicio",
    "1201": "Pozo Almonte",
    "1301": "Huara",
    "1302": "Camiña",
    "1303": "Colchane",
    "1304": "Pica",
    # Antofagasta
    "2101": "Antofagasta",
    "2102": "Mejillones",
    "2103": "Sierra Gorda",
    "2104": "Taltal",
    "2201": "Calama",
    "2202": "Ollagüe",
    "2203": "San Pedro de Atacama",
    "2301": "Tocopilla",
    "2302": "María Elena",
    # Atacama
    "3101": "Copiapó",
    "3102": "Caldera",
    "3103": "Tierra Amarilla",
    "3201": "Chañaral",
    "3202": "Diego de Almagro",
    "3301": "Vallenar",
    "3302": "Alto del Carmen",
    "3303": "Freirina",
    "3304": "Huasco",
    # Coquimbo
    "4101": "La Serena",
    "4102": "Coquimbo",
    "4103": "Andacollo",
    "4104": "La Higuera",
    "4105": "Paihuano",
    "4106": "Vicuña",
    "4201": "Illapel",
    "4202": "Canela",
    "4203": "Los Vilos",
    "4204": "Salamanca",
    "4301": "Ovalle",
    "4302": "Combarbalá",
    "4303": "Monte Patria",
    "4304": "Punitaqui",
    "4305": "Río Hurtado",
    # O'Higgins
    "6101": "Rancagua",
    "6102": "Codegua",
    "6103": "Coinco",
    "6104": "Coltauco",
    "6105": "Doñihue",
    "6106": "Graneros",
    "6107": "Las Cabras",
    "6108": "Machalí",
    "6109": "Malloa",
    "6110": "Mostazal",
    "6111": "Olivar",
    "6112": "Peumo",
    "6113": "Pichidegua",
    "6114": "Quinta de Tilcoco",
    "6115": "Rengo",
    "6116": "Requínoa",
    "6117": "San Vicente",
    "6201": "Pichilemu",
    "6301": "San Fernando",
    # Maule
    "7101": "Talca",
    "7102": "Constitución",
    "7103": "Curepto",
    "7104": "Empedrado",
    "7105": "Maule",
    "7106": "Pelarco",
    "7107": "Pencahue",
    "7108": "Río Claro",
    "7109": "San Clemente",
    "7110": "San Rafael",
    "7201": "Cauquenes",
    "7301": "Curicó",
    "7302": "Hualañé",
    "7303": "Licantén",
    "7304": "Molina",
    "7305": "Rauco",
    "7306": "Romeral",
    "7307": "Sagrada Familia",
    "7308": "Teno",
    "7309": "Vichuquén",
    "7401": "Linares",
    # Ñuble
    "16101": "Chillán",
    "16102": "Bulnes",
    "16103": "Chillán Viejo",
    "16104": "El Carmen",
    "16105": "Pemuco",
    "16106": "Pinto",
    "16107": "Quillón",
    "16108": "San Ignacio",
    "16109": "Yungay",
    "16201": "Quirihue",
    "16301": "San Carlos",
    # La Araucanía
    "9101": "Temuco",
    "9102": "Carahue",
    "9103": "Cunco",
    "9104": "Curarrehue",
    "9105": "Freire",
    "9106": "Galvarino",
    "9107": "Gorbea",
    "9108": "Lautaro",
    "9109": "Loncoche",
    "9110": "Melipeuco",
    "9111": "Nueva Imperial",
    "9112": "Padre Las Casas",
    "9113": "Perquenco",
    "9114": "Pitrufquén",
    "9115": "Pucón",
    "9116": "Saavedra",
    "9117": "Teodoro Schmidt",
    "9118": "Toltén",
    "9119": "Vilcún",
    "9120": "Villarrica",
    "9121": "Cholchol",
    "9201": "Angol",
    "9202": "Collipulli",
    "9203": "Curacautín",
    "9204": "Ercilla",
    "9205": "Lonquimay",
    "9206": "Los Sauces",
    "9207": "Lumaco",
    "9208": "Purén",
    "9209": "Renaico",
    "9210": "Traiguén",
    "9211": "Victoria",
    # Los Ríos
    "14101": "Valdivia",
    "14102": "Corral",
    "14103": "Lanco",
    "14104": "Los Lagos",
    "14105": "Máfil",
    "14106": "Mariquina",
    "14107": "Paillaco",
    "14108": "Panguipulli",
    "14201": "La Unión",
    "14202": "Futrono",
    "14203": "Lago Ranco",
    "14204": "Río Bueno",
    # Los Lagos
    "10101": "Puerto Montt",
    "10102": "Calbuco",
    "10103": "Cochamó",
    "10104": "Fresia",
    "10105": "Frutillar",
    "10106": "Los Muermos",
    "10107": "Llanquihue",
    "10108": "Maullín",
    "10109": "Puerto Varas",
    "10201": "Castro",
    "10202": "Ancud",
    "10203": "Chonchi",
    "10204": "Curaco de Vélez",
    "10205": "Dalcahue",
    "10206": "Puqueldón",
    "10207": "Queilén",
    "10208": "Quellón",
    "10209": "Quemchi",
    "10210": "Quinchao",
    "10301": "Osorno",
    # Aysén
    "11101": "Coyhaique",
    "11102": "Lago Verde",
    "11201": "Aysén",
    "11202": "Cisnes",
    "11203": "Guaitecas",
    "11301": "Cochrane",
    "11302": "O'Higgins",
    "11303": "Tortel",
    "11401": "Chile Chico",
    "11402": "Río Ibáñez",
    # Magallanes
    "12101": "Punta Arenas",
    "12102": "Laguna Blanca",
    "12103": "Río Verde",
    "12104": "San Gregorio",
    "12201": "Cabo de Hornos",
    "12301": "Porvenir",
    "12302": "Primavera",
    "12303": "Timaukel",
    "12401": "Natales",
    "12402": "Torres del Paine",
}

# Mapeo código región → nombre región
REGIONES_INE = {
    "15": "Arica y Parinacota",
    "1": "Tarapacá",
    "2": "Antofagasta",
    "3": "Atacama",
    "4": "Coquimbo",
    "5": "Valparaíso",
    "13": "Metropolitana",
    "6": "O'Higgins",
    "7": "Maule",
    "16": "Ñuble",
    "8": "Biobío",
    "9": "La Araucanía",
    "14": "Los Ríos",
    "10": "Los Lagos",
    "11": "Aysén",
    "12": "Magallanes",
}


def clasificar_edad(edad_quinquenal: str) -> str:
    """Clasifica grupo etario en rangos amplios."""
    try:
        eq = int(edad_quinquenal)
    except (ValueError, TypeError):
        return "desconocido"
    if eq < 15:
        return "0_14"
    elif eq < 30:
        return "15_29"
    elif eq < 45:
        return "30_44"
    elif eq < 60:
        return "45_59"
    else:
        return "60_mas"


def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    input_path = os.path.join(base_dir, "knowledge", "personas_censo2024", "personas_censo2024.csv")
    output_path = os.path.join(base_dir, "src", "data", "demografia_censo.csv")

    if not os.path.exists(input_path):
        print(f"Error: no se encontró {input_path}")
        sys.exit(1)

    print(f"Leyendo {input_path}...")

    # Estructura: {cod_comuna: {campo: valor}}
    comunas = defaultdict(lambda: {
        "poblacion": 0,
        "hombres": 0,
        "mujeres": 0,
        "edad_0_14": 0,
        "edad_15_29": 0,
        "edad_30_44": 0,
        "edad_45_59": 0,
        "edad_60_mas": 0,
        "escolaridad_sum": 0,
        "escolaridad_count": 0,
    })

    with open(input_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=";")
        for i, row in enumerate(reader):
            cod_comuna = row.get("comuna", "").strip()
            if not cod_comuna:
                continue

            c = comunas[cod_comuna]
            c["poblacion"] += 1

            # Sexo: 1=hombre, 2=mujer
            sexo = row.get("sexo", "").strip()
            if sexo == "1":
                c["hombres"] += 1
            elif sexo == "2":
                c["mujeres"] += 1

            # Edad quinquenal
            eq = row.get("edad_quinquenal", "").strip()
            grupo = clasificar_edad(eq)
            key = f"edad_{grupo}"
            if key in c:
                c[key] += 1

            # Escolaridad (años)
            esc = row.get("escolaridad", "").strip()
            try:
                esc_val = int(esc)
                if 0 <= esc_val <= 30:
                    c["escolaridad_sum"] += esc_val
                    c["escolaridad_count"] += 1
            except (ValueError, TypeError):
                pass

            if (i + 1) % 2_000_000 == 0:
                print(f"  Procesadas {(i+1):,} filas...")

    print(f"  Total filas procesadas: {i+1:,}")
    print(f"  Comunas encontradas: {len(comunas)}")

    # Escribir CSV de salida
    fieldnames = [
        "cod_comuna", "nombre_comuna", "region",
        "poblacion", "hombres", "mujeres",
        "edad_0_14", "edad_15_29", "edad_30_44", "edad_45_59", "edad_60_mas",
        "escolaridad_promedio",
    ]

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for cod, data in sorted(comunas.items()):
            nombre = COMUNAS_INE.get(cod, f"Comuna {cod}")
            region_cod = row_region = cod[:2] if len(cod) >= 4 else cod[:1]
            # Ajuste: códigos de 5 dígitos tienen región de 2 dígitos (ej: 13101 → 13)
            if len(cod) == 5:
                region_cod = cod[:2]
            elif len(cod) == 4:
                region_cod = cod[:1]

            region_nombre = REGIONES_INE.get(region_cod, f"Región {region_cod}")

            esc_prom = 0.0
            if data["escolaridad_count"] > 0:
                esc_prom = round(data["escolaridad_sum"] / data["escolaridad_count"], 1)

            writer.writerow({
                "cod_comuna": cod,
                "nombre_comuna": nombre,
                "region": region_nombre,
                "poblacion": data["poblacion"],
                "hombres": data["hombres"],
                "mujeres": data["mujeres"],
                "edad_0_14": data["edad_0_14"],
                "edad_15_29": data["edad_15_29"],
                "edad_30_44": data["edad_30_44"],
                "edad_45_59": data["edad_45_59"],
                "edad_60_mas": data["edad_60_mas"],
                "escolaridad_promedio": esc_prom,
            })

    print(f"Archivo generado: {output_path}")


if __name__ == "__main__":
    main()
