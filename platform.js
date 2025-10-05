// platform.js (MODIFICADO para Default EN y sin control de idioma repetido)
let map;
let hexLayer;

// Colores para el mapa
const RISK_COLORS = ["#28a745", "#ffc107", "#dc3545"];

// Se inicializa en 'en' (English) por defecto, para reflejar el cambio en index.html
let currentLanguage = 'en'; 

// Función de entrada a la plataforma (sin cambios)
function enterPlatform() {
    document.getElementById('landing-page').style.opacity = '0';
    setTimeout(() => {
        document.getElementById('landing-page').style.display = 'none';
        document.getElementById('main-container').style.display = 'flex';
        initMap();
    }, 500);
}

function initMap() {
    // Map initialization logic (unchanged)
    map = L.map('map').setView([-12.5, -70.5], 9); 
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    
    const drawControl = new L.Control.Draw({
        edit: { featureGroup: drawnItems },
        draw: {
            polygon: false, circle: false, marker: false, circlemarker: false,
            polyline: false,
            rectangle: { shapeOptions: { color: '#ffc300' } }
        }
    });
    map.addControl(drawControl);

    // Manejador del evento CREATED
    map.on(L.Draw.Event.CREATED, async (e) => {
        drawnItems.clearLayers(); 
        const layer = e.layer;
        drawnItems.addLayer(layer);
        
        const bounds = layer.getBounds();
        const center = bounds.getCenter();
        
        // Llamar a la función de simulación local
        simulateHexData(center.lat, center.lng); 
    });
    
    // Se inserta el control de Variables
    addVariableControl();
}

// Función auxiliar para obtener las etiquetas de riesgo en el idioma actual
function getRiskLabel(index) {
    if (currentLanguage === 'es') {
        const labels = ["Verde (Saludable)", "Amarillo (Moderado)", "Rojo (Crítico)"];
        return labels[index];
    }
    // Default: English
    const labels = ["Green (Healthy)", "Yellow (Moderate)", "Red (Critical)"];
    return labels[index];
}


// MODIFICADA: Ahora usa currentLanguage para traducir el widget al inicio o al cambiar idioma
function addVariableControl() {
    const panel = document.getElementById('controls-panel');
    // Si ya existe, lo quitamos para recargar con el nuevo idioma
    let variableWidget = document.getElementById('variable-widget');
    if (variableWidget) variableWidget.remove();
    
    variableWidget = document.createElement('div');
    variableWidget.className = 'widget';
    variableWidget.id = 'variable-widget'; 
    
    const title = currentLanguage === 'es' ? '2. Análisis por Variable (Modo Experto)' : '2. Variable Analysis (Expert Mode)';
    const text = currentLanguage === 'es' ? 'Visualiza el valor directo de cada variable satelital:' : 'Visualize the direct value of each satellite variable:';
    const riskOption = currentLanguage === 'es' ? 'Índice de Riesgo (MLP)' : 'Risk Index (MLP)';
    const ndviOption = currentLanguage === 'es' ? 'NDVI (Salud Vegetal)' : 'NDVI (Vegetation Health)';
    const lstOption = currentLanguage === 'es' ? 'LST (Temperatura Superficial)' : 'LST (Surface Temperature)';
    const smOption = currentLanguage === 'es' ? 'Humedad del Suelo (SMAP)' : 'Soil Moisture (SMAP)';

    variableWidget.innerHTML = `
        <h4>${title}</h4>
        <p>${text}</p>
        <select id="variable-selector" onchange="styleHexLayerByVariable(this.value)">
            <option value="risk" selected>${riskOption}</option>
            <option value="ndvi">${ndviOption}</option>
            <option value="lst">${lstOption}</option>
            <option value="soil_moisture">${smOption}</option>
        </select>
    `;
    // Insertar después del primer widget (Índice de Riesgo)
    const firstWidget = panel.querySelector('.widget');
    if (firstWidget) {
        panel.insertBefore(variableWidget, firstWidget.nextSibling);
    } else {
        panel.appendChild(variableWidget);
    }
}


// Función de SIMULACIÓN: Genera H3 y asigna colores aleatorios (CORREGIDA)
function simulateHexData(lat, lon) {
    if (hexLayer) map.removeLayer(hexLayer);
    
    document.getElementById('controls-panel').style.opacity = 0.5;

    try {
        // Generar celdas H3 (nivel 8)
        const resolution = 8;
        const centerH3 = h3.latLngToCell(lat, lon, resolution);
        const hexes = h3.kRing(centerH3, 8); 

        const simulatedData = [];
        let numRojo = 0;
        
        for (const h of hexes) {
            // 1. Simulación de Datos Ambientales Ficticios
            const ndvi = (Math.random() * 0.4 + 0.5); // 0.5 a 0.9 (Alto)
            const lst = (Math.random() * 10 + 295); // 295K a 305K
            const sm = (Math.random() * 0.3 + 0.2); // 0.2 a 0.5

            // 2. Simulación de Etiqueta (40% Verde, 35% Amarillo, 25% Rojo)
            let label = 0; // Por defecto Verde
            const r = Math.random();
            if (r > 0.6) { 
                label = 1; // Amarillo
            } else if (r < 0.25 && numRojo < 15) { 
                label = 2; // Rojo
                numRojo++;
            }
            
            const color = RISK_COLORS[label]; 
            
            // 3. Conversión a GeoJSON para Leaflet
            const boundary = h3.cellToBoundary(h); 
            // Leaflet usa [lon, lat], h3.cellToBoundary devuelve [lat, lon]
            const geojson_coords = [boundary.map(p => [p[1], p[0]])]; 
            
            simulatedData.push({
                type: "Feature",
                geometry: { type: "Polygon", coordinates: geojson_coords },
                properties: {
                    h3_id: h,
                    features: {
                        ndvi: ndvi,
                        lst: lst,
                        soil_moisture: sm
                    },
                    label: label, 
                    color: color
                }
            });
        }

        // 4. Renderización de la capa GeoJSON
        hexLayer = L.geoJSON(simulatedData, {
            style: f => ({
                fillColor: f.properties.color,
                color: "#fff",
                weight: 1,
                fillOpacity: 0.6
            }),
            onEachFeature: (f, layer) => {
                const info = f.properties;
                const ndvi_val = info.features.ndvi || 'N/A';
                const lst_val = info.features.lst || 'N/A';
                const sm_val = info.features.soil_moisture || 'N/A';
                
                layer.on('click', (e) => {
                    layer.openPopup();
                    L.DomEvent.stopPropagation(e);
                });
                
                // PopUp bilingüe
                const title_popup = currentLanguage === 'es' ? 'Riesgo MLP:' : 'MLP Risk:';
                const button_popup = currentLanguage === 'es' ? 'Validación Local' : 'Local Validation';
                const ndvi_label = currentLanguage === 'es' ? 'NDVI:' : 'NDVI:';
                const lst_label = currentLanguage === 'es' ? 'LST:' : 'LST:';
                const sm_label = currentLanguage === 'es' ? 'Humedad:' : 'Moisture:';
                const h3_label = currentLanguage === 'es' ? 'Celda H3 ID:' : 'H3 Cell ID:';
                
                layer.bindPopup(`
                    <b>${h3_label}</b> ${info.h3_id}<br>
                    ---<br>
                    <b>${ndvi_label}</b> ${typeof ndvi_val === 'number' ? ndvi_val.toFixed(3) : ndvi_val}<br>
                    <b>${lst_label}</b> ${typeof lst_val === 'number' ? lst_val.toFixed(2) : lst_val} K<br>
                    <b>${sm_label}</b> ${typeof sm_val === 'number' ? sm_val.toFixed(3) : sm_val}<br>
                    ---<br>
                    <b style="color:${info.color}">${title_popup} ${getRiskLabel(info.label)}</b>
                    <br><button onclick="showValidationPopup('${info.h3_id}', L.latLng(${layer.getBounds().getCenter().lat}, ${layer.getBounds().getCenter().lng}))" style="margin-top: 5px;">${button_popup}</button>
                `);
            }
        }).addTo(map);

        // Ajustar el mapa al área de los hexágonos
        if (hexLayer.getBounds().isValid()) {
            map.fitBounds(hexLayer.getBounds());
        }
        
    } catch (e) {
        alert(currentLanguage === 'es' ? "Error crítico en la simulación geométrica (H3/Leaflet)." : "Critical error in geometric simulation (H3/Leaflet).");
        console.error("Simulation error:", e);
    }
    
    document.getElementById('controls-panel').style.opacity = 1;
}

// --- Función para Análisis por Variable (Modo Experto) ---
function styleHexLayerByVariable(variable) {
    if (!hexLayer) return;

    const getColor = (value, variable) => {
        if (value === null || value === 'N/A') return '#808080';
        
        value = parseFloat(value); 

        switch (variable) {
            case 'ndvi': 
                if (value > 0.7) return '#10a500';
                if (value > 0.5) return '#74c67a';
                return '#ffc107';
            case 'lst': 
                if (value < 298) return '#00bfff';
                if (value < 305) return '#ffc107';
                return '#dc3545';
            case 'soil_moisture': 
                if (value > 0.4) return '#007bff';
                if (value > 0.2) return '#87cefa';
                return '#f58230';
            case 'risk':
            default:
                return RISK_COLORS[value]; 
        }
    };

    hexLayer.setStyle(f => {
        let value;
        let color;
        
        if (variable === 'risk') {
            value = f.properties.label;
            color = RISK_COLORS[value];
        } else {
            value = f.properties.features[variable];
            color = getColor(value, variable);
        }

        return {
            fillColor: color,
            color: "#fff",
            weight: 1,
            fillOpacity: 0.6
        };
    });
}

// --- Sección 3: Validación Comunitaria (Ahora bilingüe) ---
function showValidationPopup(h3_id, center) {
    const celdaInfo = h3_id ? (currentLanguage === 'es' ? `Celda: <b>${h3_id}</b>` : `Cell: <b>${h3_id}</b>`) : (currentLanguage === 'es' ? "Ubicación del mapa" : "Map location");
    
    const content = `
        <div style="font-family: Arial, sans-serif;">
            <h4>${currentLanguage === 'es' ? 'Validación Local' : 'Local Validation'} para ${celdaInfo}</h4>
            <p>${currentLanguage === 'es' ? 'Ayúdanos a verificar el estado. Sube una foto de la floración, abejas o colmenas:' : 'Help us verify the status. Upload a photo of the flowering, bees, or hives:'}</p>
            <form id="validationForm">
                <input type="file" id="local_photo" accept="image/*" required style="margin-bottom: 10px;"><br>
                <label for="local_notes">${currentLanguage === 'es' ? 'Observaciones:' : 'Observations:'}</label><br>
                <textarea id="local_notes" rows="3" style="width: 100%; margin-bottom: 10px;"></textarea><br>
                <button type="submit" style="background-color: #ffc300; color: #111; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer;">${currentLanguage === 'es' ? 'Enviar Validación' : 'Submit Validation'}</button>
            </form>
            <p id="validationMessage" style="color: green; margin-top: 10px; display: none; font-weight: bold;">✅ ${currentLanguage === 'es' ? '¡Gracias! Validación enviada (Simulado).' : 'Thanks! Validation sent (Simulated).'}</p>
        </div>
    `;

    const popup = L.popup({ maxWidth: 300 })
        .setLatLng(center || map.getCenter())
        .setContent(content)
        .openOn(map);
        
    document.getElementById('validationForm').onsubmit = (e) => {
        e.preventDefault();
        document.getElementById('validationMessage').style.display = 'block';
        setTimeout(() => popup.remove(), 2000); 
    };
}