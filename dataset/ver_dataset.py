# fase1_extraccion_datos_anual.py
import os
import ee
import h3
import pandas as pd
from datetime import datetime
import time

# --- Inicializar Google Earth Engine ---
ee.Initialize(project='charged-kiln-414822')

# --- Parámetros generales ---
region_center = (-12.6, -69.2)  # Madre de Dios, Perú
resolucion_h3 = 6
os.makedirs('data', exist_ok=True)

# --- Datasets activos ---
datasets = {
    "NDVI": "MODIS/061/MOD13A2",
    "LST": "MODIS/061/MOD11A2",
    "SMAP_L4": "NASA/SMAP/SPL4SMGP/008"
}

scales = {
    "NDVI": 1000,
    "LST": 1000,
    "SMAP_L4": 9000
}

def calcular_etiqueta_simple(ndvi, lst, sm_root):
    if ndvi is None or lst is None or sm_root is None:
        return None
    if ndvi > 0.6 and lst < 305 and sm_root > 0.2:
        return 0
    elif 0.4 < ndvi <= 0.6 or 305 <= lst < 310 or 0.1 < sm_root <= 0.2:
        return 1
    else:
        return 2

def generar_hexagonos(lat, lon, resolucion=6):
    hex_ids = []
    for i in range(-3, 4):
        for j in range(-3, 4):
            new_lat = lat + (i * 0.08)
            new_lon = lon + (j * 0.08)
            hex_ids.append(h3.latlng_to_cell(new_lat, new_lon, resolucion))
    return list(set(hex_ids))

hexes = generar_hexagonos(*region_center, resolucion=resolucion_h3)
print(f"📍 Celdas H3 generadas: {len(hexes)}")

def extract_h3_features(h3_id, start_date, end_date):
    try:
        coords_latlon = h3.cell_to_boundary(h3_id)
        coords_lonlat = [[lon, lat] for lat, lon in coords_latlon]
        geometry = ee.Geometry.Polygon(coords_lonlat)

        # NDVI
        ndvi_val = ee.ImageCollection(datasets["NDVI"]) \
            .filterDate(start_date, end_date) \
            .select('NDVI').median() \
            .reduceRegion(ee.Reducer.mean(), geometry, scales["NDVI"]).get('NDVI')
        ndvi = (ndvi_val.getInfo() / 10000.0) if ndvi_val else None

        # LST
        lst_val = ee.ImageCollection(datasets["LST"]) \
            .filterDate(start_date, end_date) \
            .select('LST_Day_1km').median() \
            .reduceRegion(ee.Reducer.mean(), geometry, scales["LST"]).get('LST_Day_1km')
        lst = (lst_val.getInfo() * 0.02) if lst_val else None

        # SMAP
        sm_col = ee.ImageCollection(datasets["SMAP_L4"]).filterDate(start_date, end_date)
        first = sm_col.first()
        bandnames = first.bandNames().getInfo()
        band = 'sm_rootzone' if 'sm_rootzone' in bandnames else 'sm_surface'
        sm_val = sm_col.select(band).mean() \
            .reduceRegion(ee.Reducer.mean(), geometry, scales["SMAP_L4"]).get(band)
        sm_root = sm_val.getInfo() if sm_val else None

        label = calcular_etiqueta_simple(ndvi, lst, sm_root)
        return {'h3_id': h3_id, 'ndvi': ndvi, 'lst': lst, 'soil_moisture': sm_root, 'label': label,
                'start_date': start_date, 'end_date': end_date}

    except Exception as e:
        print(f"[!] Error procesando {h3_id}: {e}")
        return None

# --- Procesar múltiples meses ---
rows = []
for month in range(1, 13):  # Enero a diciembre
    start_date = f'2024-{month:02d}-01'
    end_date = f'2024-{month:02d}-28' if month == 2 else f'2024-{month:02d}-30'
    print(f"\n📆 Procesando mes {month} ({start_date} a {end_date})...")

    for h in hexes:
        data = extract_h3_features(h, start_date, end_date)
        if data:
            rows.append(data)
    time.sleep(1)

# --- Guardar dataset final ---
df = pd.DataFrame(rows)
df = df.dropna(subset=['ndvi', 'lst', 'soil_moisture'], how='all')

output_path = 'data/bee_health_dataset_anual.csv'
df.to_csv(output_path, index=False)
print("\n✅ Dataset final guardado en:", output_path)
print(df.head(10))
print(f"Total de muestras: {len(df)}")
