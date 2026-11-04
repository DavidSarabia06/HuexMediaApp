using HuexMediaApp.Server.Models.Categories;
using HuexMediaApp.Server.Models.Libraries;
using Microsoft.Extensions.Options;
namespace HuexMediaApp.Server.Services;

/// <summary>Gestiona las categorías de las bibliotecas.</summary>
public sealed class CategoryService
{
    private readonly LibraryService _libraryService;
    private readonly int _maxDepth;

    #region Construcción

    public CategoryService(LibraryService libraryService, IOptions<MoviesCategoryOptions> options)
    {
        _libraryService = libraryService;
        _maxDepth = options.Value.MaxDepth;
    }

    #endregion

    #region Creación de elementos
    /// <summary>Crea una categoría principal y devuelve la biblioteca actualizada.</summary>
    public async Task<MediaLibrary> CreateCategoryAsync(
        Guid libraryId,
        string name,
        CancellationToken cancellationToken = default)
    {
        string categoryName = ValidateName(name);

        return await _libraryService.UpdateAsync(libraryId, library =>
        {
            // Comprueba los nombres de las categorías principales de esta biblioteca.
            bool nameExists = library.Categories.Any(category =>
                string.Equals(
                    category.Name,
                    categoryName,
                    StringComparison.OrdinalIgnoreCase));

            if (nameExists)
            {
                throw new ArgumentException(
                    "Ya existe una categoría con ese nombre.");
            }

            MediaCategory newCategory = new MediaCategory
            {
                Id = Guid.NewGuid(),
                Name = categoryName,
                ItemPaths = [],
                Subcategories = []
            };

            library.Categories.Add(newCategory);
        }, cancellationToken);
    }


    /// <summary>Crea una subcategoría dentro del grupo indicado y devuelve la biblioteca actualizada.</summary>
    public async Task<MediaLibrary> CreateSubcategoryAsync(
        Guid libraryId,
        Guid parentId,
        string name,
        CancellationToken cancellationToken = default)
    {
        if (parentId == Guid.Empty)
        {
            throw new ArgumentException(
                "El identificador de la categoría padre no es válido.");
        }

        string categoryName = ValidateName(name);

        return await _libraryService.UpdateAsync(libraryId, library =>
        {
            // Busca el padre entre las categorías principales y todos sus descendientes.
            MediaCategory? parent = FindCategory(
                library.Categories,
                parentId,
                1,
                out int parentDepth,
                out _);

            if (parent is null)
            {
                throw new KeyNotFoundException(
                    "La categoría padre no existe en esta biblioteca.");
            }

            // El nuevo grupo estará un nivel por debajo de su padre.
            if (parentDepth + 1 > _maxDepth)
            {
                throw new ArgumentException(
                    $"No se pueden crear más de {_maxDepth} niveles de categorías.");
            }

            // El nombre debe ser único entre los hijos del mismo padre.
            bool nameExists = parent.Subcategories.Any(category =>
                string.Equals(
                    category.Name,
                    categoryName,
                    StringComparison.OrdinalIgnoreCase));

            if (nameExists)
            {
                throw new ArgumentException(
                    "Ya existe una subcategoría con ese nombre dentro de este grupo.");
            }

            MediaCategory newCategory = new MediaCategory
            {
                Id = Guid.NewGuid(),
                Name = categoryName,
                ItemPaths = [],
                Subcategories = []
            };

            parent.Subcategories.Add(newCategory);
        }, cancellationToken);
    }

    #endregion

    #region Movimiento de elementos

    /// <summary>Cambia la asignación de un elemento y devuelve la biblioteca actualizada.</summary>
    public async Task<MediaLibrary> MoveItemAsync(
        Guid libraryId,
        string itemPath,
        Guid? targetCategoryId,
        CancellationToken cancellationToken = default)
    {
        if (targetCategoryId == Guid.Empty)
        {
            throw new ArgumentException(
                "El identificador de la categoría de destino no es válido.");
        }

        return await _libraryService.UpdateAsync(libraryId, library =>
        {
            string normalizedPath = ValidateItemPath(
                library.LibraryPath,
                itemPath);

            MediaCategory? target = null;

            // Busca el destino antes de modificar las asignaciones.
            if (targetCategoryId.HasValue)
            {
                target = FindCategory(
                    library.Categories,
                    targetCategoryId.Value,
                    1,
                    out _,
                    out _);

                if (target is null)
                {
                    throw new KeyNotFoundException(
                        "La categoría de destino no existe en esta biblioteca.");
                }
            }

            // Retira la asignación anterior, esté en una categoría o en un descendiente.
            RemoveItemFromCategories(library.Categories, normalizedPath);

            // Sin destino, queda sin categoría. Con destino, se asigna directamente a ese grupo.
            if (target is not null)
            {
                target.ItemPaths.Add(normalizedPath);
            }
        }, cancellationToken);
    }

    /// <summary>Elimina la asignación del elemento en todos los niveles de categorías.</summary>
    private static void RemoveItemFromCategories(
        List<MediaCategory> categories,
        string itemPath)
    {
        foreach (MediaCategory category in categories)
        {
            category.ItemPaths.RemoveAll(path =>
                string.Equals(
                    Path.TrimEndingDirectorySeparator(Path.GetFullPath(path)),
                    itemPath,
                    StringComparison.OrdinalIgnoreCase));

            RemoveItemFromCategories(category.Subcategories, itemPath);
        }
    }

    #endregion

    #region Eliminación de categorías

    /// <summary>Elimina una categoría con sus descendientes y devuelve la biblioteca actualizada.</summary>
    public async Task<MediaLibrary> DeleteCategoryAsync(
        Guid libraryId,
        Guid categoryId,
        CancellationToken cancellationToken = default)
    {
        if (categoryId == Guid.Empty)
        {
            throw new ArgumentException(
                "El identificador de la categoría no es válido.");
        }

        return await _libraryService.UpdateAsync(libraryId, library =>
        {
            bool removed = RemoveCategory(library.Categories, categoryId);

            if (!removed)
            {
                throw new KeyNotFoundException(
                    "La categoría no existe en esta biblioteca.");
            }
        }, cancellationToken);
    }

    /// <summary>Busca el grupo y lo elimina de la lista que lo contiene.</summary>
    private static bool RemoveCategory(
        List<MediaCategory> categories,
        Guid categoryId)
    {
        for (int index = 0; index < categories.Count; index++)
        {
            MediaCategory category = categories[index];

            if (category.Id == categoryId)
            {
                // Al retirar el grupo, se retira toda su rama del documento.
                // Sus elementos dejan de estar asignados y aparecerán en «Sin categoría».
                categories.RemoveAt(index);
                return true;
            }

            // Si no es este grupo, busca entre sus descendientes.
            bool removed = RemoveCategory(category.Subcategories, categoryId);

            if (removed)
            {
                return true;
            }
        }

        return false;
    }

    #endregion

    #region Cambio de nombre

    /// <summary>Cambia el nombre de un grupo y devuelve la biblioteca actualizada.</summary>
    public async Task<MediaLibrary> RenameCategoryAsync(
        Guid libraryId,
        Guid categoryId,
        string name,
        CancellationToken cancellationToken = default)
    {
        if (categoryId == Guid.Empty)
        {
            throw new ArgumentException(
                "El identificador de la categoría no es válido.");
        }

        string categoryName = ValidateName(name);

        return await _libraryService.UpdateAsync(libraryId, library =>
        {
            MediaCategory? category = FindCategory(
                library.Categories,
                categoryId,
                1,
                out _,
                out List<MediaCategory>? container);

            if (category is null || container is null)
            {
                throw new KeyNotFoundException(
                    "La categoría no existe en esta biblioteca.");
            }

            // Comprueba los nombres de los otros grupos que comparten el mismo padre.
            bool nameExists = container.Any(other =>
                other.Id != categoryId &&
                string.Equals(
                    other.Name,
                    categoryName,
                    StringComparison.OrdinalIgnoreCase));

            if (nameExists)
            {
                throw new ArgumentException(
                    "Ya existe otro grupo con ese nombre en este nivel.");
            }

            category.Name = categoryName;
        }, cancellationToken);
    }

    #endregion

    #region Orden de categorías

    /// <summary>Mueve un grupo una posición dentro de su lista y devuelve la biblioteca actualizada.</summary>
    public async Task<MediaLibrary> ReorderCategoryAsync(
        Guid libraryId,
        Guid categoryId,
        int offset,
        CancellationToken cancellationToken = default)
    {
        if (categoryId == Guid.Empty)
        {
            throw new ArgumentException(
                "El identificador de la categoría no es válido.");
        }

        if (offset != -1 && offset != 1)
        {
            throw new ArgumentException(
                "El desplazamiento debe ser -1 para subir o 1 para bajar.");
        }

        return await _libraryService.UpdateAsync(libraryId, library =>
        {
            MediaCategory? category = FindCategory(
                library.Categories,
                categoryId,
                1,
                out _,
                out List<MediaCategory>? container);

            if (category is null || container is null)
            {
                throw new KeyNotFoundException(
                    "La categoría no existe en esta biblioteca.");
            }

            int currentIndex = container.FindIndex(
                item => item.Id == categoryId);

            int targetIndex = currentIndex + offset;

            // Impide salir por el principio o el final de la lista.
            if (targetIndex < 0 || targetIndex >= container.Count)
            {
                throw new ArgumentException(
                    "El grupo ya está en el extremo de la lista.");
            }

            // Intercambia los grupos completos, conservando sus elementos y descendientes.
            MediaCategory otherCategory = container[targetIndex];
            container[targetIndex] = category;
            container[currentIndex] = otherCategory;
        }, cancellationToken);
    }

    #endregion

    #region Búsqueda de categorías

    /// <summary>Busca un grupo y devuelve su nivel y la lista que lo contiene.</summary>
    private static MediaCategory? FindCategory(
        List<MediaCategory> categories,
        Guid categoryId,
        int currentDepth,
        out int foundDepth,
        out List<MediaCategory>? container)
    {
        foreach (MediaCategory category in categories)
        {
            if (category.Id == categoryId)
            {
                foundDepth = currentDepth;
                container = categories;
                return category;
            }

            // Si no es este grupo, busca dentro de sus hijos en el siguiente nivel.
            MediaCategory? child = FindCategory(
                category.Subcategories,
                categoryId,
                currentDepth + 1,
                out int childDepth,
                out List<MediaCategory>? childContainer);

            if (child is not null)
            {
                foundDepth = childDepth;
                container = childContainer;
                return child;
            }
        }

        // Esta rama no contiene el grupo solicitado.
        foundDepth = 0;
        container = null;
        return null;
    }

    #endregion

    #region Validación

    /// <summary>Elimina espacios de los extremos y comprueba la longitud del nombre.</summary>
    private static string ValidateName(string name)
    {
        string normalizedName = name?.Trim() ?? string.Empty;

        if (normalizedName.Length == 0 || normalizedName.Length > 80)
        {
            throw new ArgumentException(
                "El nombre de la categoría debe tener entre 1 y 80 caracteres.");
        }

        return normalizedName;
    }

    /// <summary>Normaliza la ruta del elemento y comprueba que esté dentro de la biblioteca.</summary>
    private static string ValidateItemPath(string libraryPath, string itemPath)
    {
        if (string.IsNullOrWhiteSpace(itemPath) ||
            !Path.IsPathFullyQualified(itemPath))
        {
            throw new ArgumentException(
                "La ruta del elemento debe ser absoluta.");
        }

        string rootPath = Path.GetFullPath(libraryPath);
        string normalizedPath = Path.TrimEndingDirectorySeparator(
            Path.GetFullPath(itemPath));

        string relativePath = Path.GetRelativePath(rootPath, normalizedPath);

        // Rechaza la propia raíz, otras unidades y las rutas que salen de la biblioteca.
        if (relativePath == "." ||
            relativePath == ".." ||
            Path.IsPathRooted(relativePath) ||
            relativePath.StartsWith($"..{Path.DirectorySeparatorChar}") ||
            relativePath.StartsWith($"..{Path.AltDirectorySeparatorChar}"))
        {
            throw new ArgumentException(
                "El elemento no pertenece a esta biblioteca.");
        }

        return normalizedPath;
    }

    #endregion
}