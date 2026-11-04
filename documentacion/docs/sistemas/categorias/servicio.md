# CategoryService

[Sistema](README.md) · [Código fuente](../../codigo/CategoryService.md)

Recibe `LibraryService` y `IOptions<MoviesCategoryOptions>`. Las operaciones utilizan `libraryId` y modifican el documento mediante `LibraryService.UpdateAsync`. Todas devuelven la biblioteca completa actualizada.

## Creación de elementos

`CreateCategoryAsync` valida el nombre, comprueba que no exista entre las categorías principales y añade un grupo con un GUID nuevo y listas vacías.

`CreateSubcategoryAsync` busca el padre con `FindCategory`. Comprueba el nivel y los nombres de sus hijos antes de añadir el nuevo grupo. El máximo procede de `MoviesCategories:MaxDepth`; la categoría principal cuenta como nivel 1 y el límite se aplica a ambas clases de biblioteca.

## Movimiento de elementos

`MoveItemAsync` normaliza la ruta y verifica que esté dentro de la biblioteca. Busca el destino antes de cambiar nada. `RemoveItemFromCategories` elimina la ruta de todas las ramas; después la añade al destino elegido. Con destino `null`, el elemento queda sin categoría.

## Eliminación de categorías

`DeleteCategoryAsync` llama a `RemoveCategory`, que busca el identificador y elimina el grupo de su lista. Sus descendientes desaparecen con él. Al dejar de estar asignados, sus elementos aparecen en «Sin categoría».

## Cambio de nombre

`RenameCategoryAsync` busca el grupo y su lista contenedora. Comprueba que ningún hermano tenga el nuevo nombre y actualiza `Name`.

## Orden de categorías

`ReorderCategoryAsync` admite desplazamientos de -1 o 1. Localiza el grupo y su lista, comprueba que la nueva posición exista e intercambia ambos grupos completos.

## Búsqueda y validación

`FindCategory` recorre los hermanos y después sus hijos. Devuelve el grupo, su profundidad y la lista que lo contiene. Si la rama no contiene el identificador, devuelve `null`.

`ValidateName` recorta espacios y exige entre 1 y 80 caracteres. `ValidateItemPath` exige una ruta absoluta dentro de la raíz de biblioteca.

## Persistencia compartida

`LibraryService.UpdateAsync` lee la biblioteca dentro de su bloqueo, ejecuta la acción recibida, valida el documento y lo guarda en su `FilePath`. Esa propiedad conserva la ubicación en memoria y tiene `[JsonIgnore]`.

`JsonFileStoreService.WriteAsync` crea un temporal junto al destino y lo serializa. `FileOptions.WriteThrough` solicita que las escrituras atraviesen las cachés intermedias. `FlushAsync` vacía los datos pendientes del stream; `Flush(flushToDisk: true)` solicita además que se escriban físicamente en disco. Una vez cerrado el stream, `File.Replace` sustituye un archivo existente o `File.Move` publica el primero. El bloque `finally` retira el temporal sobrante sin ocultar el error principal.

## Limpieza al cargar bibliotecas

Las acciones de consulta de `LibrariesController` llaman a `GetLibrariesAsync` y `GetAsync` con `cleanupMissingReferences: true`. La primera limpia las bibliotecas del tipo solicitado; la segunda limpia la biblioteca seleccionada. Las llamadas internas de los servicios conservan el valor predeterminado `false` para evitar recorrer el disco en cada guardado de progreso.

`CleanupMissingReferencesAsync` obtiene una instantánea con [`LibraryContentSnapshot.TryRead`](contenido-biblioteca.md#tryreadlibrary-cancellationtoken-includeepisodes-true). Para Series enumera las carpetas hijas directas; para Películas recorre los vídeos de la raíz y sus descendientes.

`RemoveMissingCategoryItems` recorre todos los niveles del árbol y retira de `ItemPaths` las referencias que faltan en el resultado. Conserva los nombres, identificadores y grupos vacíos. Cuando hay cambios, `JsonFileStoreService.WriteAsync` publica el JSON actualizado dentro del bloqueo de biblioteca.

`LibraryContentSnapshot` completa el recorrido antes de devolver sus conjuntos. Una raíz no disponible o un fallo de acceso devuelve `null`, por lo que se conservan las asignaciones guardadas. La cancelación se propaga y los datos estructuralmente inválidos producen un error.
