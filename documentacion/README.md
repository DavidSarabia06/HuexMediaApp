# HuexMediaApp

## Documentación local

Abre `Documentacion.bat` desde la raíz del proyecto, o ejecútalo desde PowerShell:

```powershell
.\Documentacion.bat
```

Abre **http://127.0.0.1:8000** para consultar los sistemas, sus componentes y las funciones. La web incluye menú lateral, buscador y temas claro y oscuro. Los cambios en Markdown y en los archivos de código incluidos se recargan automáticamente.

El primer arranque requiere Python 3.10 o posterior y acceso a Internet para instalar las dependencias en `documentacion/.venv-docs`. No utiliza ni modifica las dependencias del reproductor. Si Python tiene otro nombre o ruta:

```powershell
.\Documentacion.bat -PythonExecutable 'C:\Ruta\Python\python.exe'
```

Para usar otro puerto o construir los HTML sin arrancar el servidor:

```powershell
.\Documentacion.bat -Port 8001
.\Documentacion.bat -Action build
```

Todo se agrupa bajo `documentacion/`: los Markdown en `docs/`, la configuración en `mkdocs.yml`, los scripts en `scripts/`, el entorno Python en `.venv-docs/` y los HTML generados en `.docs-site/`. Las vistas de código se generan desde los archivos originales del servidor.
