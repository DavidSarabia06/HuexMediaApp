"""Genera vistas del código desde los archivos reales, sin mantener copias manuales."""

from pathlib import Path

from mkdocs.structure.files import File


SOURCES = {
    "SeriesCategoryService": "HuexMediaApp.Server/Services/SeriesCategoryService.cs",
    "SeriesCategory": "HuexMediaApp.Server/Models/SeriesCategory.cs",
    "SeriesCategoriesController": "HuexMediaApp.Server/Controllers/SeriesCategoriesController.cs",
}


def on_files(files, config):
    root = Path(config.config_file_path).parent.parent
    for name, relative_path in SOURCES.items():
        source = (root / relative_path).read_text(encoding="utf-8-sig")
        content = (
            f"# {name}\n\n"
            f"Archivo del proyecto: `{relative_path}`.\n\n"
            "Esta vista se genera desde el código actual al construir la documentación.\n\n"
            f"```csharp\n{source.rstrip()}\n```\n"
        )
        files.append(File.generated(config, f"codigo/{name}.md", content=content))
    return files
