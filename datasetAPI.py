import ee # Usando earthengine-api
import h3

# --- 1. Inicialización de GEE (Asegúrate de haberte autenticado) ---
try:
    ee.Initialize()
except Exception as e:
    print("Por favor, autentica GEE ejecutando 'python -c \"import ee; ee.Authenticate()\"'")

# --- 2. Definición de Colecciones ---
MODIS_NDVI_COL = "MODIS/061/MOD13A2"  # NDVI (Floración)
MODIS_LST_COL = "MODIS/061/MOD11A2"   # LST (Temperatura/Calor)
# ECOSTRESS (Evapotranspiración: Proxy para Estrés Hídrico)
ECOSTRESS_COL = "NASA/JPL/ECOSTRESS/ET/PTJPL_R/001" 

def extract_h3_features(h3_id, start_date, end_date):
    """
    Función que extrae NDVI, LST y ET (Evapotranspiración) para un ID H3.
    """
    try:
        coords = h3.h3_to_geo_boundary(h3_id, geo_json=True)
        # GEE requiere [lon, lat], por lo que se invierten los ejes de H3
        geometry = ee.Geometry.Polygon(coords).swapAxes() 

        # 1. NDVI (Floración)
        ndvi_data = ee.ImageCollection(MODIS_NDVI_COL) \
                    .filterDate(start_date, end_date) \
                    .select('NDVI').median() \
                    .reduceRegion(ee.Reducer.mean(), geometry, 1000).get('NDVI').getInfo()
        ndvi = (ndvi_data / 10000.0) if ndvi_data is not None else None # Normalización MODIS

        # 2. LST (Temperatura)
        lst_data = ee.ImageCollection(MODIS_LST_COL) \
                   .filterDate(start_date, end_date) \
                   .select('LST_Day_1km').max() \
                   .reduceRegion(ee.Reducer.mean(), geometry, 1000).get('LST_Day_1km').getInfo()
        lst = (lst_data * 0.02) if lst_data is not None else None # Escala MODIS LST (en Kelvin)

        # 3. ET (Estrés Hídrico/Agua)
        # La banda ET_PT_JPL es la Evapotranspiración real (proxy de qué tanta agua usa la planta)
        et_data = ee.ImageCollection(ECOSTRESS_COL) \
                  .filterDate(start_date, end_date) \
                  .select('ET_PT_JPL').median() \
                  .reduceRegion(ee.Reducer.mean(), geometry, 70).get('ET_PT_JPL').getInfo()
        et = et_data if et_data is not None else None

        return {'h3_id': h3_id, 'ndvi': ndvi, 'lst': lst, 'et': et}

    except Exception as e:
        # print(f"Error en {h3_id}: {e}")
        return None