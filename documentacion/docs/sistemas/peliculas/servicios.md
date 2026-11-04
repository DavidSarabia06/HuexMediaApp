# Servicios de películas

[Sistema](README.md) · [Código de MoviesService](../../codigo/MoviesService.md)

## MoviesService

Recibe `LibraryService`, `ConfigurationService` e `ILogger<MoviesService>`. `GetMovieLibraryAsync` obtiene el documento y comprueba su tipo.

`ScanMoviesAsync(libraryId, cancellationToken)` recorre `LibraryPath` y sus subcarpetas. Conserva vídeos `.mp4`, `.mkv` y `.avi`. Crea un `MediaItem` por archivo, con su nombre sin extensión y ruta completa. Si `DownloadMoviePosters` está activo, busca junto al vídeo una imagen JPG, PNG o BMP con el mismo nombre.

`GetImageAsync` resuelve la biblioteca y comprueba que la imagen esté dentro de su raíz. Si existe, devuelve `ImageFile` con su MIME; si falta, devuelve `null`. `FindImage` busca por orden de extensiones y `GetImageContentType` reconoce JPEG, PNG y BMP.

## Organización y persistencia

[CategoryService](../categorias/servicio.md) crea, renombra, mueve, ordena y elimina grupos usando `LibraryService.UpdateAsync`. Este último protege el documento con su semáforo y lo publica mediante `JsonFileStoreService`.
