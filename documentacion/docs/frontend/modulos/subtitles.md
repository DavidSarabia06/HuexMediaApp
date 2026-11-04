# subtitles

[Frontend](../README.md) · [VideoPlayer](../paginas/video-player.md) · [Código TypeScript](../../codigo/Subtitles.md)

`src/utils/subtitles.ts` interpreta el WebVTT devuelto por el servidor, obtiene el texto correspondiente a un instante y prepara las etiquetas de las pistas de audio y subtítulos del reproductor.

## Organización

| Bloque | Funciones | Responsabilidad |
| --- | --- | --- |
| Tipos de subtítulos | `SubtitleCue`, `MediaTrack` | Describir las intervenciones y pistas para los parámetros y resultados. |
| Conversión de tiempos | `timestamp` | Convertir marcas temporales a segundos. |
| Lectura de subtítulos | `parseSubtitles`, `parseBlock` | Construir las intervenciones de texto. |
| Texto activo en pantalla | `subtitleAt` | Seleccionar las intervenciones activas. |
| Etiquetas de pistas | `trackLabel` | Presentar número, idioma y datos de cada pista. |

Los separadores de guiones utilizan el título centrado. Los comentarios existentes se conservan y cada función, incluida la interna `parseBlock`, tiene parámetros y retorno tipados en su firma TypeScript.

## Tipos de subtítulos

### SubtitleCue

Representa una intervención con `start` y `end`, números en segundos, y `text`, el texto plano. `parseSubtitles` produce `SubtitleCue[]` y `subtitleAt` recibe esa misma lista.

### MediaTrack

Describe una pista recibida del servidor con `index`, `language`, `title`, `codec`, `isDefault`, `isForced` e `isSupported`. `trackLabel` utiliza su idioma, título y marca de forzados junto con la posición que recibe como segundo parámetro.

## Parámetros y retornos

| Función | Entradas | Resultado |
| --- | --- | --- |
| `timestamp` | `value: string`, marca temporal. | `number`, con `NaN` para una marca no admitida. |
| `parseSubtitles` | `vtt: string`, archivo WebVTT completo. | `SubtitleCue[]`, intervenciones válidas. |
| `parseBlock` | `block: string`, bloque del archivo. | `SubtitleCue[]`, con una intervención o vacío. |
| `subtitleAt` | `cues: SubtitleCue[]` y `time: number`, tiempo en segundos. | `string`, texto activo o cadena vacía. |
| `trackLabel` | `track: MediaTrack` y `position: number`, índice del selector desde cero. | `string`, etiqueta visible de la pista. |

## timestamp(value)

Función interna que separa una marca temporal por `:` y convierte cada parte con `Number`. Acepta dos o tres partes numéricas finitas. Si la cantidad de partes o su conversión resulta inválida, devuelve `NaN`.

Acumula las partes multiplicando por 60: `01:02:03.500` se convierte en `3723.5` segundos y `02:03.500` en `123.5`.

## parseSubtitles(vtt)

Recibe el texto WebVTT, elimina la marca Unicode inicial si existe, normaliza los saltos de línea retirando `\r` y separa el contenido en bloques mediante líneas vacías.

Aplica `parseBlock` a cada bloque con `flatMap`, que reúne las intervenciones válidas en una lista de objetos:

```js
{ start: 12.5, end: 15, text: 'Hola.\n¿Cómo estás?' }
```

`start` y `end` se expresan en segundos. `text` conserva los saltos de línea de la intervención.

### parseBlock(block)

Es una función interna de `parseSubtitles`:

1. Recorta los extremos del bloque y separa sus líneas.
2. Descarta los bloques que comienzan por `WEBVTT`, `NOTE`, `STYLE` o `REGION`.
3. Localiza la línea que contiene ` --> ` y extrae las dos marcas temporales. Esto permite que haya un identificador antes del intervalo.
4. Convierte ambas marcas con `timestamp`. Descarta tiempos no finitos e intervalos cuyo fin sea menor o igual al inicio.
5. Reúne las líneas posteriores al intervalo, elimina las etiquetas entre `<` y `>` y convierte las entidades `amp`, `lt`, `gt`, `quot`, `apos` y `nbsp` en sus caracteres.
6. Devuelve una lista con la intervención válida o una lista vacía para un bloque descartado.

## subtitleAt(cues, time)

Recibe la lista de intervenciones y el tiempo actual en segundos. Selecciona las que cumplen `time >= start && time < end` y une sus textos con saltos de línea.

La intervención aparece al alcanzar su inicio y deja de aparecer al alcanzar su fin. Si varios intervalos coinciden, se muestran juntos en el orden de la lista. Cuando termina sin coincidencias, devuelve una cadena vacía.

Por ejemplo, una intervención con inicio `12.5` y fin `15` aparece en `12.5` y `14.9`; al llegar a `15`, el resultado depende de las siguientes intervenciones.

## trackLabel(track, position)

Recibe una pista y su posición, empezando en cero. Construye una etiqueta con estos datos:

| Dato | Presentación |
| --- | --- |
| `position` | Número visible de pista, sumando uno. |
| `track.language` | Nombre español del idioma reconocido, código original para otros idiomas o «Sin idioma» para `und`. |
| `track.title` | Título opcional, precedido de `·`. |
| `track.isForced` | Añade «· Forzados» cuando es verdadero. |

El diccionario reconoce códigos de español, inglés, francés, alemán, italiano, portugués, japonés, catalán, euskera y gallego.

Por ejemplo, una pista con idioma `spa`, título `Castellano`, marca de forzados y posición `0` produce `1. Español · Castellano · Forzados`.

## Integración con el reproductor

`VideoPlayer` descarga el WebVTT desde `/api/video/subtitles`, lo convierte con `parseSubtitles` y consulta `subtitleAt` con el tiempo del episodio para obtener el texto visible. `trackLabel` prepara las opciones de los selectores de audio y subtítulos.

La relación entre el tiempo del episodio y el de la sesión HLS se explica en [Sincronización de tiempos](../../sistemas/reproduccion-video/sincronizacion.md). El recorrido de carga está documentado en [Cargar y mostrar subtítulos](../../sistemas/reproduccion-video/eventos/subtitulos.md).

MkDocs genera el código de referencia desde `subtitles.ts` y observa el archivo durante la consulta local para reflejar sus cambios.
