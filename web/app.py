# app.py
from flask import Flask, request, jsonify, send_from_directory
import ee
import h3
import numpy as np
import tensorflow as tf
import joblib
import datetime
import os

# --- Inicializar Earth Engine ---
ee.Initialize(project='charged-kiln-414822')  # 👈 REEMPLAZA con tu ID del proyecto GEE

app = Flask(__name__, static_folder='.', static_url_path='')

# --- Cargar modelo entrenado y normalizador ---
model = tf.keras.models.load_model("bees_mlp_model_final.h5")
scaler = joblib.load("scaler.joblib")

# --- Datasets disponibles en GEE ---
DATASETS = {
    "NDVI": "MODIS/061/MOD13A2",
    "LST": "MODIS/061/MOD11A2",
    "SMAP_L4": "NASA/SMAP/SPL4SMGP/008"
}

# --- Buscar fecha más reciente con datos válidos ---
def find_valid_date():
    today = datetime.date.today()
    for offset in range(0, 180, 8):  # busca en los últimos 6 meses
        date = today - datetime.timedelta(days=offset)
        try:
            ndvi = ee.ImageCollection(DATASETS["NDVI"]).filterDate(str(date), str(date + datetime.timedelta(days=8))).first()
            lst = ee.ImageCollection(DATASETS["LST"]).filterDate(str(date), str(date + datetime.timedelta(days=8))).first()
            smap = ee.ImageCollection(DATASETS["SMAP_L4"]).filterDate(str(date), str(date + datetime.timedelta(days=8))).first()
            if ndvi and lst and smap:
                return str(date), str(date + datetime.timedelta(days=8))
        except:
            continue
    return None, None

# --- Extraer variables satelitales ---
def extract_features(lat, lon):
    start, end = find_valid_date()
    if not start:
        return None

    geometry = ee.Geometry.Point([lon, lat]).buffer(5000)  # 5 km de radio

    ndvi = ee.ImageCollection(DATASETS["NDVI"]).filterDate(start, end).select('NDVI').mean().reduceRegion(
        ee.Reducer.mean(), geometry, 1000).get('NDVI').getInfo()

    lst = ee.ImageCollection(DATASETS["LST"]).filterDate(start, end).select('LST_Day_1km').mean().reduceRegion(
        ee.Reducer.mean(), geometry, 1000).get('LST_Day_1km').getInfo()

    sm = ee.ImageCollection(DATASETS["SMAP_L4"]).filterDate(start, end).select('sm_rootzone').mean().reduceRegion(
        ee.Reducer.mean(), geometry, 9000).get('sm_rootzone').getInfo()

    if None in (ndvi, lst, sm):
        return None

    # Normalizar valores
    return [ndvi / 10000, lst * 0.02, sm]

# --- API: generar malla hexagonal + predicción IA ---
@app.route("/api/generate_hexgrid")
def generate_hexgrid():
    lat = float(request.args.get("lat"))
    lon = float(request.args.get("lon"))
    radius = float(request.args.get("radius", 10))  # por defecto 10 km

    # Generar celdas hexagonales H3
    center_hex = h3.latlng_to_cell(lat, lon, 6)
    hex_ids = list(h3.grid_disk(center_hex, 2))

    result = []
    for h in hex_ids:
        coords = h3.cell_to_latlng(h)
        features = extract_features(coords[0], coords[1])
        if not features:
            continue

        X = scaler.transform([features])
        y_pred = model.predict(X, verbose=0)
        label = int(np.argmax(y_pred))
        color = ["#28a745", "#ffc107", "#dc3545"][label]  # verde, amarillo, rojo

        result.append({
            "h3_id": h,
            "color": color,
            "label": label,
            "features": {
                "ndvi": features[0],
                "lst": features[1],
                "soil_moisture": features[2]
            }
        })

    return jsonify({"hex_data": result})

# --- Servir el front-end (index.html y JS) ---
@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

# --- Ejecutar ---
if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)
