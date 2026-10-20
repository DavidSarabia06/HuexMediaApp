# SeriesCategoriesController

[Sistema de categorías](README.md) · [Código del controlador](../../codigo/SeriesCategoriesController.md) · [Servicio](servicio.md) · [Modelos](modelos.md)

## Responsabilidad

Recibe solicitudes HTTP para consultar, crear, mover y eliminar categorías. Obtiene los datos de la URL o del cuerpo JSON, llama a `SeriesCategoryService` y convierte sus resultados o errores esperados en respuestas HTTP.

Todas sus operaciones correctas devuelven **HTTP 200 y la lista completa de categorías** de la biblioteca, incluida la eliminación. La interfaz sustituye su lista por el resultado confirmado del servidor.

## Índice de funciones

### Construcción

- [Constructor](#constructor)

### Operaciones HTTP

- [Get](#get)
- [Create](#create)
- [Move](#move)
- [Delete](#delete)

### Ejecución y respuestas

- [ExecuteAsync](#executeasync)

## Atributos del controlador

`[Route("api/seriescategories")]` establece la ruta base. Los atributos de cada acción indican el verbo HTTP y, si corresponde, el sufijo de su URL.

`[ApiController]` habilita las convenciones de los controladores de API. Un cuerpo JSON mal formado o un error de validación del modelo puede producir una respuesta automática de ASP.NET Core antes de entrar en la acción. El framework construye esas respuestas con su formato de validación.

## Construcción

<a id="constructor"></a>
### Constructor

**Recibe:** `SeriesCategoryService service` e `ILogger<SeriesCategoriesController> logger`, suministrados mediante inyección de dependencias.

**Resultado:** guarda ambas dependencias en `_service` y `_logger`. El controlador utiliza la instancia del servicio registrada como singleton en `Program.cs`.

## Operaciones HTTP

| Acción | Solicitud | Origen de los datos | Método del servicio |
| --- | --- | --- | --- |
| [Get](#get) | `GET /api/seriescategories` | `libraryPath` en la consulta | `GetAsync` |
| [Create](#create) | `POST /api/seriescategories` | Cuerpo JSON | `CreateAsync` |
| [Move](#move) | `POST /api/seriescategories/move` | Cuerpo JSON | `MoveAsync` |
| [Delete](#delete) | `DELETE /api/seriescategories/{categoryId}` | Identificador en la ruta y biblioteca en la consulta | `DeleteAsync` |

Cada acción recibe también un `CancellationToken` que ASP.NET Core vincula a la cancelación de la solicitud y que se pasa al servicio.

<a id="get"></a>
### Get

**Recibe:** `[FromQuery] string libraryPath` y `CancellationToken cancellationToken`.

**Devuelve:** `Task<IActionResult>`. En caso correcto, el resultado es HTTP 200 con `List<SeriesCategory>` serializada como un array JSON.

**Recorrido:** `Get` → [ExecuteAsync](#executeasync) → [GetAsync](servicio.md#getasync) → respuesta.

Si falta el archivo de categorías de una biblioteca existente, devuelve `[]`.

```http
GET /api/seriescategories?libraryPath=F%3A%5CSeries
```

<a id="create"></a>
### Create

**Recibe:** `[FromBody] CreateSeriesCategoryRequest request` y el token de cancelación. El modelo se explica en [CreateSeriesCategoryRequest](modelos.md#createseriescategoryrequest).

**Devuelve:** HTTP 200 con todas las categorías, incluida la nueva, si se guarda correctamente.

**Recorrido:** `Create` → [ExecuteAsync](#executeasync) → [CreateAsync](servicio.md#createasync), pasando `request.LibraryPath` y `request.Name`.

El servicio recorta el nombre, valida su longitud, el nombre reservado y los duplicados, y genera el GUID de la nueva categoría.

```json
{
  "libraryPath": "F:\\Series",
  "name": "Comedia"
}
```

<a id="move"></a>
### Move

**Recibe:** `[FromBody] MoveSeriesCategoryRequest request` y el token de cancelación. Véase [MoveSeriesCategoryRequest](modelos.md#moveseriescategoryrequest).

**Devuelve:** HTTP 200 con las categorías y sus asignaciones actualizadas.

**Recorrido:** `Move` → [ExecuteAsync](#executeasync) → [MoveAsync](servicio.md#moveasync), pasando biblioteca, ruta de la serie e identificador de destino.

El destino `null` deja la serie sin categoría. Un GUID no vacío debe identificar una categoría existente de esa biblioteca. La operación actualiza las asignaciones del JSON de organización.

```json
{
  "libraryPath": "F:\\Series",
  "seriesPath": "F:\\Series\\Serie de ejemplo",
  "categoryId": null
}
```

<a id="delete"></a>
### Delete

**Recibe:** `Guid categoryId` desde la ruta, `[FromQuery] string libraryPath` y el token de cancelación.

**Devuelve:** HTTP 200 con las categorías restantes. Sus series quedan sin asignación y el cliente las muestra en «Sin categoría».

**Recorrido:** `Delete` → [ExecuteAsync](#executeasync) → [DeleteAsync](servicio.md#deleteasync).

La restricción `{categoryId:guid}` exige que el segmento de URL tenga formato GUID para seleccionar esta ruta. Una cadena con formato inválido normalmente no coincide con el endpoint y devuelve 404. Un GUID con formato válido pero vacío o inexistente llega al servicio y se rechaza con 400.

```http
DELETE /api/seriescategories/4b9e61d8-dc11-4a72-b061-77690884fd34?libraryPath=F%3A%5CSeries
```

## Ejecución y respuestas

<a id="executeasync"></a>
### ExecuteAsync

**Recibe:** `Func<Task<List<SeriesCategory>>> operation`, una función sin parámetros que, al ejecutarse, devuelve una tarea con la lista de categorías.

**Devuelve:** `Task<IActionResult>` con el resultado HTTP de la operación.

Las acciones le pasan una función como `() => _service.GetAsync(libraryPath, cancellationToken)`. Esa función se prepara al llamar a `ExecuteAsync`, pero la llamada al servicio ocurre cuando este método ejecuta `operation()` dentro del `try`. Así puede capturar tanto errores inmediatos como errores de la tarea al esperarla con `await`.

```csharp
try
{
    List<SeriesCategory> categories = await operation();
    return Ok(categories);
}
```

**La llaman:** [Get](#get), [Create](#create), [Move](#move) y [Delete](#delete).

### Respuestas y registro de errores

| Resultado o excepción | Respuesta | Registro |
| --- | --- | --- |
| Operación correcta | 200 con el array de categorías | — |
| `ArgumentException` | 400 con `{ "error": ex.Message }` | — |
| `InvalidDataException` | 500 con `{ "error": ex.Message }` | Registra la excepción al leer categorías |
| `IOException` o `UnauthorizedAccessException` | 500 con un mensaje general sobre permisos y espacio | Registra el detalle técnico de la excepción |

Un JSON almacenado inválido representa un problema de los datos del servidor, por eso devuelve 500. Un nombre duplicado, una ruta no válida o un destino inexistente recibido en la solicitud devuelve 400.

El filtro `catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)` procesa esos errores de acceso y escritura. Las demás excepciones, incluida `OperationCanceledException`, se propagan a la infraestructura de ASP.NET Core.

Los errores técnicos de disco se registran completos, pero la respuesta general evita enviar al cliente los detalles internos de ese fallo. La lectura y el guardado seguro siguen siendo responsabilidad del servicio.

## Comprobaciones

Las comprobaciones de categorías incluyen llamadas directas al controlador para resultados correctos y entradas inválidas, con sus modelos de solicitud y el token de cancelación.
