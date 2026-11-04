# ConfigurationService

[Sistema de configuración](README.md) · [Código del servicio](../../codigo/ConfigurationService.md)

## Responsabilidad

Lee y modifica los valores de `HuexMediaAppSettings` en `appsettings.json`. Se registra como singleton y lee el archivo en cada operación. Centraliza en `AllowedKeys` las claves que se pueden consultar y actualizar, también desde otros servicios.

## Índice de funciones

### Construcción

- [Constructor](#constructor)

### Operaciones públicas

- [Get de T](#get)
- [Update](#update)

### Lectura y escritura

- [GetNode](#getnode)
- [LoadSettings](#loadsettings)
- [ReadSettingsRoot](#readsettingsroot)
- [SaveSettingsRoot](#savesettingsroot)
- [GetSettingsPath](#getsettingspath)

### Validación

- [ValidateKey](#validatekey)
- [ValidateUpdate](#validateupdate)
- [IsValidValue](#isvalidvalue)

## Construcción

<a id="constructor"></a>
### Constructor

**Recibe:** `AppStoragePaths storagePaths`. **Resultado:** guarda las rutas en `_storagePaths` para localizar la configuración activa.

## Operaciones públicas

<a id="get"></a>
### Get de T

**Firma:** `T Get<T>(string key)`. **Recibe:** nombre exacto de la clave y tipo que necesita el consumidor. **Devuelve:** el valor convertido a `T`, o un nodo JSON cuando `T` es `JsonNode`.

**Recorrido:** [ValidateKey](#validatekey) → [GetNode](#getnode) → comprobar si `T` es `JsonNode` → devolver el nodo o llamar a `GetValue<T>()`.

El controlador usa `Get<JsonNode>` para conservar el tipo JSON de la respuesta. Otros servicios pueden utilizar `Get<string>` o `Get<bool>`.

El código `(T)(object)value` adapta el nodo al retorno genérico después de comprobar `typeof(T) == typeof(JsonNode)`. El nodo conserva su tipo JSON original.

**Errores:** clave no permitida produce `ArgumentException` antes de leer el archivo. Una clave permitida ausente o almacenada como `null` produce `KeyNotFoundException`. Un tipo `T` incompatible con el valor puede producir un error de conversión. También se propagan los errores de lectura o estructura.

<a id="update"></a>
### Update

**Firma:** `void Update(string key, JsonNode? value)`. **Recibe:** clave y nuevo valor JSON, que puede llegar como `null`. **Devuelve:** nada si el guardado termina.

**Recorrido:** [ValidateKey](#validatekey) → rechazar valor nulo → [GetSettingsPath](#getsettingspath) → [ReadSettingsRoot](#readsettingsroot) → seleccionar `HuexMediaAppSettings` → [ValidateUpdate](#validateupdate) → asignar `value.DeepClone()` → [SaveSettingsRoot](#savesettingsroot).

La presencia del valor se comprueba aquí, antes de leer el archivo, para proteger tanto las solicitudes HTTP como las llamadas internas. Si es `null`, lanza `ArgumentException`.

Solo sustituye una propiedad dentro del documento cargado y conserva los valores de las demás secciones. Exige claves existentes y valores de tipo compatible.

`DeepClone()` copia el nodo recibido porque un `JsonNode` solo puede pertenecer a un padre. Permite insertarlo en el documento sin reutilizar el nodo del objeto de solicitud.

**Errores:** clave ausente o con valor previo `null`; tipo incompatible; carpeta de series inexistente; archivo inválido, inaccesible o con fallo de escritura.

## Lectura y escritura

<a id="getnode"></a>
### GetNode

**Recibe:** `string key`. **Devuelve:** una copia `JsonNode` del valor, obtenida con `DeepClone`.

**Lo llama:** [Get de T](#get). **Llama a:** [LoadSettings](#loadsettings).

Si la clave falta o su valor JSON es `null`, lanza `KeyNotFoundException`. La búsqueda distingue mayúsculas.

<a id="loadsettings"></a>
### LoadSettings

**Recibe:** nada. **Devuelve:** el `JsonObject` de `HuexMediaAppSettings` dentro del documento leído.

**La llama:** [GetNode](#getnode). **Llama a:** [GetSettingsPath](#getsettingspath) y [ReadSettingsRoot](#readsettingsroot).

La sección debe existir y ser un objeto.

<a id="readsettingsroot"></a>
### ReadSettingsRoot

**Recibe:** `string settingsPath`. **Devuelve:** el objeto raíz como `JsonObject` mediante `File.ReadAllText`, `JsonNode.Parse` y `AsObject`.

**La llaman:** [LoadSettings](#loadsettings) y [Update](#update).

**Errores:** los del sistema de archivos, un JSON mal formado o una raíz incompatible. El código exige un objeto raíz válido.

<a id="savesettingsroot"></a>
### SaveSettingsRoot

**Recibe:** `settingsPath` y `JsonObject root`. **Devuelve:** nada.

Serializa el documento completo con `WriteIndented = true` y llama a `File.WriteAllText`. Puede cambiar el formato textual del archivo aunque conserve los valores de las secciones que no se han modificado.

**La llama:** [Update](#update). **Errores:** serialización y escritura.

<a id="getsettingspath"></a>
### GetSettingsPath

**Recibe:** nada. **Devuelve:** `_storagePaths.SettingsPath`.

**La llaman:** [LoadSettings](#loadsettings) y [Update](#update).

## Validación

<a id="validatekey"></a>
### ValidateKey

**Recibe:** `string key`. **Devuelve:** nada si la clave está permitida.

Rechaza claves nulas, vacías, de solo espacios o que no estén en `AllowedKeys`, lanzando `ArgumentException`. La lista contiene `DownloadSeriesPosters`, `DownloadMoviePosters` y `DownloadEpisodeThumbnails`. La comparación exige el nombre exacto de la clave, incluidas las mayúsculas.

**La llaman:** [Get de T](#get) y [Update](#update), antes de acceder al archivo. La clave debe figurar en `AllowedKeys` para autorizar su acceso. La misma regla se aplica a la API y a los consumidores internos.

<a id="validateupdate"></a>
### ValidateUpdate

**Recibe:** `JsonNode? currentValue` y `JsonNode newValue`. **Devuelve:** nada si todas las comprobaciones pasan.

1. El valor actual debe existir y no ser `null`; en otro caso lanza `KeyNotFoundException`.
2. [IsValidValue](#isvalidvalue) debe aceptar el tipo nuevo; si no, lanza `ArgumentException` con el mensaje de tipo no válido.

**La llama:** [Update](#update), antes de asignar el valor y escribir.

<a id="isvalidvalue"></a>
### IsValidValue

**Recibe:** los nodos del valor actual y del nuevo. **Devuelve:** `bool` comparando sus `JsonValueKind`.

| Tipo actual | Tipos nuevos admitidos |
| --- | --- |
| `String` | `String` |
| `True` o `False` | `True` o `False` |
| `Number` | `Number` |
| Cualquier otro | Ninguno |

`true` y `false` son valores de la misma familia booleana, aunque tengan distintos valores en `JsonValueKind`. Los números enteros y decimales se comparan como miembros de la familia JSON `Number`.

**La llama:** [ValidateUpdate](#validateupdate). Devuelve `false` para una combinación incompatible y `ValidateUpdate` comunica el rechazo.
