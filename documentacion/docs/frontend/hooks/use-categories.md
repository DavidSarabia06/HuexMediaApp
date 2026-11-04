# useCategories

[Frontend](../README.md) · [Código TypeScript](../../codigo/UseCategories.md) · [Operaciones de categorías](../modulos/category-utils.md)

`useCategories` gestiona categorías y subcategorías de una biblioteca: creación, eliminación, renombrado, ordenación y movimiento de elementos entre grupos. Mantiene los datos y referencias de sus formularios.

## Parámetros y resultado

- `libraryManager`: selección, setter de biblioteca, indicador y setter de carga y controlador activo de `useLibraries`. `Pick<UseLibrariesResult, ...>` selecciona las propiedades que utiliza.
- `items`: elementos obtenidos del escaneo, para calcular los que siguen sin categoría.
- `groupIdPrefix`: prefijo HTML de los paneles, utilizado para recuperar el foco después de reordenar. Movies utiliza `movies-group`.

Devuelve las categorías, los destinos del menú, los elementos sin categoría y los estados, referencias y acciones de cada funcionalidad. `UseCategoriesResult` infiere el contrato mediante `ReturnType<typeof useCategories>`.

## Categorías y datos derivados

`categories` procede de `selectedLibrary.categories`. Al completar una operación se aplica la biblioteca devuelta por la API mediante `setSelectedLibrary`; el siguiente renderizado obtiene las nuevas categorías.

`collectItemPaths` reúne las rutas asignadas a cualquier nivel y `normalizePathForComparison` permite compararlas con el escaneo. `uncategorizedItems` excluye las asignadas y `getCategoryDestinations` construye las opciones de movimiento.

## Creación y subcategorías

`openCreateCategoryDialog` recibe un padre opcional y prepara el formulario. `closeCreateCategoryDialog` limpia sus datos cuando no hay un guardado activo. `handleCreateCategory` valida el nombre y llama a `createSubcategoryRequest` si hay padre, o a `createCategoryRequest` para un grupo principal.

## Movimiento

`handleMoveItem` envía la ruta y el destino a `moveCategoryItemRequest`. Convierte el identificador vacío del carrusel en `null`, que representa «Sin categoría» para la API. Aplica la biblioteca actualizada al terminar.

## Eliminación y renombrado

Las funciones `open...Dialog` conservan el grupo y abren su formulario. Las funciones `close...Dialog` limpian sus datos cuando la operación ha terminado. `handleDeleteCategory` elimina el grupo y sus descendientes; las asignaciones retiradas aparecen en «Sin categoría». `handleRenameCategory` valida y guarda el nombre.

## Ordenación y foco

`handleReorderCategory` recibe el grupo y un desplazamiento de -1 o 1. Guarda el identificador del panel movido y aplica el documento ordenado devuelto por el servidor. Un `useLayoutEffect` enfoca su título y lo desplaza al centro de la vista después de actualizar el DOM.

## Carga, errores y cancelación

Las acciones comparten `isLoading` y `activeControllerRef` con `useLibraries`, bloqueando operaciones simultáneas. Cada respuesta comprueba la cancelación antes de aplicar cambios y cada operación libera el bloqueo únicamente si conserva su controlador. `useLibraries` cancela el controlador activo al salir de la página.

Un `useEffect` limpia los errores de las acciones cuando cambia el identificador de la biblioteca seleccionada. Los formularios muestran sus errores y los fallos de movimiento y ordenación se devuelven para mostrarlos en la página.

## Integración con Movies

Movies crea primero `libraryManager` con `useLibraries` y lo entrega a `useCategories`, junto con `moviesList` y el prefijo de sus paneles. Conserva el JSX de los grupos y diálogos, la navegación al reproductor y la gestión del progreso.

## Integración con Series

Series pasa el mismo gestor de bibliotecas, su lista escaneada y el prefijo `series-group`. Recibe `uncategorizedItems` como `uncategorizedSeries` y `handleMoveItem` como `handleMoveSeries`. Los formularios y controles conservan el mismo orden que Movies y el retorno del hook.
