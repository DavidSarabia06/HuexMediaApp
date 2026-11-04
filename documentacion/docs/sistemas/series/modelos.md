# Modelos de exploración de series

[Sistema Series](README.md) · [Código de los modelos](../../codigo/MediaItem.md)

Los modelos de `MediaItem.cs` representan resultados de exploración, selección e imágenes. ASP.NET Core serializa las propiedades de respuesta con los mismos nombres camelCase que utiliza React.

## Exploración de la biblioteca

### MediaItem

Representa una tarjeta de serie o episodio.

| Propiedad | Tipo | Valor inicial | Uso |
| --- | --- | --- | --- |
| `Nombre` | `string` | Cadena vacía | Nombre de la carpeta o del vídeo sin extensión. JSON: `nombre`. |
| `RutaCompleta` | `string` | Cadena vacía | Ruta devuelta por la exploración. JSON: `rutaCompleta`. |
| `UrlImagen` | `string` | Cadena vacía | Imagen predeterminada o URL generada por el controlador. JSON: `urlImagen`. |
| `ImagePath` | `string?` | `null` | Ruta interna de la imagen local encontrada. `[JsonIgnore]` la reserva para uso interno. |

El servicio asigna la imagen predeterminada y, si encuentra una local, su `ImagePath`. Después el controlador completa `UrlImagen`. El modelo se utiliza tanto en la lista de series como en los episodios de cada temporada.

### SeriesSeason

| Propiedad | Tipo | Valor inicial | Uso |
| --- | --- | --- | --- |
| `NombreTemporada` | `string` | Cadena vacía | Nombre del grupo. JSON: `nombreTemporada`. |
| `Episodios` | `List<MediaItem>` | Lista vacía | Episodios ordenados por nombre. JSON: `episodios`. |

### SeriesEpisodesResponse

Contiene `List<SeriesSeason> Temporadas`, inicializada vacía. La respuesta mantiene el objeto raíz `{ "temporadas": [...] }`; una serie sin vídeos devuelve una lista de temporadas vacía.

## Selección de carpeta

### FolderSelection

Contiene `string Ruta`, inicialmente vacía. El selector asigna la carpeta elegida. Cancelar produce HTTP 200 con `{ "ruta": "" }`.

## Imágenes locales

### ImageFile

Contiene `string FullPath` y `string ContentType`, inicialmente vacías. Es un descriptor interno de una imagen validada. El controlador usa esos datos para crear `PhysicalFileResult` y enviar el archivo.

`SeriesService.GetImageAsync` devuelve este descriptor si la imagen está permitida y existe, o `null` si falta el archivo.
