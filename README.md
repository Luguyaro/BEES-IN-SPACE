# BEES-IN-SPACE

* **Instalar Git**

  * Jetson / Linux:
    ```bash
    sudo apt update
    sudo apt install git -y
    ```
  * Windows: instala **Git for Windows** y usa Git Bash.
* **Configurar usuario**

  ```bash
  git config --global user.name "Tu Nombre"
  git config --global user.email "tuemail@ejemplo.com"
  ```

# Añadir todos los cambios

git add .

# Crear un commit con un mensaje

git commit -m "Descripción del cambio"

# Subir los cambios a GitHub

git push origin main

# Bibliotecas



[Instalación de Python  |  Google Earth Engine  |  Google for Developers](https://developers.google.com/earth-engine/guides/python_install?hl=es-419)


```
python -m venv 
.venv.\.venv\Scripts\activate
#instalar librerias
pip install earthengine-api --upgrade
```

Autenticar earthengine

```
earthengine authenticate --force
```

```
earthengine set_project
```

```
pip install -q --upgrade geemap
```

```
pip install -q --upgrade altair
```

```
pip install geopandas h3 pandas numpy matplotlib rasterio earthengine-api flask
```

En codigo ahora poner

```
ee.Authenticate()
ee.Initialize(project='charged-kiln-414822')
```
