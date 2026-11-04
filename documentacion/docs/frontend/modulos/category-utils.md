# categoryUtils

[Frontend](../README.md) · [Código TypeScript](../../codigo/CategoryUtils.md) · [Peticiones API](library-category-api.md)

`src/utils/categoryUtils.ts` define los modelos comunes y transforma los datos de categorías y elementos.

## Modelos

`MediaCategory` contiene identificador, nombre, rutas directas y subcategorías recursivas. `MediaLibrary` contiene versión, identificador, nombre, tipo, carpeta y categorías principales. `MediaItem` reutiliza el elemento del carrusel y `CategoryDestination` representa una opción de destino.

## Funciones

- `collectItemPaths(paths, groups)` reúne rutas directas y descendientes mediante recursión; `flatMap` une las ramas y `concat` devuelve el resultado.
- `getCategoryItems(items, paths)` compara rutas normalizadas y conserva los objetos y su tipo original.
- `countCategoryItems(items, group)` cuenta los elementos disponibles asignados a toda la rama.
- `getCategoryDestinations(groups)` recorre la jerarquía y crea las opciones con los nombres completos de sus padres.

Las modificaciones HTTP de grupos y asignaciones se encuentran en [categoriesApi](../../codigo/CategoriesApi.md).
