# PlaybackProgressController

[Sistema](README.md) · [Código fuente](../../codigo/PlaybackProgressController.md)

Las operaciones de reproducción reciben `libraryId` en la consulta y devuelve HTTP 200 con el documento común `LibraryPlaybackProgress`. Los cuerpos JSON se vinculan directamente a modelos tipados de ASP.NET Core.

| Método y ruta | Modelo recibido | Servicio |
| --- | --- | --- |
| `GET /api/playbackprogress?libraryId=…` | Identificador de biblioteca. | `GetAsync`. |
| `POST /api/playbackprogress?libraryId=…` | `SavePlaybackProgressRequest`. | `SaveAsync`. |
| `POST /api/playbackprogress/reset?libraryId=…` | `ResetSeriesProgressRequest`. | `ResetAsync`. |
| `POST /api/playbackprogress/watched?libraryId=…` | `SetPlaybackWatchedRequest`. | `SetWatchedAsync`. |
| `POST /api/playbackprogress/hide-series?libraryId=…` | `ResetSeriesProgressRequest`, con `SeriesPath`. | `HideSeriesAsync`. |
| `POST /api/playbackprogress/hide?libraryId=…` | `HideContinueWatchingRequest`, con `VideoPath`. | `HideMovieAsync`. |

## Migración desde Ajustes

`GET /api/playbackprogress/legacy` llama a `GetLegacyProgressAsync` y devuelve los archivos antiguos con sus contadores.

`POST /api/playbackprogress/legacy/migrate` recibe `MigratePlaybackProgressRequest`, con `FileName` y `LibraryId`. Llama a `MigrateLegacyProgressAsync` y devuelve el documento común importado.

`ExecuteAsync<T>` ejecuta el delegado dentro del `try` y espera el resultado. Los argumentos inválidos producen 400; una biblioteca o entrada inexistente produce 404. Los documentos inválidos y los fallos de almacenamiento se registran y producen 500. La cancelación se propaga a ASP.NET Core.
