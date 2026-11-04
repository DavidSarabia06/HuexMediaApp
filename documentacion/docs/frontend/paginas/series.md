# Series

[Frontend](../README.md) · [Código TSX](../../codigo/SeriesPage.md) · [SeriesCategoryRow](../componentes/series-category-row.md)

`Series.tsx` utiliza los mismos hooks de bibliotecas y categorías que Movies. Conserva el dibujado de los paneles y diálogos, la navegación, el progreso y el reinicio de series.

## Bibliotecas

[useLibraries](../hooks/use-libraries.md) consulta el listado de Series y recupera la biblioteca recordada o la única disponible. Gestiona selección de carpeta, creación, selección, eliminación y renombrado con los mismos estados y acciones que Movies.

El hook consulta contenido y progreso en paralelo. Entrega los resultados a `applyLoadedLibrary(result, progress, signal)` y espera a que termine. Este callback prepara `continuingEpisodes` mediante `buildContinueWatchingSeries` y después actualiza las series compartidas y su progreso, siempre que la señal siga vigente. El hook conserva y recuerda la selección cuando finaliza la preparación.

`resetSeriesLibrary` limpia la lista compartida, el progreso, los episodios de continuación y los avisos de ocultación y reinicio. Ambos callbacks utilizan `useCallback` para mantener sus referencias estables.

El selector y sus diálogos se dibujan en Series con los datos, referencias y acciones del hook. `activeControllerRef` comparte el bloqueo y cancelación con las operaciones de categorías, ocultación y reinicio. Al salir, el hook cancela la operación activa.

## Categorías y subcategorías

[useCategories](../hooks/use-categories.md) recibe `libraryManager`, `seriesList` y el prefijo `series-group`. Obtiene las categorías de la biblioteca seleccionada y calcula los destinos del menú y las series sin categoría.

- El panel **NUEVA CATEGORÍA** abre el formulario de creación principal.
- El botón **+** abre el mismo formulario con el grupo padre.
- El doble clic o F2 sobre un título abre el renombrado.
- Las flechas ordenan grupos del mismo nivel; el hook recupera el foco y centra el panel movido.
- La papelera solicita confirmación para eliminar la rama. Sus series quedan sin categoría.
- El menú de una tarjeta o el arrastre cambia su asignación mediante `handleMoveItem`, recibido en Series como `handleMoveSeries`.

`renderGroups(group, depth, groupIndex, groupCount)` conserva el dibujado recursivo del título, contador, controles, series directas e hijos. `countCategoryItems` cuenta los elementos disponibles de toda la rama. `densityStyle` aplica el tamaño de carátulas elegido en la cabecera.

## Navegación

`openSeries(serie)` abre `/series/episodes` y envía `folderPath`, `seriesName` y `libraryId`. [SeriesDetail](series-detail.md) utiliza el identificador para cargar temporadas y progreso.

`continueEpisode(episode)` abre `/player` con `mediaType: 'Series'`, la biblioteca, la ruta de la serie y el minuto guardado. Cuando la tarjeta representa el siguiente episodio, empieza en cero.

## Continuar viendo

`buildContinueWatchingSeries` prepara una tarjeta por serie, ordenada por su última reproducción. Ofrece el episodio en curso o el siguiente pendiente después del último visto. La función consulta los episodios dentro de la biblioteca seleccionada.

`handleHideSeries` guarda `hiddenFromContinueWatching` y retira la tarjeta conservando vistos y minuto. Una nueva muestra de reproducción aceptada vuelve a mostrar la serie.

## Reiniciar serie

El menú de cada tarjeta normal incluye **Reiniciar serie**. `requestResetSeries` abre la confirmación; `handleResetSeries` espera los guardados pendientes y llama a `resetSeriesProgress(libraryId, seriesPath, signal)`.

El servidor vacía los episodios vistos, el episodio en curso y el último visto. La página aplica el progreso devuelto y retira la tarjeta de continuación. Las categorías y los archivos de vídeo se conservan.

## Limpieza de los archivos guardados

Las consultas de bibliotecas limpian las asignaciones de categorías cuyos elementos ya no existen. La consulta de progreso limpia las referencias ausentes antes de preparar las tarjetas. Estas operaciones se realizan en el servidor y publican el JSON solo si hay cambios.

Los grupos vacíos y el progreso de los archivos disponibles se conservan. Si la raíz no está accesible o falla el recorrido del disco, se mantienen las referencias guardadas.
