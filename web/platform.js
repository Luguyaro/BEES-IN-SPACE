let map;
let hexLayer;

function enterPlatform() {
    document.getElementById('landing-page').style.opacity = '0';
    setTimeout(() => {
        document.getElementById('landing-page').style.display = 'none';
        document.getElementById('main-container').style.display = 'flex';
        initMap();
    }, 500);
}

function initMap() {
    map = L.map('map').setView([-13.4, -71.8], 8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    const drawControl = new L.Control.Draw({
        draw: { polygon:false, circle:false, marker:false, circlemarker:false },
        edit: false
    });
    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, async (e) => {
        const bounds = e.layer.getBounds();
        const center = bounds.getCenter();
        const radiusKm = center.distanceTo(bounds.getNorthEast()) / 1000;
        await requestHexData(center.lat, center.lng, radiusKm);
    });
}

async function manualSelection() {
    const lat = parseFloat(document.getElementById('lat').value);
    const lon = parseFloat(document.getElementById('lon').value);
    const radius = parseFloat(document.getElementById('radius').value);
    await requestHexData(lat, lon, radius);
}

async function requestHexData(lat, lon, radiusKm) {
    if (hexLayer) map.removeLayer(hexLayer);
    const res = await fetch(`/api/generate_hexgrid?lat=${lat}&lon=${lon}&radius=${radiusKm}`);
    const data = await res.json();

    const hexes = data.hex_data.map(item => {
        const boundary = h3.h3ToGeoBoundary(item.h3_id, true).map(p => [p[0], p[1]]);
        return {
            type: "Feature",
            geometry: { type: "Polygon", coordinates: [boundary.map(p => [p[1], p[0]])] },
            properties: item
        };
    });

    hexLayer = L.geoJSON(hexes, {
        style: f => ({
            fillColor: f.properties.color,
            color: "#fff",
            weight: 1,
            fillOpacity: 0.6
        }),
        onEachFeature: (f, layer) => {
            const info = f.properties;
            layer.bindPopup(`
                <b>NDVI:</b> ${info.features.ndvi.toFixed(3)}<br>
                <b>LST:</b> ${info.features.lst.toFixed(2)} K<br>
                <b>Humedad:</b> ${info.features.soil_moisture.toFixed(3)}<br>
                <b>Riesgo:</b> ${["Verde", "Amarillo", "Rojo"][info.label]}
            `);
        }
    }).addTo(map);
}
