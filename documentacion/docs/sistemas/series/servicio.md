# SeriesService

[Sistema Series](README.md) · [Código del servicio](../../codigo/SeriesService.md) · [Modelos](modelos.md)

## Responsabilidad

Selecciona carpetas, explora la biblioteca y valida archivos de imagen. Se registra como singleton y obtiene los resultados de cada exploración a partir del sistema de archivos.

## Construcción

### Constructor

Recibe `ConfigurationService` e `ILogger<SeriesService>`. Conserva ambas dependencias para las operaciones del servicio.

## Selección de carpeta

### SelectFolder

**Recibe:** nada. **Devuelve:** `SeriesFolderSelection` con la ruta elegida o vacía al cancelar.

Crea un hilo, lo configura como STA y abre `FolderBrowserDialog` con la descripción de selección de series y `ShowNewFolderButton = false`. `Thread.Join` espera su cierre antes de devolver el resultado.

Windows Forms requiere un hilo STA para el diálogo. Si falla dentro de ese hilo, se captura la excepción y se relanza en el hilo que espera mediante `ExceptionDispatchInfo`, conservando su origen para que el controlador pueda comunicar el error.

Es una operación síncrona e interactiva en Windows que devuelve la ruta elegida.

## Exploración de la biblioteca

### ScanSeries

**Recibe:** `string path`. **Devuelve:** `List<SeriesMediaItem>`.

Llama a [ValidateDirectory](#validatedirectory), obtiene `DownloadSeriesPosters` y recorre `Directory.GetDirectories(path)`. Para cada subcarpeta crea una tarjeta con su nombre, su ruta y la imagen predeterminada. Si la opción está activada llama a [FindImage](#findimage) para buscar `icono.jpg`, `icono.png` o `icono.bmp`, en ese orden.

Registra cuántas series ha encontrado y conserva el orden de enumeración de directorios. Cada subcarpeta representa una serie.

**Errores:** ruta vacía o inexistente, errores de configuración o de enumeración del sistema de archivos.

### ScanEpisodes

**Recibe:** `string path`. **Devuelve:** `SeriesEpisodesResponse`.

Llama a [ValidateDirectory](#validatedirectory), obtiene `DownloadEpisodeThumbnails`, enumera los archivos recursivamente y filtra con [IsVideoFile](#isvideofile). Agrupa por el nombre de la carpeta que contiene cada vídeo.

Para cada grupo llama a [CreateEpisode](#createepisode) y ordena los episodios por `Nombre`. Cambia el nombre del grupo a «Otros» si coincide con el nombre de la serie, ordena los grupos por `NombreTemporada` y registra su número.

El orden es textual y los grupos se identifican por nombre de carpeta. Los grupos se crean a partir de los vídeos encontrados; una exploración vacía devuelve `Temporadas` vacía.

**Errores:** ruta inválida, fallos al leer configuración y fallos durante el recorrido recursivo.

### CreateEpisode

**Recibe:** `string file` y `bool useThumbnails`. **Devuelve:** `SeriesMediaItem`.

Extrae el nombre sin extensión y el directorio del vídeo. Si se solicitan miniaturas, busca una imagen con el mismo nombre base y extensión `.jpg` o `.png`, en ese orden. Inicializa la URL predeterminada y conserva la ruta interna de imagen si la encuentra.

**La llama:** [ScanEpisodes](#scanepisodes).

## Imágenes locales

### GetImage

**Recibe:** `string path`. **Devuelve:** `SeriesImageFile?`.

1. Rechaza la ruta vacía mediante `ArgumentException`.
2. Lee `SeriesLibraryPath` desde configuración.
3. Obtiene las rutas completas de la biblioteca y la imagen.
4. Llama a [ValidateImageLocation](#validateimagelocation).
5. Si el archivo no existe, devuelve `null`.
6. Llama a [GetImageContentType](#getimagecontenttype) y devuelve el descriptor.

Una imagen externa se rechaza antes de comprobar su existencia. Un archivo inexistente devuelve `null` antes de comprobar su formato. Los fallos al leer `appsettings.json` se propagan como errores del servidor.

### FindImage

**Recibe:** directorio, nombre base y array de extensiones. **Devuelve:** la primera ruta cuyo archivo exista, o `null`.

**La llaman:** [ScanSeries](#scanseries) y [CreateEpisode](#createepisode). La prioridad depende del orden del array. `GetImage` también permite servir imágenes con extensión `.jpeg`.

### GetImageContentType

**Recibe:** ruta del archivo. **Devuelve:** su tipo MIME.

| Extensión | Tipo MIME |
| --- | --- |
| `.jpg` y `.jpeg` | `image/jpeg` |
| `.png` | `image/png` |
| `.bmp` | `image/bmp` |

Convierte la extensión a minúsculas. Las demás extensiones producen `ArgumentException`. La validación comprueba la extensión del archivo.

## Validación

### ValidateDirectory

**Recibe:** ruta y mensaje de error de la operación. **Devuelve:** nada si la carpeta existe.

Rechaza rutas vacías, de espacios o no existentes mediante `ArgumentException`.  **La llaman:** [ScanSeries](#scanseries) y [ScanEpisodes](#scanepisodes).

### IsVideoFile

**Recibe:** ruta de un archivo. **Devuelve:** `bool` al comprobar si su extensión es `.mp4`, `.mkv` o `.avi`, sin distinguir mayúsculas. **La llama:** [ScanEpisodes](#scanepisodes).

### ValidateImageLocation

**Recibe:** rutas completas de biblioteca e imagen. **Devuelve:** nada si la ubicación se considera interna.

Calcula `Path.GetRelativePath` y rechaza resultados absolutos, `..` o los que empiezan por un segmento padre con cualquiera de los separadores de directorio. Lanza `SecurityException` para que el controlador distinga una ubicación externa de un fallo normal de lectura o permisos.

La pertenencia se comprueba mediante la ruta relativa calculada. **La llama:** [GetImage](#getimage).
