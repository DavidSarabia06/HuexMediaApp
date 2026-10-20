# SeriesController

[Sistema Series](README.md) · [Código del controlador](../../codigo/SeriesController.md) · [Servicio](servicio.md)

## Responsabilidad

Recibe las solicitudes HTTP, llama a `SeriesService`, genera las URLs de imágenes y crea las respuestas. Las reglas de rutas, formatos y exploración pertenecen al servicio.

La ruta base sigue siendo `/api/series`. Las cuatro operaciones son síncronas. `[ApiController]` puede rechazar errores del enlazado de modelos antes de ejecutar una acción.

## Construcción

### Constructor

Recibe `SeriesService` e `ILogger<SeriesController>` mediante inyección de dependencias. El servicio se registra en `Program.cs`.

## Operaciones HTTP

| Acción | Ruta | Respuesta correcta |
| --- | --- | --- |
| [SelectFolder](#selectfolder) | `GET /api/series/select-folder` | 200 con `{ "ruta": "..." }` |
| [ScanSeries](#scanseries) | `GET /api/series/scan?path=...` | 200 con un array de series |
| [ScanEpisodes](#scanepisodes) | `GET /api/series/scan-episodes?path=...` | 200 con `{ "temporadas": [...] }` |
| [GetImage](#getimage) | `GET /api/series/image?path=...` | Archivo de imagen con su MIME |

### SelectFolder

Ejecuta `SeriesService.SelectFolder` dentro de [Execute](#execute). Cancelar devuelve una ruta vacía. El mensaje de error general sigue siendo «No se ha podido seleccionar la carpeta.».

### ScanSeries

Recibe `[FromQuery] string path`. Ejecuta el escaneo del servicio, llama a [SetImageUrls](#setimageurls) y devuelve la lista.

Cada tarjeta mantiene `nombre`, `rutaCompleta` y `urlImagen`. `[JsonIgnore]` reserva `ImagePath` para el intercambio interno entre servicio y controlador.

### ScanEpisodes

Recibe `[FromQuery] string path`. Obtiene `SeriesEpisodesResponse` y llama a [SetImageUrls](#setimageurls) para los episodios de cada temporada antes de devolver la respuesta.

Se conservan `temporadas`, `nombreTemporada`, `episodios` y los campos de tarjeta que consume React.

### GetImage

Recibe `[FromQuery] string path`. Llama al servicio y devuelve 404 sin cuerpo si recibe `null`. Si recibe un descriptor válido, crea `PhysicalFileResult` con la ruta completa y el tipo MIME. El descriptor proporciona los datos para enviar la imagen.

Si el archivo desaparece después de validarlo, el envío físico puede fallar al ejecutarse el resultado HTTP; esa fase se ejecuta después de que la acción haya devuelto su resultado.

## URLs de imágenes

### SetImageUrls

Recibe `List<SeriesMediaItem>` y actualiza su `UrlImagen` usando [GetImageUrl](#getimageurl). El valor que trae el servicio actúa como imagen predeterminada. **La llaman:** [ScanSeries](#scanseries) y [ScanEpisodes](#scanepisodes).

### GetImageUrl

Recibe una ruta interna opcional y una URL predeterminada. Si no hay ruta, devuelve la predeterminada. Si hay ruta, llama a `Url.Action` para generar el enlace a `GetImage`; si no se puede generar, vuelve a la predeterminada.

La generación de enlaces se queda en el controlador porque depende del enrutamiento HTTP.

## Ejecución y respuestas

### Execute

Recibe `Func<IActionResult> operation` y el mensaje general de error de la acción. Invoca la función dentro del `try` y devuelve su resultado.

| Situación | Respuesta |
| --- | --- |
| Acción correcta | Resultado construido por la acción |
| `ArgumentException` de validación | 400 con `{ "error": ex.Message }` |
| `SecurityException` por ubicación externa | 403 sin cuerpo |
| Descriptor de imagen `null` | La acción `GetImage` devuelve 404 sin cuerpo |
| Otra excepción | Registra el detalle y devuelve 500 con el mensaje general de la operación |

Un archivo de configuración ausente se considera error del servidor y produce 500, aunque se estuviera consultando una imagen.

El controlador construye directamente el estado HTTP 403 cuando el servicio rechaza la ubicación del archivo.

## Comprobaciones

Se ha comprobado la compilación y se han ejecutado pruebas con carpetas y archivos independientes. Cubren series vacías, exploración recursiva, agrupación por nombre, orden textual, formatos de vídeo, imágenes predeterminadas, opciones de configuración, prioridad de imágenes locales y contratos JSON con sus propiedades de respuesta.

Las pruebas también cubren resultados directos del controlador para rutas inválidas, MIME de imágenes, imágenes externas, archivos inexistentes y configuración ausente. La generación de URLs se comprueba con un sustituto del enrutamiento.

La comprobación manual del selector consiste en abrir el diálogo en el equipo del servidor, elegir una carpeta o cancelar y verificar la ruta devuelta.
