# app.py (Modo SIMULACIÓN - para verificar la visualización)
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import ee # Importado solo por consistencia, no se usa en la simulación
import h3
import numpy as np
import tensorflow as tf
import joblib
import os
import random # Necesario para la simulación

# --- Configuración Inicial ---
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
try:
    # Se mantiene la inicialización de EE aunque se omite en la API /generate_hexgrid
    ee.Initialize(project='charged-kiln-414822')
except Exception:
    pass

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# --- Cargar modelo (Se mantiene la lógica, pero se omite en la simulación) ---
try:
    # Estos archivos deben estar en la carpeta web/
    model = tf.keras.models.load_model("bees_mlp_model_final.h5")
    scaler = joblib.load("scaler.joblib")
    print("Modelo MLP y Scaler cargados. Ejecutando en Modo Simulación.")
except Exception as e:
    print(f"Advertencia: Error al cargar archivos de IA ({e}). Ejecutando en Modo Simulación.")
    model = None
    scaler = None


# --- API: generar malla hexagonal + SIMULACIÓN de predicción IA ---
@app.route("/api/generate_hexgrid")
def generate_hexgrid():
    """Genera una malla hexagonal y asigna datos simulados."""
    try:
        lat = float(request.args.get('lat'))
        lon = float(request.args.get('lon'))
    except (ValueError, TypeError):
        return jsonify({"error": "Parámetros lat/lon inválidos."}), 400

    # Generar celdas H3 (nivel 8, para más detalle)
    # Genera una región de radio 4 hexes alrededor del punto central
    try:
        hexes = h3.grid_disk(h3.latlng_to_cell(lat, lon, 8), 4) 
    except Exception as e:
        print(f"Error H3: {e}")
        return jsonify({"error": "Fallo al generar la cuadrícula H3."}), 500

    data = []
    
    # Iterar sobre cada hexágono y SIMULAR datos
    for h in hexes:
        # SIMULACIÓN DE DATOS REALISTAS
        ndvi = round(random.uniform(0.5, 0.9), 3) # NDVI: 0.5 a 0.9
        lst = round(random.uniform(295, 305), 2) # LST: 295K a 305K
        sm = round(random.uniform(0.2, 0.5), 3) # Humedad: 0.2 a 0.5
        
        # Simular la etiqueta (60% Verde, 30% Amarillo, 10% Rojo)
        label = random.choice([0, 0, 0, 1, 1, 1, 2, 2, 0, 1]) 
        
        # Colores: ["#28a745" (Verde), "#ffc107" (Amarillo), "#dc3545" (Rojo)]
        color = ["#28a745", "#ffc107", "#dc3545"][label] 
        
        data.append({
            "h3_id": h,
            "features": {
                "ndvi": ndvi,
                "lst": lst,
                "soil_moisture": sm
            },
            "label": int(label),
            "color": color
        })

    return jsonify({"hex_data": data})

# --- Servir el front-end ---
@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

if __name__ == "__main__":
    app.run(debug=True, host='127.0.0.1', port=5000)