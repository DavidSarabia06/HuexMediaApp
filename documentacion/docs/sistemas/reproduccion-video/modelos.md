# Modelos de reproducción

[Visión general](README.md) · [Código de VideoInfo](../../codigo/VideoInfo.md) · [Código de PlaybackSession](../../codigo/PlaybackSession.md)

## VideoInfo

Resultado del análisis del archivo original mediante FFprobe.

### Datos del vídeo

| Propiedad | Tipo | Contenido |
| --- | --- | --- |
| `VideoCodec` | `string` | Códec de la primera pista de vídeo. |
| `AudioCodec` | `string` | Códec de la primera pista de audio. |
| `Duration` | `double` | Duración en segundos. |
| `Width` | `int` | Anchura en píxeles. |
| `Height` | `int` | Altura en píxeles. |
| `RequiresTranscoding` | `bool` | Indica que la combinación detectada difiere de H.264 y AAC. |

### Pistas disponibles

`AudioTracks` y `SubtitleTracks` son listas de `MediaTrack` inicializadas vacías. El servicio las rellena con las pistas que devuelve FFprobe.

## MediaTrack

Describe una pista de audio o subtítulos.

### Identificación y formato

| Propiedad | Tipo | Contenido |
| --- | --- | --- |
| `Index` | `int` | Índice absoluto del stream, utilizado con `-map 0:Index`. |
| `Language` | `string` | Idioma; valor inicial `und`. |
| `Title` | `string` | Título declarado por el archivo. |
| `Codec` | `string` | Códec de la pista. |

### Selección y compatibilidad

| Propiedad | Tipo | Contenido |
| --- | --- | --- |
| `IsDefault` | `bool` | Marca de pista predeterminada. |
| `IsForced` | `bool` | Marca de pista forzada. |
| `IsSupported` | `bool` | Audio seleccionable o subtítulos de texto extraíbles. |

## PlaybackSession

### Identificación y tiempos

| Propiedad | Tipo | Contenido |
| --- | --- | --- |
| `SessionId` | `string` | GUID de 32 caracteres sin separadores. |
| `StartSeconds` | `double` | Posición solicitada en el episodio. |
| `TimelineStartSeconds` | `double` | Inicio del primer segmento, descontado el margen y ajustado a un mínimo de cero. |
| `TransportTimestampOffsetSeconds` | `double` | Margen añadido al transporte HLS. |

El controlador utiliza estos datos para construir la respuesta de inicio y añadir `playlistUrl`.

## HlsMediaFile

Descriptor que el servicio entrega al controlador para servir un archivo local.

| Propiedad | Tipo | Contenido |
| --- | --- | --- |
| `FullPath` | `string` | Ruta completa del manifiesto o segmento existente. |
| `ContentType` | `string` | Tipo MIME correspondiente. |
