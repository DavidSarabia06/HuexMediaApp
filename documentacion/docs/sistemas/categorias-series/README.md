# Categorías de series

[Todos los sistemas](../../README.md)

Este sistema permite crear categorías, asignar una serie a una de ellas y eliminarlas. La organización se conserva en un archivo JSON por biblioteca y es independiente del historial de reproducción.

## Componentes

| Componente | Acceso | Estado de la documentación |
| --- | --- | --- |
| Servicio | [SeriesCategoryService](servicio.md) | Funciones documentadas y código reestructurado |
| Modelos | [Clases y propiedades](modelos.md) | Modelos comentados y documentados |
| Controlador | [Operaciones y respuestas](controlador.md) | Funciones comentadas y documentadas |

## Recorrido de una operación

La interfaz solicita una operación a `SeriesCategoriesController`. El controlador llama al método público correspondiente de `SeriesCategoryService`. El servicio valida las entradas, carga el archivo de la biblioteca y, si hay cambios, publica el JSON actualizado. El controlador convierte el resultado o el error en una respuesta HTTP.

El servicio trabaja con `SeriesCategoryLibrary`, que contiene la ruta de la biblioteca, la versión del formato y sus categorías. Cada `SeriesCategory` guarda un identificador, un nombre y las rutas de sus series.

## Reglas del sistema

- Una serie puede pertenecer a una sola categoría.
- «Sin categoría» es una sección calculada por el cliente, no una categoría almacenada.
- Eliminar una categoría no elimina sus vídeos: sus series quedan sin asignación.
- Las comparaciones de rutas y nombres no distinguen mayúsculas.
- La existencia de una serie se comprueba al moverla. Al leer el JSON se valida su pertenencia a la biblioteca, pero no se exige que su carpeta siga existiendo.
- Un archivo dañado provoca un error; no se sustituye por una biblioteca vacía.

## Persistencia

Los archivos se guardan en `HuexMediaApp.Server/App_Data/SeriesCategories/`, bajo el directorio de contenido del servidor. El nombre combina la carpeta de la biblioteca y ocho caracteres del hash SHA256 de su ruta completa, por ejemplo `Series-32F8A3FC.json`.

El servicio lee y escribe únicamente el archivo con este nombre legible.
