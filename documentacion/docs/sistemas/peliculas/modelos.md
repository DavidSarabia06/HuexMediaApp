# Modelos de películas

[Sistema](README.md) · [Código de MediaItem](../../codigo/MediaItem.md)

`MediaItem` contiene `Nombre`, `RutaCompleta`, `UrlImagen` e `ImagePath`. La última propiedad se utiliza internamente para generar la URL y tiene `[JsonIgnore]`.

`ImageFile` contiene la ruta y el MIME de una imagen validada. `FolderSelection` contiene `Ruta`, que queda vacía si se cancela el selector.

La biblioteca utiliza `MediaLibrary` y sus grupos utilizan `MediaCategory`, descritos en los [modelos comunes](../categorias/modelos.md). `MoviesCategoryOptions.MaxDepth` se enlaza a `MoviesCategories:MaxDepth` y limita los niveles de categorías de Series y Películas.
