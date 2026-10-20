# Modelos de categorías de series

[Sistema de categorías](README.md) · [Código de los modelos](../../codigo/SeriesCategory.md) · [Servicio](servicio.md)

Estos cuatro modelos transportan los datos del sistema. Dos representan lo que se guarda en disco y dos reciben solicitudes de la API.

El archivo `SeriesCategory.cs` agrupa sus clases mediante las mismas regiones de esta página: **Datos de categorías** y **Solicitudes de la API**.

## Índice de modelos

- [SeriesCategory](#seriescategory): una categoría con sus series.
- [SeriesCategoryLibrary](#seriescategorylibrary): la biblioteca que contiene las categorías.
- [CreateSeriesCategoryRequest](#createseriescategoryrequest): solicitud de creación.
- [MoveSeriesCategoryRequest](#moveseriescategoryrequest): solicitud de cambio de categoría.

## Datos de categorías

<a id="seriescategory"></a>
### SeriesCategory

Representa una categoría. Forma parte de la lista `Categories` del archivo de biblioteca. El controlador también devuelve listas de este modelo al consultar, crear, mover o eliminar categorías.

| Propiedad | Tipo | Valor inicial | Significado |
| --- | --- | --- | --- |
| `Id` | `Guid` | `Guid.Empty` | Identificador de la categoría. `CreateAsync` le asigna un GUID nuevo antes de guardarla. |
| `Name` | `string` | `""` | Nombre visible de la categoría. |
| `SeriesPaths` | `List<string>` | Lista vacía | Rutas absolutas de las carpetas de series asignadas. |

**Reglas:** el servicio exige un identificador no vacío y único, un nombre válido y único en la biblioteca y rutas sin duplicados. La pertenencia de una serie se determina por la ruta de su carpeta, no por su nombre visible. Las comparaciones de nombres y rutas no distinguen mayúsculas.

**Quién lo utiliza:** [CreateAsync](servicio.md#createasync) crea la categoría; [MoveAsync](servicio.md#moveasync) modifica sus rutas; [DeleteAsync](servicio.md#deleteasync) retira la categoría completa; [GetAsync](servicio.md#getasync) devuelve las categorías almacenadas. [ValidateLibraryData](servicio.md#validatelibrarydata) comprueba su coherencia al cargar el JSON.

`new SeriesCategory()` crea un objeto con los valores iniciales de la tabla. El servicio valida sus propiedades antes de guardarlo.

<a id="seriescategorylibrary"></a>
### SeriesCategoryLibrary

Representa el objeto raíz del JSON de una biblioteca. Permite saber a qué ruta pertenece el contenido y qué versión de formato utiliza.

| Propiedad | Tipo | Valor inicial | Significado |
| --- | --- | --- | --- |
| `Version` | `int` | `1` | Versión del formato almacenado. Actualmente el servicio solo admite la versión 1. |
| `LibraryPath` | `string` | `""` | Ruta absoluta de la biblioteca propietaria del archivo. |
| `Categories` | `List<SeriesCategory>` | Lista vacía | Categorías y asignaciones de esa biblioteca. |

**Quién lo utiliza:** [LoadAsync](servicio.md#loadasync) obtiene la biblioteca, [ReadLibraryAsync](servicio.md#readlibraryasync) la deserializa y [SaveAsync](servicio.md#saveasync) coordina su escritura. El servicio devuelve su lista `Categories` a la API.

**Si falta el JSON:** `LoadAsync` devuelve en memoria `new SeriesCategoryLibrary { LibraryPath = library }`. La versión queda en 1 y la lista comienza vacía. El JSON aparece al guardar una operación válida.

**Ejemplo del archivo almacenado:** los nombres de las propiedades se escriben en camelCase por la configuración del serializador.

```json
{
  "version": 1,
  "libraryPath": "F:\\Series",
  "categories": [
    {
      "id": "4b9e61d8-dc11-4a72-b061-77690884fd34",
      "name": "Comedia",
      "seriesPaths": ["F:\\Series\\Serie de ejemplo"]
    }
  ]
}
```

Este JSON muestra la estructura. Para ejecutar operaciones con esas rutas, las carpetas deben existir y cumplir las comprobaciones correspondientes del servicio.

## Solicitudes de la API

<a id="createseriescategoryrequest"></a>
### CreateSeriesCategoryRequest

Recibe el cuerpo de `POST /api/seriescategories`. El controlador pasa sus propiedades a [CreateAsync](servicio.md#createasync).

| Propiedad | Tipo | Valor inicial | Significado |
| --- | --- | --- | --- |
| `LibraryPath` | `string` | `""` | Biblioteca existente en la que se creará la categoría. |
| `Name` | `string` | `""` | Nombre solicitado por el usuario. |

El cliente envía la biblioteca y el nombre. El servicio genera el GUID y comienza con una lista de series vacía. Antes de guardar, normaliza la ruta, recorta los espacios exteriores del nombre y comprueba su longitud, nombre reservado y unicidad.

```json
{
  "libraryPath": "F:\\Series",
  "name": "Comedia"
}
```

<a id="moveseriescategoryrequest"></a>
### MoveSeriesCategoryRequest

Recibe el cuerpo de `POST /api/seriescategories/move`. El controlador pasa sus propiedades a [MoveAsync](servicio.md#moveasync).

| Propiedad | Tipo | Valor inicial | Significado |
| --- | --- | --- | --- |
| `LibraryPath` | `string` | `""` | Biblioteca existente de la serie. |
| `SeriesPath` | `string` | `""` | Carpeta existente de la serie; debe ser hija directa de la biblioteca. |
| `CategoryId` | `Guid?` | `null` | Identificador del destino; `null` deja la serie sin categoría. |

**Destino con identificador:** debe corresponder a una categoría de esa biblioteca. El servicio comprueba el destino antes de retirar la asignación anterior.

**Destino `null`:** retira la asignación de la serie. El cliente la muestra en «Sin categoría». Si se omite `categoryId`, su valor inicial también es `null`.

**Destino `Guid.Empty`:** el servicio lo rechaza como identificador de categoría inválido.

```json
{
  "libraryPath": "F:\\Series",
  "seriesPath": "F:\\Series\\Serie de ejemplo",
  "categoryId": null
}
```

La operación actualiza las asignaciones de la serie en el JSON de organización.

## Propiedades y validaciones

Todas las propiedades tienen `get` y `set` públicos para leer y asignar sus valores. Las listas se inicializan vacías y los textos con una cadena vacía.

El servicio comprueba los datos de entrada y los datos cargados del JSON. Rechaza archivos con una versión distinta, nombres repetidos, rutas fuera de la biblioteca o identificadores vacíos.

Para consultar y eliminar categorías, el controlador recibe los datos de la ruta o de los parámetros de consulta.
