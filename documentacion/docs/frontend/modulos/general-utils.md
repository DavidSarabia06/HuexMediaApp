# generalUtils

[Frontend](../README.md) · [Código TypeScript](../../codigo/GeneralUtils.md)

`src/utils/generalUtils.ts` reúne la lectura de respuestas HTTP, la comparación de rutas y el formato de tiempos. Las páginas y los demás módulos importan estas funciones para compartir las mismas reglas.

Los bloques del archivo utilizan separadores de guiones con el título centrado: **Respuestas HTTP**, **Comparación de rutas** y **Formato de tiempos**.

## Respuestas HTTP

### readJson(response)

Recibe el objeto `Response` que devuelve `fetch` y retorna una promesa con el JSON leído.

1. Llama a `response.json()` para interpretar el cuerpo.
2. Si esa lectura falla, utiliza `null`.
3. Comprueba `response.ok` y que el contenido sea distinto de `null`.
4. Si hay un fallo, lanza `Error` con el primer mensaje disponible: `body.error`, `body.message` o `No se ha podido cargar la biblioteca.`.
5. En una respuesta correcta devuelve `body` para que la función que hizo la petición lo utilice.

Se utiliza normalmente con `.then(readJson)`:

```typescript
const library = await fetch(`/api/libraries/${libraryId}`, { signal })
    .then(readJson);
```

El error lanzado llega al `catch` de la operación que espera la petición. Así, las páginas pueden mostrarlo mediante su estado de error.

## Comparación de rutas

### normalizePathForComparison(path)

Recibe una ruta de texto y devuelve la clave utilizada para compararla con las rutas del escaneo o del JSON.

La cadena de operaciones aplica estas transformaciones:

- `replaceAll('/', '\\')`: unifica los separadores como barras invertidas.
- `replace(/\\+$/, '')`: retira las barras invertidas del final.
- `toUpperCase()`: unifica mayúsculas y minúsculas.

Por ejemplo, `F:/Series/Arcane/` y `f:\series\arcane` producen la misma clave: `F:\SERIES\ARCANE`.

Se utiliza al buscar entradas de progreso, comprobar asignaciones a categorías, localizar bibliotecas por su raíz y comparar episodios. También puede pasarse a `map` para preparar un conjunto de claves:

```typescript
const watchedPaths = new Set(
    progress.watchedEpisodePaths.map(normalizePathForComparison)
);
```

## Formato de tiempos

### formatProgressTime(seconds)

Recibe segundos del reproductor o del progreso y devuelve un texto para los relojes, etiquetas y diálogos de continuación.

1. `Number.isFinite` comprueba el valor. Para uno no finito utiliza cero.
2. `Math.max(0, seconds)` limita los negativos a cero y `Math.floor` descarta decimales.
3. Divide entre 3600 para obtener las horas completas.
4. Divide entre 60 y aplica `% 60` para obtener los minutos restantes.
5. `total % 60` obtiene los segundos; `padStart(2, '0')` los completa con dos cifras.
6. Cuando hay horas, devuelve `horas:minutos:segundos`; en el resto de casos, `minutos:segundos`.

| Entrada | Resultado |
| --- | --- |
| `0` | `0:00` |
| `75` | `1:15` |
| `75.9` | `1:15` |
| `3675` | `1:01:15` |
| `-5` | `0:00` |
| `NaN` o `Infinity` | `0:00` |

La función se utiliza desde `VideoPlayer`, los diálogos de Movies y SeriesDetail y las etiquetas de continuar viendo de `utils/playbackProgress.ts`.

## Mensajes de excepciones

`errorMessage(error: unknown): string` obtiene el mensaje de un `Error` capturado. Para otros valores lanzados utiliza su representación de texto. Los bloques `catch` del frontend utilizan esta función para presentar errores manteniendo el tipo estricto `unknown`.

`readJson<T>(response: Response): Promise<T>` permite indicar el modelo esperado de cada endpoint. Las utilidades de bibliotecas, categorías y progreso utilizan ese parámetro de tipo al leer sus respuestas.
