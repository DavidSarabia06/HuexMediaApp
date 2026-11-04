# CategoriesController

[Sistema](README.md) · [Código fuente](../../codigo/CategoriesController.md)

La ruta base es `/api/libraries/{libraryId}/categories`. El controlador recibe las solicitudes tipadas y delega las reglas en `CategoryService`.

| Método y sufijo | Operación |
| --- | --- |
| `POST create` | Crear categoría con `CreateCategoryRequest`. |
| `POST {parentId}/create-subcategory` | Crear un hijo con `CreateCategoryRequest`. |
| `POST move-item` | Mover una serie o película con `MoveCategoryItemRequest`. |
| `POST {categoryId}/delete` | Eliminar un grupo y su rama. |
| `POST {categoryId}/rename` | Cambiar el nombre con `RenameCategoryRequest`. |
| `POST {categoryId}/reorder` | Desplazar el grupo con `ReorderCategoryRequest`. |

`ExecuteAsync<T>` espera el resultado y devuelve HTTP 200 con `MediaLibrary`. Los argumentos inválidos producen 400 y los identificadores inexistentes, 404. Los errores de documento o almacenamiento se registran y devuelven 500. La cancelación se propaga a ASP.NET Core.
