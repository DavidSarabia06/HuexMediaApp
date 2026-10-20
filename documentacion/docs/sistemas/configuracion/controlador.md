# ConfigurationController

[Sistema de configuración](README.md) · [Código del controlador](../../codigo/ConfigurationController.md) · [Modelo](modelos.md) · [Servicio](servicio.md)

## Responsabilidad

Expone las claves permitidas de configuración y traduce las operaciones del servicio a respuestas HTTP. La ruta base es `api/[controller]`, que corresponde a `/api/configuration`. `[ApiController]` habilita las convenciones de una API, incluida la validación automática de la solicitud antes de ejecutar la acción cuando corresponda.

## Índice de funciones

### Construcción

- [Constructor](#constructor)

### Operaciones HTTP

- [GetConfiguration](#getconfiguration)
- [UpdateConfiguration](#updateconfiguration)

### Ejecución y respuestas

- [Execute](#execute)

## Construcción

<a id="constructor"></a>
### Constructor

**Recibe:** `ConfigurationService configurationService` e `ILogger<ConfigurationController> logger`. Guarda las referencias para ejecutar las acciones y registrar los resultados. El servicio está registrado como singleton en `Program.cs`.

## Operaciones HTTP

<a id="getconfiguration"></a>
### GetConfiguration

**Ruta:** `GET /api/configuration/get?key=DownloadSeriesPosters`.

**Recibe:** `[FromQuery] string key`. **Devuelve:** `IActionResult`.

Llama directamente a [Execute](#execute) con `isUpdate: false`. Dentro de esa ejecución obtiene el valor con [Get de T](servicio.md#get), usando `JsonNode` como tipo de retorno. El servicio comprueba la clave vacía y las claves permitidas; el controlador traduce su rechazo a HTTP 400.

**Respuesta correcta:** HTTP 200 con la clave y el valor manteniendo su tipo JSON.

```json
{
  "key": "DownloadSeriesPosters",
  "value": true
}
```

<a id="updateconfiguration"></a>
### UpdateConfiguration

**Ruta:** `POST /api/configuration/update`.

**Recibe:** `[FromBody] ConfigurationRequest request`. **Devuelve:** `IActionResult`.

Llama directamente a [Execute](#execute) con `isUpdate: true`, ejecuta [Update](servicio.md#update), registra el éxito y construye la respuesta. El servicio comprueba todas las reglas de clave y valor, incluida la clave vacía y el valor nulo.

**Respuesta correcta:** HTTP 200 con el valor confirmado tras guardar.

```json
{
  "success": true,
  "key": "DownloadSeriesPosters",
  "value": false
}
```

El cliente envía `key` y `value`; `success` pertenece solo a la respuesta. Un cuerpo mal formado puede ser rechazado por ASP.NET Core antes de entrar en el método, con un formato de error distinto al definido aquí.

## Ejecución y respuestas

<a id="execute"></a>
### Execute

**Recibe:** `Func<IActionResult> operation`, `string key` y `bool isUpdate`. **Devuelve:** el resultado de la acción o una respuesta de error.

`operation` es una función que todavía no se ha ejecutado. `Execute` la invoca dentro del `try`, de modo que captura los fallos del servicio y de la construcción de la respuesta. Cada acción conserva su cuerpo de éxito específico; la gestión de excepciones se comparte.

El indicador `isUpdate` selecciona los mensajes de clave ausente y error general de cada ruta. Se llama `Execute` porque las operaciones del servicio son síncronas.

| Situación | Consulta | Actualización |
| --- | --- | --- |
| Operación correcta | 200 con `key` y `value` | 200 con `success`, `key` y `value` |
| Clave vacía o no válida | 400 desde `Execute` tras validación del servicio | 400 desde `Execute` tras validación del servicio |
| Valor nulo | — | 400 desde `Execute` tras validación del servicio |
| Clave no permitida | 400 desde `Execute`, tras validarla el servicio | 400 desde `Execute`, tras validarla el servicio |
| `KeyNotFoundException` | 404 con mensaje de configuración no encontrada | 404 con mensaje de configuración inexistente |
| `ArgumentException` | 400 con el mensaje de la excepción | 400 con el mensaje de la excepción |
| Otro error de lectura, estructura o escritura | 500 con mensaje general de consulta | 500 con mensaje general de actualización |

Las respuestas de error de este controlador tienen una propiedad `error`. `Execute` registra una advertencia para una clave que falta y para una clave o un valor no válido. Los errores no previstos se registran con su excepción completa, pero al cliente se le devuelve un mensaje general.

`catch (ArgumentException ex)` se aplica a ambas operaciones para traducir la validación del servicio a HTTP 400. El servicio centraliza la lista de claves permitidas.

La estructura del cuerpo HTTP sigue siendo responsabilidad del enlazado de modelos de ASP.NET Core: `[ApiController]` puede rechazar un cuerpo ausente, nulo o un JSON mal formado antes de ejecutar la acción. Esto es distinto de recibir un objeto válido con `Key` vacía o `Value` nulo, que se valida en el servicio.

## Archivo ausente y errores de formato

Una clave permitida que no esté en una sección válida produce 404 mediante `KeyNotFoundException`. Un archivo `appsettings.json` ausente, un JSON dañado o una sección con estructura incompatible provoca un fallo general y produce 500. El controlador devuelve el error correspondiente.

## Comprobaciones

Se ha comprobado la compilación y se han ejecutado pruebas con un archivo independiente de configuración. Cubren lectura tipada, respuestas de consulta y actualización, rechazo de claves o tipos no permitidos, carpeta inexistente, claves ausentes, conservación de otras secciones y errores de formato, ausencia del archivo y escritura.

Las pruebas ejecutan llamadas directas al controlador y al servicio.
