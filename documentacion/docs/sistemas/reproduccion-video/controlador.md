# VideoController

[Visión general](README.md) · [Código fuente](../../codigo/VideoController.md)

Expone las operaciones de reproducción bajo `/api/video`. Cada acción delega el trabajo en `VideoService` dentro de `ExecuteAsync`. Las validaciones de archivos, posiciones, pistas e identificadores pertenecen al servicio.

## Construcción

Recibe `VideoService` y `ILogger<VideoController>` por inyección de dependencias. Las operaciones de análisis, inicio y subtítulos pasan `HttpContext.RequestAborted` al servicio.

## Operaciones HTTP

### GetVideoInfo

`GET /api/video/info?path=...`

Llama a `GetVideoInfoAsync` y devuelve 200 con un `VideoInfo`: duración, resolución, códecs y pistas disponibles.

### Start

`POST /api/video/start?path=...&startSeconds=0&audioTrackIndex=...`

Llama a `StartHlsAsync`. `startSeconds` vale cero por defecto y `audioTrackIndex` es opcional. Devuelve 200 con:

| Campo | Contenido |
| --- | --- |
| `sessionId` | Identificador de la sesión preparada. |
| `playlistUrl` | URL local del manifiesto HLS. |
| `startSeconds` | Posición solicitada. |
| `timelineStartSeconds` | Inicio real del primer segmento en el episodio. |
| `transportTimestampOffsetSeconds` | Margen aplicado a las marcas del transporte. |

### GetSubtitles

`GET /api/video/subtitles?path=...&trackIndex=...`

Llama a `GetSubtitlesAsync` con el índice absoluto de la pista. Devuelve 200 con contenido `text/vtt` en UTF-8.

### Stop

`POST /api/video/stop/{sessionId}`

Llama a `StopHlsAsync` y devuelve 200 con `message: "Sesión de reproducción finalizada."`. El servicio conserva en pendientes las detenciones o borrados que requieran otro intento. La llamada se puede repetir para el mismo identificador válido.

### GetHlsFile

`GET /api/video/hls/{sessionId}/{fileName}`

Obtiene un `HlsMediaFile` validado por el servicio y crea un `PhysicalFileResult`. El manifiesto usa `application/vnd.apple.mpegurl`; los segmentos usan `video/mp2t`. La lectura y envío del archivo se realizan cuando ASP.NET Core ejecuta ese resultado.

## Ejecución y respuestas

### ExecuteAsync

Recibe un `Func<Task<IActionResult>>`, el mensaje de fallo de la operación y un mensaje opcional para archivos ausentes. Ejecuta el delegado dentro del `try` y conserva la respuesta de éxito de cada acción.

| Resultado del servicio | Respuesta |
| --- | --- |
| Operación completada | Resultado generado por la acción. |
| `ArgumentException` | 400 con `error` y el motivo de validación. |
| `FileNotFoundException` | 404 con `error`; distingue vídeo ausente de archivo HLS pendiente. |
| Otra excepción | 500 con `error` de la operación y registro del detalle técnico. |
| `OperationCanceledException` | Se propaga a ASP.NET Core. |

El delegado permite que los fallos de las llamadas síncronas, como resolver un archivo HLS, entren en el mismo tratamiento que los de las operaciones asíncronas.
