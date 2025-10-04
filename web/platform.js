let map;
let h3Layer;
let initialized = false;

// Función llamada al hacer clic en "Entrar a la Plataforma"
function enterPlatform() {
    document.getElementById('landing-page').style.opacity = '0';
    setTimeout(() => {
        document.getElementById('landing-page').style.display = 'none';
        document.getElementById('main-container').style.display = 'flex';
        if (!initialized) {
            initMap();
            initialized = true;
        }
    }, 500);
}

function initMap() {
    // Inicializar el mapa centrado en una región de Latam (Ej. Cusco, Perú)
    map = L.map('map').setView([-13.4, -71.8], 10); 

    // Añadir capa base
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Cargar la capa de riesgo unificado por defecto
    loadRiskMap('unified');
}

// Función que define el color del hexágono basado en el riesgo o el valor del dato
function getRiskColor(level) {
    if (level === 'RED' || level > 0.8) return '#dc3545'; // Rojo Crítico
    if (level === 'YELLOW' || (level > 0.4 && level <= 0.8)) return '#ffc107'; // Amarillo Alerta
    return '#28a745'; // Verde Seguro
}

async function loadRiskMap(mode) {
    if (!map) return;
    if (h3Layer) map.removeLayer(h3Layer);

    // 1. Simulación de Llamada al API del Back-end (Flask)
    // En la versión final, reemplazar por: 
    // const response = await fetch(`/api/risk/latest?mode=${mode}`);
    // const riskData = await response.json();
    
    // SIMULACIÓN DE DATOS - El back-end envía una lista de IDs H3 con un valor
    const riskData = generateSimulatedData(mode);

    let hexFeatures = riskData.map(item => {
        const boundary = h3.h3ToGeoBoundary(item.h3_id, true);
        const latLngs = boundary.map(p => [p[0], p[1]]);

        // El color se asigna según el modo (unified=color literal; otro modo=gradiente)
        const color = (mode === 'unified') 
            ? getRiskColor(item.risk_color) 
            : getRiskColor(item.value); // Usa la función de gradiente para datos crudos

        return {
            type: 'Feature',
            properties: {
                id: item.h3_id,
                color: color,
                risk_level: item.risk_color,
                value: item.value,
                mode: mode
            },
            geometry: {
                type: 'Polygon',
                coordinates: [latLngs]
            }
        };
    });

    // 2. Crear la capa Leaflet (GeoJSON) y dibujarla
    h3Layer = L.geoJSON(hexFeatures, {
        style: (feature) => ({
            fillColor: feature.properties.color,
            weight: 1,
            opacity: 0.8,
            color: 'white',
            fillOpacity: 0.6
        }),
        onEachFeature: (feature, layer) => {
            const popupContent = generatePopupContent(feature.properties);
            layer.bindPopup(popupContent);
            
            // Acción al hacer clic: actualiza el widget de acción/recomendación
            layer.on('click', () => {
                document.getElementById('action-text').innerHTML = generateActionText(feature.properties);
            });
        }
    }).addTo(map);

    if (hexFeatures.length > 0) map.fitBounds(h3Layer.getBounds());
}

function generatePopupContent(props) {
    let detail = `Riesgo IA: ${props.risk_level}`;
    if (props.mode !== 'unified') {
        detail = `Valor ${props.mode}: ${props.value.toFixed(2)}`;
    }
    return `
        <strong>Hexágono H3:</strong> ${props.id}<br>
        <strong>Análisis:</strong> ${detail}<br>
        (Clic para ver acciones y detalles)
    `;
}

function generateActionText(props) {
    if (props.risk_level === 'RED') {
        return `**ALERTA CRÍTICA.** Se detecta pérdida de hábitat o estrés severo. **Acción Sugerida:** Reforestación inmediata con especies nativas.`;
    } else if (props.risk_level === 'YELLOW') {
        return `**PRECAUCIÓN.** Monitorear uso de pesticidas o sequía. **Acción Sugerida:** Instalar puntos de agua y agricultura regenerativa.`;
    } else {
        return `**ZONA SEGURA.** Ecosistema saludable. **Acción Sugerida:** Promover la conservación local y buenas prácticas.`;
    }
}

function downloadRawData() {
    // Función para que el "Experto" descargue los datos de la región en un CSV.
    alert("Descargando datos crudos de NDVI, LST y Cambio de Uso de Suelo en formato CSV...");
    // Implementación: El Flask API debería tener un endpoint como /api/data/download
}

// Generador de datos simulados para que el Front-end funcione antes del Back-end
function generateSimulatedData(mode) {
    const ids = [h3.geoToH3(-13.4, -71.8, 8), h3.geoToH3(-13.3, -71.7, 8), h3.geoToH3(-13.5, -71.9, 8), h3.geoToH3(-13.45, -71.75, 8), h3.geoToH3(-13.35, -71.85, 8)];
    const simulated = [];
    ids.forEach((id, i) => {
        let risk = 'GREEN';
        let value = 0.3; // Valor de dato crudo entre 0 y 1

        if (i % 3 === 1) { risk = 'RED'; value = 0.9; }
        if (i % 3 === 2) { risk = 'YELLOW'; value = 0.6; }

        if (mode === 'unified') {
            simulated.push({ h3_id: id, risk_color: risk, value: 0 });
        } else {
            // Si no es unificado, asignamos el "valor" simulado para el gradiente
            simulated.push({ h3_id: id, risk_color: '', value: value });
        }
    });
    return simulated;
}