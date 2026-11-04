# API de bibliotecas y categorías

[Frontend](../README.md) · [librariesApi](../../codigo/LibrariesApi.md) · [categoriesApi](../../codigo/CategoriesApi.md)

Los módulos de `src/api/` realizan peticiones HTTP, leen sus respuestas con `readJson` y comprueban los datos recibidos. Reciben un `AbortSignal` opcional y devuelven promesas tipadas. Los hooks gestionan los estados, formularios y aplicación de esos resultados.

## librariesApi

- `selectLibraryFolderRequest`: abre el selector de Windows del tipo solicitado y devuelve su ruta.
- `getLibrariesRequest`: obtiene los resúmenes del tipo solicitado.
- `loadLibraryRequest`: obtiene el documento y después escanea su contenido mediante el endpoint de Series o Movies.
- `createLibraryRequest`: registra nombre, tipo y carpeta y devuelve el documento creado.
- `deleteLibraryRequest`: solicita el borrado y comprueba la confirmación y su identificador.
- `renameLibraryRequest`: guarda el nombre y devuelve el documento actualizado.

## categoriesApi

Todas las operaciones devuelven la biblioteca actualizada y comprueban su identificador y listado de categorías.

- `createCategoryRequest`: crea un grupo principal.
- `createSubcategoryRequest`: crea un hijo del grupo indicado.
- `moveCategoryItemRequest`: asigna un elemento al destino o lo deja sin categoría con `null`.
- `deleteCategoryRequest`: elimina el grupo y sus descendientes.
- `renameCategoryRequest`: actualiza el nombre del grupo.
- `reorderCategoryRequest`: desplaza el grupo una posición entre hermanos mediante -1 o 1.

## Utilidades y hooks

`libraryUtils` conserva los tipos y el acceso a la selección recordada en localStorage. `categoryUtils` conserva los tipos y las funciones para recorrer rutas, obtener elementos, contar y construir destinos.

`useLibraries` y `useCategories` importan sus peticiones desde estos módulos API y utilizan las utilidades para transformar datos.
