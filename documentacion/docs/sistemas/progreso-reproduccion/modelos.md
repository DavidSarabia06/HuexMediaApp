# Modelos de progreso

[Sistema](README.md) · [Documento común](../../codigo/PlaybackProgress.md)

Los modelos se encuentran en `Models/PlaybackProgress`.

## LibraryPlaybackProgress

Documento de versión 2 con `LibraryId`, `Series` y `Movies`. El identificador asocia el archivo a una biblioteca guardada.

## SeriesPlaybackProgress

| Propiedad | Uso |
| --- | --- |
| `SeriesPath` | Carpeta de la serie. |
| `WatchedEpisodePaths` | Episodios vistos. |
| `InProgress` | Único `EpisodePlaybackProgress` en curso. |
| `LastWatchedEpisodePath` | Último visto, utilizado para ofrecer el siguiente. |
| `LastRecordedAtUtc` | Fecha del último cambio aceptado. |
| `HiddenFromContinueWatching` | Oculta la tarjeta conservando el progreso. |

`EpisodePlaybackProgress` contiene `EpisodePath`, `PositionSeconds` y `DurationSeconds`.

## MoviePlaybackProgress

Contiene `MoviePath`, `PositionSeconds`, `DurationSeconds`, `Watched`, `LastRecordedAtUtc` y `HiddenFromContinueWatching`. Cada película conserva su propia entrada.

## Solicitudes

`SavePlaybackProgressRequest` envía `VideoPath`, `SeriesPath` opcional, `PositionSeconds`, `DurationSeconds` y `RecordedAtUtc`.

`SetPlaybackWatchedRequest` envía `VideoPath`, `SeriesPath` opcional y `Watched`. `ResetSeriesProgressRequest` contiene `SeriesPath`. `HideContinueWatchingRequest` contiene `VideoPath`.

La biblioteca se identifica mediante el parámetro `libraryId` de la URL.

## PlaybackProgressOptions

`WatchedThresholdPercent` tiene valor inicial 95 y `RemainingSecondsToMarkWatched`, 120. Se enlazan a la sección `PlaybackProgress` de `appsettings.json`. Alcanza con cumplir uno de los dos criterios para considerar visto el vídeo.

## Modelos de migración manual

Los modelos de `Models/PlaybackProgress/Legacy` pertenecen al apartado de Ajustes:

- `LegacyPlaybackProgressDocument`: `Version`, `LibraryPath` y la lista `Series` del archivo de versión 1.
- `LegacyPlaybackProgressSummary`: `FileName`, `LibraryPath`, `SeriesCount`, `WatchedEpisodeCount` e `InProgressCount`, utilizados para presentar cada archivo encontrado.
- `MigratePlaybackProgressRequest`: `FileName` del original y `LibraryId` del destino elegido.
