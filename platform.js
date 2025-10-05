// platform.js (SIMULACIÓN en CLIENTE - Corregida)
let map;
let hexLayer;

// Colores para el mapa
const RISK_COLORS = ["#28a745", "#ffc107", "#dc3545"];
const RISK_LABELS = ["Verde (Saludable)", "Amarillo (Moderado)", "Rojo (Crítico)"];

// Variable global para el idioma
let currentLanguage = 'es'; 

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
    
    // Añadir el panel de control de Variables y el selector de Idioma
    addVariableControl();
    addLanguageControl();
}

function addVariableControl() {
    const panel = document.getElementById('controls-panel');
    const variableWidget = document.createElement('div');
    variableWidget.className = 'widget';
    variableWidget.id = 'variable-widget'; // Asignar un ID para orden
    variableWidget.innerHTML = `
        <h4>2. Análisis por Variable (Modo Experto)</h4>
        <p>Visualiza el valor directo de cada variable satelital:</p>
        <select id="variable-selector" onchange="styleHexLayerByVariable(this.value)">
            <option value="risk" selected>Índice de Riesgo (MLP)</option>
            <option value="ndvi">NDVI (Salud Vegetal)</option>
            <option value="lst">LST (Temperatura Superficial)</option>
            <option value="soil_moisture">Humedad del Suelo (SMAP)</option>
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

// NUEVA FUNCIÓN: Control de Idioma
function addLanguageControl() {
    const panel = document.getElementById('controls-panel');
    const languageWidget = document.createElement('div');
    languageWidget.className = 'widget';
    languageWidget.id = 'language-widget';
    languageWidget.innerHTML = `
        <h4>⚙️ Configuración</h4>
        <p>Cambiar idioma de la plataforma:</p>
        <select id="language-selector" onchange="changeLanguage(this.value)">
            <option value="es" selected>Español (ES)</option>
            <option value="en">English (EN)</option>
        </select>
    `;
    // Insertar al final del panel de control
    panel.appendChild(languageWidget);
}

function changeLanguage(lang) {
    currentLanguage = lang;
    alert(lang === 'es' ? "Idioma cambiado a Español." : "Language switched to English.");
    // Esto activa la traducción del contenido de la Landing Page
    showSection(document.querySelector('#section-content').dataset.current || 'plataforma');
}


// Función de SIMULACIÓN: Genera H3 y asigna colores aleatorios
function simulateHexData(lat, lon) {
    if (hexLayer) map.removeLayer(hexLayer);
    
    document.getElementById('controls-panel').style.opacity = 0.5;

    try {
        // Generar celdas H3 (nivel 8) alrededor del punto central
        const resolution = 8;
        const centerH3 = h3.latLngToCell(lat, lon, resolution);
        const hexes = h3.kRing(centerH3, 8); // Aumenté el radio a 8 para una mejor visualización de área.

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
            if (r > 0.6) { // 40% de probabilidad
                label = 1; // Amarillo
            } else if (r < 0.25 && numRojo < 15) { // 25% de probabilidad, limitado a 15 celdas
                label = 2; // Rojo
                numRojo++;
            }
            
            const color = RISK_COLORS[label]; 
            
            // 3. Conversión a GeoJSON para Leaflet
            const boundary = h3.cellToBoundary(h); 
            // Importante: Leaflet usa [lon, lat]. h3.cellToBoundary devuelve [lat, lon]
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
                    label: label, // Índice de riesgo (0=Verde, 1=Amarillo, 2=Rojo)
                    color: color
                }
            });
        }

        // 4. Renderización de la capa GeoJSON
        // Aquí se corrige un posible problema de renderizado. 
        // Asegúrate que 'simulatedData' sea un array de Features.
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
                
                layer.bindPopup(`
                    <b>Celda H3 ID:</b> ${info.h3_id}<br>
                    ---<br>
                    <b>NDVI:</b> ${typeof ndvi_val === 'number' ? ndvi_val.toFixed(3) : ndvi_val}<br>
                    <b>LST:</b> ${typeof lst_val === 'number' ? lst_val.toFixed(2) : lst_val} K<br>
                    <b>Humedad:</b> ${typeof sm_val === 'number' ? sm_val.toFixed(3) : sm_val}<br>
                    ---<br>
                    <b style="color:${info.color}">Riesgo MLP: ${RISK_LABELS[info.label]}</b>
                    <br><button onclick="showValidationPopup('${info.h3_id}', L.latLng(${layer.getBounds().getCenter().lat}, ${layer.getBounds().getCenter().lng}))" style="margin-top: 5px;">Validación Local</button>
                `);
            }
        }).addTo(map);

        // Ajustar el mapa al área de los hexágonos
        if (hexLayer.getBounds().isValid()) {
            map.fitBounds(hexLayer.getBounds());
        }
        
    } catch (e) {
        alert("Error crítico en la simulación geométrica (H3/Leaflet).");
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
            case 'ndvi': // Verde (Alto NDVI) a Amarillo (Bajo NDVI)
                if (value > 0.7) return '#10a500';
                if (value > 0.5) return '#74c67a';
                return '#ffc107';
            case 'lst': // Azul (Baja Temp) a Rojo (Alta Temp)
                if (value < 298) return '#00bfff';
                if (value < 305) return '#ffc107';
                return '#dc3545';
            case 'soil_moisture': // Azul oscuro (Alta Humedad) a Naranja (Baja Humedad)
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

// --- Sección 3: Validación Comunitaria ---
function showValidationPopup(h3_id, center) {
    // Lógica sin cambios
    const celdaInfo = h3_id ? `Celda: <b>${h3_id}</b>` : "Ubicación del mapa";
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