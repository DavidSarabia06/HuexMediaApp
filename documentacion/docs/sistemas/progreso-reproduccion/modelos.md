# Modelos de progreso

[Visión general](README.md) · [Código fuente](../../codigo/PlaybackProgress.md)

Las agrupaciones coinciden con las regiones del archivo de modelos.

## Configuración

### PlaybackProgressOptions

| Propiedad | Tipo | Contenido |
| --- | --- | --- |
| `WatchedThresholdPercent` | `double` | Porcentaje de finalización; valor inicial 95. |
| `RemainingSecondsToMarkWatched` | `double` | Margen final en segundos; valor inicial 120. |

Se vincula a la sección `PlaybackProgress` de `appsettings.json`. Basta con cumplir uno de los dos criterios para marcar un episodio como visto.

## Datos almacenados

### PlaybackProgressLibrary

| Propiedad | Tipo | Contenido |
| --- | --- | --- |
| `Version` | `int` | Versión de documento; valor inicial 1. |
| `LibraryPath` | `string` | Ruta de la biblioteca. |
| `Series` | `List<SeriesPlaybackProgress>` | Entradas de progreso por serie. |

### SeriesPlaybackProgress

| Propiedad | Tipo | Contenido |
| --- | --- | --- |
| `SeriesPath` | `string` | Ruta de la serie. |
| `WatchedEpisodePaths` | `List<string>` | Episodios vistos. |
| `InProgress` | `EpisodePlaybackProgress?` | Único episodio en curso o `null`. |
| `LastWatchedEpisodePath` | `string?` | Último episodio registrado como visto. |
| `LastRecordedAtUtc` | `DateTimeOffset` | Fecha que ordena muestras y cambios manuales. |

### EpisodePlaybackProgress

| Propiedad | Tipo | Contenido |
| --- | --- | --- |
| `EpisodePath` | `string` | Ruta del episodio en curso. |
| `PositionSeconds` | `double` | Posición global del episodio en segundos. |
| `DurationSeconds` | `double` | Duración completa en segundos. |

## Solicitudes de API

### SavePlaybackProgressRequest

| Propiedad | Tipo | Contenido |
| --- | --- | --- |
| `LibraryPath` | `string` | Biblioteca. |
| `SeriesPath` | `string` | Serie. |
| `EpisodePath` | `string` | Episodio. |
| `PositionSeconds` | `double` | Posición registrada. |
| `DurationSeconds` | `double` | Duración completa. |
| `RecordedAtUtc` | `DateTimeOffset` | Fecha UTC de la muestra. |

### ResetSeriesProgressRequest

Contiene `LibraryPath` y `SeriesPath`, ambos `string`, para identificar el historial que se quiere reiniciar.

### SetEpisodeWatchedRequest

Contiene `LibraryPath`, `SeriesPath` y `EpisodePath`, de tipo `string`, y `Watched`, de tipo `bool`. `true` marca el episodio y `false` lo deja pendiente.
