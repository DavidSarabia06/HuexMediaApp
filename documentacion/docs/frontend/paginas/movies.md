# Movies

[Código TSX](../../codigo/MoviesPage.md) · [Sistema de películas](../../sistemas/peliculas/README.md)

`Movies.tsx` permite seleccionar una biblioteca guardada y muestra sus categorías, subcategorías y carátulas. Utiliza el hook común para gestionar las bibliotecas.

## Propiedades y estados

`moviesList` y `setMoviesList` comparten las películas con App. `densityStyle` aplica el tamaño elegido en el header. La página conserva progreso y estados de reproducción. [useCategories](../hooks/use-categories.md) gestiona las categorías y sus acciones. [useLibraries](../hooks/use-libraries.md) mantiene el listado, selección y formularios de bibliotecas.

## Carga inicial

`resetMovieLibrary` limpia películas, progreso y errores de continuación. `applyLoadedLibrary` recibe el contenido y progreso consultados por el hook y los aplica a los estados.

Movies estabiliza ambos callbacks con `useCallback` y los pasa al hook. Este consulta el listado y carga la biblioteca recordada o la única disponible. Consulta contenido y progreso en paralelo, los entrega al callback y guarda la selección y su identificador recordado.

Movies dibuja el selector y los diálogos utilizando las acciones del hook para seleccionar carpeta, crear, seleccionar, renombrar y eliminar bibliotecas. El hook cancela las peticiones al salir y comparte el controlador con las operaciones de categorías.

## Datos de visualización

Las funciones se reparten entre [generalUtils.ts](../../codigo/GeneralUtils.md), con `readJson` y `normalizePathForComparison`, y [categoryUtils.ts](../../codigo/CategoryUtils.md), con las operaciones de categorías. `getCategoryItems(moviesList, paths)` y `countCategoryItems(moviesList, group)` reciben la lista de películas como argumento. `useCategories` obtiene las categorías de la biblioteca seleccionada y calcula destinos y elementos sin categoría. `Movies.tsx` conserva el selector y el dibujado. Las categorías comunes utilizan `itemPaths` y `subcategories`.

- `normalizePathForComparison` unifica barras, quita las finales y convierte la ruta a mayúsculas.
- `collectItemPaths` reúne las rutas directas y las de los grupos hijos mediante recursión. `flatMap` une las listas de rutas y `concat` las incorpora al resultado.
- `getCategoryItems` relaciona las rutas guardadas con las películas disponibles del escaneo.
- `countCategoryItems` calcula el total de una rama completa.
- `assignedPaths` reúne las asignaciones y `uncategorizedMovies` obtiene las películas de «Sin categoría».

## Dibujo de la página

`renderGroups(group, depth)` dibuja cada grupo completo: título, contador total, películas directas y grupos hijos. La página inicia el dibujo con `categories.map(category => renderGroups(category, 1))` cuando hay una biblioteca seleccionada; cada grupo llama a la misma función con sus hijos y `depth + 1`. El nivel 1 utiliza el contenedor de categoría principal y los siguientes los estilos de subcategoría. El fragmento `content` reúne carrusel e hijos; las categorías lo colocan dentro de `movies-category-group-content` y las subcategorías directamente en su sección. Los padres conservan sus películas directas encima de sus subcategorías.

`SeriesCategoryRow` aporta los carruseles y utiliza `HuexCard` para dibujar las carátulas. La página aplica los estilos existentes de categorías y niveles, y el selector del header mantiene el control del tamaño de las carátulas.

## Limpieza de los archivos guardados

Las consultas de bibliotecas limpian las asignaciones de categorías cuyos elementos ya no existen. La consulta de progreso limpia las referencias ausentes antes de preparar las tarjetas. Estas operaciones se realizan en el servidor y publican el JSON solo si hay cambios.

Los grupos vacíos y el progreso de los archivos disponibles se conservan. Si la raíz no está accesible o falla el recorrido del disco, se mantienen las referencias guardadas.
