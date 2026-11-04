# libraryUtils

[Frontend](../README.md) · [Código TypeScript](../../codigo/LibraryUtils.md) · [Peticiones API](library-category-api.md)

`src/utils/libraryUtils.ts` reúne los tipos comunes de bibliotecas y las funciones para recordar la selección en el navegador.

## Tipos

`MediaType` distingue Series y Movies. `LibrarySummary` contiene identificador, nombre, tipo y carpeta. `LibraryLoadResult` contiene el documento y sus elementos escaneados. `DeleteLibraryResult` representa la confirmación de eliminación. `MediaLibrary` y `MediaItem` reutilizan los modelos comunes de categorías.

## Selección recordada

`getRememberedLibraryId(mediaType)` lee `huex:last-library:${mediaType}` y devuelve el identificador o null. `rememberLibraryId(mediaType, libraryId)` guarda la selección o retira la preferencia cuando recibe null. Ambas funciones permiten continuar si el navegador bloquea localStorage.

Las consultas y modificaciones HTTP se encuentran en [librariesApi](../../codigo/LibrariesApi.md).
