# PlaybackProgressController

[Visión general](README.md) · [Código fuente](../../codigo/PlaybackProgressController.md)

Expone `/api/playbackprogress`. El servicio realiza las validaciones y el almacenamiento; el controlador delega las operaciones y centraliza sus respuestas HTTP.

## Construcción

Recibe `PlaybackProgressService` y `ILogger<PlaybackProgressController>`. Cada acción pasa su token de cancelación al servicio.

## Operaciones HTTP

### Get

`GET /api/playbackprogress?libraryPath=...`

Llama a `GetAsync` y devuelve HTTP 200 con `PlaybackProgressLibrary`, que contiene la biblioteca y las entradas de sus series.

### Save

`POST /api/playbackprogress`

Recibe un `SavePlaybackProgressRequest` en JSON y llama a `SaveAsync`. Devuelve HTTP 200 con el `SeriesPlaybackProgress` resultante. Una muestra atrasada devuelve el estado conservado de la serie.

### Reset

`POST /api/playbackprogress/reset`

Recibe `ResetSeriesProgressRequest` con biblioteca y serie. Llama a `ResetAsync` y devuelve el progreso reiniciado de esa serie.

### SetWatched

`POST /api/playbackprogress/watched`

Recibe `SetEpisodeWatchedRequest` con biblioteca, serie, episodio y `watched`. Llama a `SetWatchedAsync` y devuelve el progreso actualizado de la serie.

## Ejecución y respuestas

### ExecuteAsync

Recibe `Func<Task<object>>` para admitir los modelos de respuesta de las distintas acciones. El delegado sitúa la llamada al servicio dentro del `try`. Una operación correcta se devuelve mediante `Ok(...)`.

| Resultado | Tratamiento |
| --- | --- |
| Operación correcta | HTTP 200 con su modelo. |
| `ArgumentException` | HTTP 400 con `error` y el motivo. |
| `InvalidDataException` | HTTP 500 con `error` del archivo y registro técnico. |
| `IOException` o `UnauthorizedAccessException` | HTTP 500 con mensaje de almacenamiento y registro técnico. |
| Cancelación | Se propaga a ASP.NET Core. |

Los atributos `[ApiController]`, `[FromQuery]` y `[FromBody]` intervienen en la vinculación de los parámetros HTTP y los cuerpos de solicitud.
