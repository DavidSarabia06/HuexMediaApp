# Modelo de configuración

[Sistema de configuración](README.md) · [Código del modelo](../../codigo/ConfigurationRequest.md)

## ConfigurationRequest

Es el cuerpo de `POST /api/configuration/update`. Transporta el nombre del ajuste y su nuevo valor.

| Propiedad | Tipo | Valor inicial | Significado |
| --- | --- | --- | --- |
| `Key` | `string` | `string.Empty` | Nombre exacto de una clave permitida por el servicio. |
| `Value` | `JsonNode?` | `null` | Valor JSON recibido conservando su tipo. |

`JsonNode` permite representar texto, booleanos, números, objetos o listas. El servicio acepta cada valor según el tipo del dato que ya está almacenado. Actualmente las claves expuestas son una cadena y dos booleanos.

Si se omite `Value` o se envía `null`, el servicio rechaza la actualización y `Execute` convierte el error en HTTP 400. El servicio valida los valores recibidos antes de actualizar la configuración.

## Ejemplos

Actualizar una opción booleana:

```json
{
  "key": "DownloadSeriesPosters",
  "value": false
}
```

Cambiar la biblioteca:

```json
{
  "key": "SeriesLibraryPath",
  "value": "F:\\Series"
}
```

La carpeta del ejemplo debe existir. Enviar `"false"` entre comillas para una clave booleana no equivale a `false`: su tipo es texto y se rechaza.

## Relaciones

[UpdateConfiguration](controlador.md#updateconfiguration) pasa `Key` y `Value` a [Update](servicio.md#update). El servicio comprueba la clave no vacía y permitida, el valor no nulo, su existencia en el archivo, la compatibilidad de tipo y la carpeta de series.

El controlador construye respuestas con `key` y `value`, añadiendo `success` al actualizar.
