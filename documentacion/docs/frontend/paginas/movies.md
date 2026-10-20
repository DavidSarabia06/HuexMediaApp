# Movies: categorías y subcategorías

[Frontend](../README.md) · [Código JSX](../../codigo/MoviesPage.md)

`Movies.jsx` presenta las películas de la biblioteca configurada en `MoviesLibraryPath` y su organización en categorías y subcategorías.

## Crear una categoría

El botón «Nueva Categoria» llama a `openCreateCategoryDialog()` y abre el formulario compartido. `subcategoryParent` queda en `null`, indicando que se creará una categoría principal.

`handleCategoryNameChange` actualiza el nombre y limpia el error del formulario. Al enviar, `handleCreateCategory` recorta el nombre, comprueba su longitud y solicita `POST /api/MoviesCategory` con `libraryPath` y `categoryName`.

El controlador delega en `MoviesCategoryService.CreateCategoryAsync`. El servicio comprueba el nombre, su unicidad en la biblioteca y la ruta de biblioteca, genera un identificador y guarda la lista completa.

## Crear una subcategoría

Cada categoría ofrece «Nueva subcategoría en…». Abre el mismo diálogo pasando la categoría a `openCreateCategoryDialog(category)`.

El formulario adapta el título y la descripción al destino. Al enviarlo, `handleCreateCategory` solicita `POST /api/MoviesCategory/subcategories` con `libraryPath`, `categoryId` y `subcategoryName`.

`MoviesCategoryController.CreateSubcategory` delega en `MoviesCategoryService.CreateSubcategoryAsync`. El servicio exige una categoría existente, un nombre de entre 1 y 80 caracteres y un nombre único dentro de esa categoría, ignorando mayúsculas. «Sin subcategoría» es un nombre reservado.

## Guardado y respuesta

Ambas operaciones utilizan el bloqueo compartido del servicio para coordinar la lectura y la escritura. Publican el JSON mediante el archivo temporal y el reemplazo existentes en `MoviesCategoryData.json`.

El servidor devuelve la lista completa de categorías. El cliente aplica esa respuesta con `setCategories` y cierra el diálogo. En caso de error, conserva el formulario y muestra el mensaje para corregirlo o reintentar. `busyRef` bloquea solicitudes simultáneas y `handleDialogCancel` evita cerrar con Escape mientras se guarda.

## Visualización

Una categoría sin subcategorías muestra sus películas directamente bajo su título, utilizando `moviesPaths`, y el contador de películas disponibles aparece junto al nombre de la categoría. El carrusel recibe `showHeader={false}` porque el contenedor ya presenta el nombre de la categoría. Cuando existen subcategorías, el contenedor muestra sus carruseles, cada uno con su nombre, contador y sus `moviesPaths`. `getSubcategoryMovies` relaciona cada lista de rutas con las películas escaneadas.

Al crear la primera subcategoría, el servicio mueve las películas directas a ella y vacía `moviesPaths` de la categoría en el mismo guardado. Si un documento anterior contiene películas directas junto a subcategorías, al cargarlo se trasladan a la primera subcategoría y se guarda la organización resultante.

La fila «Sin categoría» permanece fuera de los contenedores y muestra las películas cuya ruta está fuera de todas las asignaciones. Los documentos guardados antes de añadir las asignaciones directas reciben una lista `moviesPaths` vacía al deserializarse; conservan sus subcategorías y sus asignaciones.

## Mover películas

El menú «Mover a categoría» ofrece «Sin categoría», las categorías que aún carecen de subcategorías y los destinos «Categoría · Subcategoría» de las demás. Cada fila permite también arrastrar una película a su destino. Cuando una categoría tiene subcategorías, el servicio exige seleccionar una de ellas.

El cliente reutiliza los destinos de `SeriesCategoryRow` y los traduce a `categoryId` y `subcategoryId` en `POST /api/MoviesCategory/move`, junto con `libraryPath` y `moviePath`:

| Destino | categoryId | subcategoryId |
| --- | --- | --- |
| Sin categoría | `null` | `null` |
| Directamente en una categoría | Id de categoría | `null` |
| Dentro de una subcategoría | Id de categoría | Id de subcategoría |

El servicio comprueba que el vídeo existe dentro de la biblioteca, incluidas sus subcarpetas, y que la subcategoría pertenece a la categoría seleccionada. Retira la asignación anterior de todas las listas y guarda el nuevo destino. La lectura del JSON comprueba la unicidad entre asignaciones directas y subcategorías.

Las filas reutilizan `SeriesCategoryRow` y el formulario utiliza los estilos existentes de `category-dialog` y `action-btn`. Las reglas `movies-category-group` de `HuexStyles.css` delimitan el contenedor de categoría y separan su cabecera de las filas interiores.
