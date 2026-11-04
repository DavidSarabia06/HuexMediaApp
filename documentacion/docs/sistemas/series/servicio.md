# SeriesService

[Sistema Series](README.md) · [Código fuente](../../codigo/SeriesService.md)

Explora los archivos de la biblioteca seleccionada. Recibe `LibraryService` para resolver su identificador, `ConfigurationService` para las opciones de imágenes e `ILogger<SeriesService>`.

## Exploración

`GetSeriesLibraryAsync` obtiene el documento y comprueba que su tipo sea `Series`.

`ScanSeriesAsync(libraryId, cancellationToken)` obtiene la raíz desde ese documento. Cada subcarpeta directa genera un `MediaItem`. Cuando `DownloadSeriesPosters` está activo, busca `icono.jpg`, `icono.png` o `icono.bmp` en la carpeta de la serie.

`ScanEpisodesAsync(libraryId, path, cancellationToken)` comprueba que la carpeta de serie sea hija directa de la raíz de esa biblioteca. Busca vídeos `.mp4`, `.mkv` y `.avi` recursivamente. Agrupa los episodios por el nombre de su carpeta; el grupo con el mismo nombre que la serie se llama «Otros».

`CreateEpisode` crea la tarjeta usando el nombre del vídeo sin extensión. Cuando `DownloadEpisodeThumbnails` está activo, busca una miniatura JPG o PNG con ese nombre. Temporadas y episodios se devuelven ordenados por nombre. Los bucles comprueban la cancelación.

## Imágenes

`GetImageAsync(libraryId, path, cancellationToken)` resuelve la biblioteca y normaliza la ruta. `ValidateImageLocation` utiliza `Path.GetRelativePath` para comprobar que el archivo está dentro de su raíz. Si existe, devuelve un `ImageFile` con su ruta y tipo MIME; si falta, devuelve `null`.

`GetImageContentType` reconoce JPEG, PNG y BMP. `FindImage` devuelve la primera imagen existente siguiendo el orden de extensiones recibido.

Las imágenes predeterminadas son `/default-episode-vertical.png` para series y `/default-episode-horizontal.png` para episodios.
