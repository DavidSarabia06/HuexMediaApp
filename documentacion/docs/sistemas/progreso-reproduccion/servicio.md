# PlaybackProgressService

[Sistema](README.md) · [Código fuente](../../codigo/PlaybackProgressService.md)

Recibe `AppStoragePaths`, `LibraryService`, `JsonFileStoreService` e `IOptionsMonitor<PlaybackProgressOptions>`. El servicio obtiene la biblioteca mediante su identificador y conserva el progreso de Series y Películas en el mismo formato.

## Consulta y guardado de muestras

`GetAsync(libraryId, token)` carga el documento común mediante `LoadAsync`. Si falta, prepara uno vacío en memoria. El archivo se crea al guardar progreso o al confirmar una migración desde Ajustes.

`SaveAsync` valida la posición, duración y fecha, toma los márgenes activos y ejecuta el cambio mediante `ExecuteAsync`. `ValidateVideo` comprueba que el vídeo exista, tenga una extensión admitida y pertenezca a la biblioteca. En Series exige también una carpeta de serie hija directa y un episodio dentro de ella.

Una muestra con posición cero conserva el dato anterior. Las muestras con fecha anterior o igual a la última aceptada se descartan.

```csharp
bool watched = request.PositionSeconds / request.DurationSeconds * 100 >= settings.WatchedThresholdPercent ||
    request.DurationSeconds - request.PositionSeconds <= settings.RemainingSecondsToMarkWatched;
```

Con duración 2000 y posición 1880 quedan 120 segundos: se marca como visto aunque el porcentaje sea 94 %. Con duración 10000 y posición 9500 se alcanza el 95 % aunque queden 500 segundos.

`SaveSeriesSample` conserva los vistos y solo el último episodio pendiente de cada serie. Si el vídeo cumple los márgenes, lo incorpora a los vistos y actualiza el último visto. Si está pendiente y aún no estaba visto, guarda su posición en `InProgress`. Una nueva muestra aceptada desactiva la ocultación de la tarjeta.

`SaveMovieSample` conserva una entrada por película. Actualiza posición y duración y mantiene la marca de visto cuando ya estaba activa. Una nueva muestra aceptada vuelve a mostrar la película en continuar viendo cuando cumple el filtro del cliente.

## Marcas manuales y reinicio

`SetWatchedAsync` añade o retira el episodio de los vistos. Actualiza el último visto y vacía `InProgress` cuando corresponde al episodio elegido. En películas cambia `Watched` y pone la posición en cero. `LatestDate` conserva la mayor fecha entre la actual y la anterior para proteger la decisión frente a muestras atrasadas.

`ResetAsync` exige una biblioteca de Series y una carpeta válida. Vacía los vistos, el episodio en curso y el último visto; restablece la visibilidad y actualiza la fecha. Las otras series se conservan.

## Visibilidad de continuar viendo

`HideSeriesAsync` y `HideMovieAsync` buscan la entrada y activan `HiddenFromContinueWatching`. Conservan la posición y las marcas de visto. Una entrada sin progreso produce `KeyNotFoundException`.

## Coordinación y almacenamiento

`ExecuteAsync` obtiene la biblioteca y adquiere `_gate`. Dentro del bloqueo carga y valida el progreso. Las consultas llaman a `CleanupMissingProgress`; las operaciones de guardado aplican su delegado. Cuando hay cambios, valida el documento y lo escribe. El bloqueo se libera en `finally`.

`GetFilePath` utiliza `Progress-{LibraryId:N}.json`, dentro de `App_Data/PlaybackProgress`. `JsonFileStoreService` lee y publica el JSON mediante su temporal, vaciado de datos y sustitución del archivo.

## Migración manual del progreso antiguo

`GetLegacyProgressAsync` recorre los JSON de `App_Data/PlaybackProgress`. Selecciona los documentos de versión 1, valida sus datos y devuelve nombre de archivo, raíz original y contadores de series, episodios vistos y episodios en curso. La búsqueda conserva los archivos.

`MigrateLegacyProgressAsync(fileName, libraryId, token)` recibe el archivo elegido y una biblioteca de Series ya registrada. Comprueba el nombre del archivo y obtiene el destino desde la biblioteca. Dentro del mismo semáforo que coordina los guardados, comprueba que el destino esté disponible y vuelve a leer y validar el original.

`ValidateLegacyDocument` comprueba la versión y la raíz original y reutiliza `ValidateLibraryData` para revisar las rutas, fechas y estados de cada serie. Después `RebasePath` sustituye la raíz utilizando `Path.GetRelativePath` y `Path.Combine`: conserva las carpetas de series, temporadas y nombres de episodios aunque cambie la unidad del ordenador.

Se adaptan `SeriesPath`, los episodios vistos, el último visto y el episodio en curso. La posición, duración, fechas y marcas se conservan. El resultado se valida con la biblioteca de destino y se escribe mediante `JsonFileStoreService`. El archivo original permanece intacto. Si ya existe un documento de progreso en el destino, la operación devuelve el motivo y lo conserva.

## Validación

`NormalizePath` exige una ruta absoluta y elimina el separador final. `Same` compara rutas sin distinguir mayúsculas; `IsDescendant` comprueba la pertenencia a una carpeta.

`ValidateTimes` exige números finitos, posición no negativa, duración positiva y posición menor o igual a la duración. `ValidateRecordedAt` rechaza fechas vacías o adelantadas más de un minuto respecto al servidor.

`ValidateLibraryData` comprueba la versión, el identificador de biblioteca, el tipo de contenido, las listas, las rutas, los duplicados, las fechas y la coherencia del progreso. Los errores de documento se convierten en `InvalidDataException` y el archivo se conserva.

## Limpieza de referencias al consultar progreso

`GetAsync` ejecuta `CleanupMissingProgress` antes de devolver los datos. [`LibraryContentSnapshot.TryRead`](../categorias/contenido-biblioteca.md) enumera las carpetas de Series y los vídeos disponibles en toda la raíz. El resultado completo permite distinguir las referencias ausentes de un recorrido que ha fallado.

La limpieza retira las películas cuyo archivo falta y las entradas de Series cuya carpeta ya no está. En las series que siguen disponibles, elimina los episodios vistos ausentes y vacía `InProgress` cuando falta su vídeo. Si falta el último visto, utiliza la última ruta de vistos que queda o `null`.

Los estados y minutos de los archivos presentes se conservan. La operación guarda el documento únicamente cuando hubo cambios y utiliza el mismo semáforo que las muestras del reproductor. Si la raíz está desconectada o el recorrido falla por permisos o acceso al disco, conserva el JSON.

Un archivo renombrado pasa a ser una ruta distinta: la referencia anterior se retira cuando se comprueba su ausencia. La limpieza utiliza los documentos comunes; la conversión del formato antiguo sigue siendo una acción manual desde Ajustes.
