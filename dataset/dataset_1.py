import os
import ee
import h3
import pandas as pd

# --- Inicializar Earth Engine ---
ee.Authenticate()
ee.Initialize(project='charged-kiln-414822')

# --- Configuración ---
start_date = '2025-06-01'
end_date = '2025-06-30'
region_center = (-12.6, -69.2)  # Madre de Dios, Perú
resolucion_h3 = 6

# --- Función de etiquetado automático ---
def calcular_etiqueta(ndvi, lst, et):
    if ndvi is None or lst is None or et is None:
        return None
    if ndvi > 0.6 and lst < 305 and et > 1.0:
        return 0  # Verde - saludable
    elif 0.4 < ndvi <= 0.6 or 305 <= lst < 310 or 0.6 < et <= 1.0:
        return 1  # Amarillo - moderado
    else:
        return 2  # Rojo - crítico

# --- Generar celdas H3 alrededor de una región ---
def generar_hexagonos(lat, lon, radio_km=10, resolucion=6):
    hex_ids = []
    for i in range(-2, 3):
        for j in range(-2, 3):
            new_lat = lat + (i * 0.1)
            new_lon = lon + (j * 0.1)
            hex_id = h3.latlng_to_cell(new_lat, new_lon, resolucion)
            hex_ids.append(hex_id)
    return list(set(hex_ids))

hexes = generar_hexagonos(*region_center, resolucion=resolucion_h3)

# --- Extraer NDVI, LST y ET para cada celda ---
def extract_h3_features(h3_id, start_date, end_date):
    try:
        # Convertir a coordenadas [lon, lat] para EE
        coords_latlon = h3.cell_to_boundary(h3_id)
        coords_lonlat = [[lon, lat] for lat, lon in coords_latlon]
        geometry = ee.Geometry.Polygon(coords_lonlat)

        # Colecciones satelitales
        ndvi_img = ee.ImageCollection("MODIS/061/MOD13A2") \
            .filterDate(start_date, end_date).select('NDVI').median()
        lst_img = ee.ImageCollection("MODIS/061/MOD11A2") \
            .filterDate(start_date, end_date).select('LST_Day_1km').median()
        et_img = ee.ImageCollection("NASA/JPL/ECOSTRESS/ET/PTJPL_R/001") \
            .filterDate(start_date, end_date).select('ET_PT_JPL').median()

        # Reducir por región
        ndvi = ndvi_img.reduceRegion(ee.Reducer.mean(), geometry, 1000).get('NDVI').getInfo()
        lst = lst_img.reduceRegion(ee.Reducer.mean(), geometry, 1000).get('LST_Day_1km').getInfo()
        et = et_img.reduceRegion(ee.Reducer.mean(), geometry, 70).get('ET_PT_JPL').getInfo()

        # Normalización y etiquetado
        ndvi = (ndvi / 10000.0) if ndvi else None
        lst = (lst * 0.02) if lst else None  # Escala MODIS
        et = et if et else None

        label = calcular_etiqueta(ndvi, lst, et)

        return {'h3_id': h3_id, 'ndvi': ndvi, 'lst': lst, 'et': et, 'label': label}

    except Exception as e:
        print(f"[!] Error procesando {h3_id}: {e}")
        return None

# --- Ejecución principal ---
print(f"Procesando {len(hexes)} celdas H3...")
data = [extract_h3_features(h, start_date, end_date) for h in hexes if h]

# Filtrar resultados válidos
df = pd.DataFrame([d for d in data if d])

# Crear carpeta de salida
os.makedirs('data', exist_ok=True)

# Guardar dataset
output_path = 'data/bee_health_dataset.csv'
df.to_csv(output_path, index=False)
print(f"\n✅ Dataset guardado en: {output_path}")
print(df.head())
