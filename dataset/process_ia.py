import ee
import geemap.core as geemap
#Primera vez o se cambio el codigo o ubicación del archivo de credenciales
#ee.Authenticate(force=True)
#Ya se autentico
ee.Authenticate()
# Inicializar la librería con el ID del proyecto
ee.Initialize(project='charged-kiln-414822')
print(ee.String('Hello from the Earth Engine servers!').getInfo())