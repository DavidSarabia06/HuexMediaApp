# Controladores de películas

[Sistema](README.md) · [Código de MoviesController](../../codigo/MoviesController.md)

`MoviesController` recibe `MoviesService`, `WindowsFolderSelectionService` e `ILogger<MoviesController>`.

| Ruta | Resultado |
| --- | --- |
| `GET /api/movies/select-folder` | Ruta elegida mediante el selector de Windows. |
| `GET /api/movies/scan?libraryId=…` | Películas de la biblioteca, con URLs de imagen. |
| `GET /api/movies/image?libraryId=…&path=…` | Archivo de imagen permitido dentro de la biblioteca. |

`SetImageUrls` genera URLs que incluyen el identificador de biblioteca. `ExecuteAsync` espera las operaciones y centraliza sus respuestas. La organización se gestiona mediante el [controlador común de categorías](../categorias/controlador.md); la selección y creación de bibliotecas utiliza `/api/libraries`.
