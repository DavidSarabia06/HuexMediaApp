"""Genera vistas del código desde los archivos reales, sin mantener copias manuales."""

from pathlib import Path

from mkdocs.structure.files import File


def on_files(files, config):
    root = Path(config.config_file_path).parent.parent
    # MkDocs recarga YAML al cambiarlo durante serve. Leer la lista aquí evita
    # conservar una lista antigua en el módulo Python cargado al arrancar.
    for name, relative_path in config["extra"]["source_files"].items():
        source = (root / relative_path).read_text(encoding="utf-8-sig")
        language = {".cs": "csharp", ".jsx": "jsx", ".js": "javascript", ".css": "css"}.get(
            Path(relative_path).suffix.lower(), "text"
        )
        content = (
            f"# {name}\n\n"
            f"Archivo del proyecto: `{relative_path}`.\n\n"
            "Esta vista se genera desde el código actual al construir la documentación.\n\n"
            f"```{language}\n{source.rstrip()}\n```\n"
        )
        files.append(File.generated(config, f"codigo/{name}.md", content=content))
    return files
