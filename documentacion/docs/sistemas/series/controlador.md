# SeriesController

[Sistema Series](README.md) · [Código fuente](../../codigo/SeriesController.md)

Recibe las solicitudes de exploración, llama a `SeriesService` y convierte las rutas internas de imágenes en URLs. Recibe también `WindowsFolderSelectionService` e `ILogger<SeriesController>`.

## Operaciones HTTP

| Método y ruta | Acción |
| --- | --- |
| `GET /api/series/select-folder` | Abre el selector de Windows y devuelve `{ ruta }`. |
| `GET /api/series/scan?libraryId=…` | Obtiene las series de la biblioteca. |
| `GET /api/series/scan-episodes?libraryId=…&path=…` | Obtiene las temporadas de una serie perteneciente a esa biblioteca. |
| `GET /api/series/image?libraryId=…&path=…` | Sirve una imagen de la biblioteca seleccionada. |

`SetImageUrls` recorre las tarjetas y `GetImageUrl` genera las URLs de imagen incluyendo `libraryId`. Cuando no hay imagen local, conserva la imagen predeterminada.

## Respuestas

`ExecuteAsync` espera la operación y centraliza sus respuestas: argumentos inválidos producen 400, una biblioteca inexistente produce 404 y una imagen externa produce 403. Otros fallos se registran y devuelven 500 con el mensaje de la operación. La cancelación se propaga a ASP.NET Core. Una imagen permitida que no existe devuelve 404.
