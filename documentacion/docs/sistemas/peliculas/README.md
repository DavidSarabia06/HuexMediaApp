# Películas

[Inicio](../../README.md) · [Servicios](servicios.md) · [Modelos](modelos.md) · [Controladores](controladores.md)

La página selecciona una biblioteca de tipo `Movies`. `LibraryService` obtiene su documento y `MoviesService` explora los vídeos y sus carátulas usando `libraryId`. Las categorías y subcategorías pertenecen al [sistema común de categorías](../categorias/README.md).

Los documentos se guardan en `App_Data/Libraries`. Cada biblioteca tiene un identificador estable, nombre visible, tipo de contenido, raíz de vídeos y árbol de categorías. `AppStoragePaths` decide el directorio de datos según el entorno.
