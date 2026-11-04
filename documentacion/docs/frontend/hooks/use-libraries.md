# useLibraries

[Frontend](../README.md) · [Código TypeScript](../../codigo/UseLibraries.md) · [Consultas de bibliotecas](../modulos/library-utils.md)

`src/hooks/useLibraries.ts` gestiona el listado, la selección recordada, la carpeta de origen y las operaciones de creación, eliminación y renombrado de bibliotecas. Cada instancia conserva sus propios estados y referencias.

## Parámetros

- `mediaType`: `Series` o `Movies`. Determina el listado, la preferencia del navegador y el endpoint de selección de carpeta.
- `onReset`: callback opcional que limpia el contenido de la página al iniciar la consulta y al eliminar la biblioteca activa.
- `onLibraryLoaded`: callback que recibe `LibraryLoadResult`, `LibraryPlaybackProgress` y `AbortSignal`. Puede devolver `void` o `Promise<void>` para preparar y aplicar los datos de la página.

La página estabiliza ambos callbacks mediante `useCallback`. El efecto inicial depende de ellos y de `mediaType`.

## Resultado

`UseLibrariesResult` utiliza `ReturnType<typeof useLibraries>` para reflejar los tipos de las propiedades devueltas.

| Grupo | Propiedades principales |
| --- | --- |
| Consulta | `libraries`, `selectedLibrary`, `isLoading`, `loadError`, `selectLibrary` |
| Selector | `librarySelectorRef`, `closeLibrarySelector` |
| Creación | `newLibraryPath`, `newLibraryName`, `creationError`, `isCreating`, `createLibraryDialogRef`, `handleSelectFolder`, `handleCreateLibrary`, `closeCreateLibraryDialog` |
| Eliminación | `libraryToDelete`, `deleteLibraryError`, `isDeletingLibrary`, `deleteLibraryDialogRef`, `openDeleteLibraryDialog`, `handleDeleteLibrary`, `closeDeleteLibraryDialog` |
| Renombrado | `editedLibraryName`, `renameLibraryError`, `isRenamingLibrary`, `renameLibraryDialogRef`, `openRenameLibraryDialog`, `handleRenameLibrary`, `closeRenameLibraryDialog` |

Devuelve setters de nombres y errores para los formularios. `setSelectedLibrary`, `setIsLoading`, `setLoadError` y `activeControllerRef` coordinan las acciones de categorías con la biblioteca activa.

## Carga inicial y selección

El efecto crea un controlador, limpia listado y selección y llama a `onReset`. Consulta `getLibrariesRequest`, recupera la biblioteca recordada y retira la preferencia si ya no existe. Carga la recordada o, si solo hay una biblioteca, esa única opción. Con varias y sin selección previa espera al usuario.

`loadAndSelectLibrary` consulta `loadLibraryRequest` y `getLibraryProgress` en paralelo mediante `Promise.all` y una señal compartida. Comprueba la cancelación y el tipo antes de llamar a `onLibraryLoaded`, guardar la selección y recordar su identificador. Espera a que termine el callback y comprueba de nuevo la cancelación antes de seleccionar la biblioteca. `selectLibrary` utiliza la misma función tras comprobar el listado y el bloqueo de operaciones.

## Carpeta y creación

`handleSelectFolder` consulta `/api/movies/select-folder` o `/api/series/select-folder`. Si la carpeta ya está registrada, carga esa biblioteca. En otro caso propone el nombre de la carpeta y abre el formulario.

`handleCreateLibrary` valida entre 1 y 80 caracteres, guarda la biblioteca, incorpora su resumen ordenado al selector y solicita la carga. Si falla el escaneo después de guardar, conserva el resumen y muestra un error de carga para poder reintentar.

## Eliminación y renombrado

`handleDeleteLibrary` elimina el documento, retira su resumen y limpia su preferencia. Si era la activa, limpia el contenido mediante `onReset`; si queda una sola biblioteca la carga automáticamente. Los fallos de borrado se presentan en el diálogo y los de carga posterior en `loadError`.

`handleRenameLibrary` valida el nombre y actualiza el listado ordenado y la biblioteca seleccionada cuando corresponde. Los métodos de apertura y cierre preparan o limpian los formularios y bloquean el cierre durante el guardado.

## Eventos y cancelación

El efecto del selector escucha clics externos y Escape y retira los listeners en su limpieza. `closeLibrarySelector` cierra el desplegable y devuelve el foco a la cabecera.

`activeControllerRef` guarda la operación vigente y bloquea peticiones simultáneas. Cada operación comprueba la cancelación antes de aplicar resultados y solo libera el bloqueo si conserva su controlador. La limpieza inicial cancela su consulta y cualquier acción posterior que siga activa al salir.

## Integración con Movies

Movies conserva `applyLoadedLibrary`, que recibe los datos ya consultados y actualiza películas, categorías y progreso, y `resetMovieLibrary`, que limpia su contenido y errores. Dibuja el selector y los diálogos con las referencias, estados y acciones del hook.

## Integración con Series

Series utiliza los mismos estados, formularios y acciones. Su callback es asíncrono: prepara los episodios de «Continuar viendo» con la señal recibida y aplica series y progreso únicamente si la carga sigue vigente. El hook mantiene el bloqueo durante esa preparación. La navegación a episodios y el reinicio de una serie permanecen en Series.
