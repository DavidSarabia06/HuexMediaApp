# Settings

[Frontend](../README.md) · [Código TSX](../../codigo/Settings.md) · [Estilos](../../codigo/SettingsStyles.md)

`Settings.tsx` permite elegir la apariencia de los bordes y actualizar bibliotecas y progreso antiguos desde `/settings`.

## Apariencia de los títulos

El panel **Bordes de los títulos** permite elegir **Lisos** o **Animados**. La opción afecta a los títulos principales con contorno: Mi biblioteca, Mis películas, Mis series y el nombre de la serie en su página de episodios.

App conserva la preferencia mediante `useTitleBorderStyle`, la comparte con Settings y la guarda en localStorage con la clave `huex:title-border-style`. La duración y cantidad se guardan en `huex:title-border-duration` y `huex:title-border-line-count`. La longitud se guarda en `huex:title-border-line-length`. El patrón SVG utiliza `longitud / número` para el trazo y `(100 - longitud) / número` para el hueco, conservando siempre la distribución por el perímetro. Los controles se deshabilitan en modo liso y conservan sus valores. Sin preferencia válida utiliza `animated`; si el navegador bloquea el almacenamiento, conserva la elección en memoria durante la sesión.

El atributo `data-title-border-style` activa las reglas de `HuexTitleBorder.css`. En modo animado, las líneas recorren continuamente el título y usan `currentColor`. El control de velocidad permite entre 2 y 20 segundos por vuelta; el selector de líneas permite de 1 a 6, distribuidas a igual distancia. El control de longitud ajusta del 10% al 90% del tramo asignado a cada línea; el resto queda como hueco. Los valores iniciales son 8 segundos, 2 líneas y 36% de longitud. En modo liso queda el contorno completo habitual. Las tarjetas conservan bordes lisos al interactuar: amarillo para episodios clave, blanco para normales y el color de sección en los paneles del Home.

## Detección y actualización

`handleSearchLegacyLibraries` consulta los documentos antiguos de Series y Películas y las bibliotecas actuales en paralelo. Compara tipo y ruta normalizada para mostrar las pendientes. `handleLibraryNameChange` modifica el nombre propuesto. `handleMigrateLibrary` envía nombre y tipo al endpoint de conversión y retira la biblioteca de la lista al completarse.

`isBusy` deshabilita los controles durante las peticiones. `controllerRef` conserva la operación activa y la limpieza del efecto cancela la espera al salir de Configuración. Los estados `error` y `message` muestran el resultado de las operaciones.

## Presentación

Un panel superior reúne la descripción y la búsqueda. Cada biblioteca pendiente presenta su tipo, contador, ubicación, archivo original y formulario de nombre. Los paneles utilizan dos columnas y pasan a una hasta 900 píxeles. Los botones y campos reutilizan `action-btn`, `category-dialog-form` y `category-dialog-actions`; `Settings.css` define los paneles, los mensajes y la distribución adaptable.

## Migración manual del progreso

El segundo apartado utiliza los mismos paneles y estilos del primero. `handleSearchLegacyProgress` consulta en paralelo `/api/playbackprogress/legacy` y las bibliotecas actuales de Series. Cada archivo muestra su nombre, raíz original, número de series, vistos y episodios en curso. Si encuentra una biblioteca con la misma raíz, la propone como destino.

`handleProgressLibraryChange` guarda la elección para ese archivo. El formulario permite seleccionar cualquier biblioteca de Series y muestra su carpeta para comprobar el destino. `handleMigrateProgress` envía `fileName` y `libraryId` a `/api/playbackprogress/legacy/migrate`. Al terminar, retira la tarjeta y muestra el resultado.

`legacyProgress` conserva las tarjetas; `progressLibraries` contiene los destinos y `hasSearchedProgress` indica si ya se ha buscado. `isProcessingProgress`, `progressError` y `progressMessage` presentan el estado de este apartado. La referencia `controllerRef` y `isBusy` coordinan ambas secciones y cancelan las peticiones al salir.

La migración conserva el archivo original, adapta la raíz de las rutas y exige un destino cuyo archivo de progreso todavía no exista.
