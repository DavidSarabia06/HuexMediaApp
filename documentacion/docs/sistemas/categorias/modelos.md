# Modelos comunes de categorías

[Sistema](README.md) · [Código de MediaCategory](../../codigo/MediaCategory.md) · [Código de MediaLibrary](../../codigo/MediaLibrary.md)

## MediaCategory

| Propiedad | Uso |
| --- | --- |
| `Id` | GUID del grupo. |
| `Name` | Nombre visible. |
| `ItemPaths` | Rutas directas de series o películas asignadas al grupo. |
| `Subcategories` | Lista de hijos del mismo tipo `MediaCategory`. |

## MediaLibrary

El documento de versión 2 contiene `Id`, `Name`, `MediaType`, `LibraryPath` y `Categories`. `FilePath` conserva la ubicación del JSON durante las operaciones del servicio y se excluye de la serialización.

## Solicitudes de la API

| Modelo | Campos |
| --- | --- |
| `CreateCategoryRequest` | `Name`. |
| `RenameCategoryRequest` | `Name`. |
| `MoveCategoryItemRequest` | `ItemPath`, `TargetCategoryId` opcional. |
| `ReorderCategoryRequest` | `Offset`, con valor -1 o 1. |

El identificador de biblioteca y los identificadores de grupo se reciben en la URL. `MoviesCategoryOptions.MaxDepth` limita la profundidad del árbol.
