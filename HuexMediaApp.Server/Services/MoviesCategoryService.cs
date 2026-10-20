
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using HuexMediaApp.Server.Models;

namespace HuexMediaApp.Server.Services;

/// <summary>
/// Organiza las Movies en categorías y conserva sus asignaciones en un JSON por biblioteca.
/// No modifica los vídeos, sus carpetas ni el progreso de reproducción.
/// </summary>
public sealed class MoviesCategoryService
{
    private const int MaximumCategoryNameLength = 80;
    private const int MaximumSubcategoryNameLength = 80;
    private const int MaximumLibraryFileNameLength = 80;
    private const string UncategorizedName = "Sin categoría";
    private const string UnsubcategorizedName = "Sin subcategoría";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true
    };

    private readonly string _dataDirectory;

    // Al ser un servicio singleton, el bloqueo protege la operación completa de
    // lectura y escritura e impide que dos solicitudes pierdan cambios entre sí.
    private readonly SemaphoreSlim _gate = new(1, 1);

    #region Construcción y operaciones públicas

    public MoviesCategoryService(AppStoragePaths storagePaths)
    {
        _dataDirectory = Path.Combine(storagePaths.DataDirectory, "MoviesCategories");
    }

    /// <summary>Obtiene las categorías; una biblioteca sin archivo devuelve una lista vacía.</summary>
    public async Task<List<MoviesCategory>> GetAsync(
        string libraryPath,
        CancellationToken cancellationToken = default)
    {
        string library = NormalizeLibrary(libraryPath);
        await _gate.WaitAsync(cancellationToken);
        try
        {
            MoviesCategoryLibrary data = await LoadAsync(library, cancellationToken);
            return data.Categories;
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <summary>Crea una categoría con identificador nuevo y nombre único en su biblioteca.</summary>
    public async Task<List<MoviesCategory>> CreateCategoryAsync(
        string libraryPath,
        string name,
        CancellationToken cancellationToken = default)
    {
        string library = NormalizeLibrary(libraryPath);
        name = name?.Trim() ?? "";
        ValidateName(name);

        await _gate.WaitAsync(cancellationToken);
        try
        {
            MoviesCategoryLibrary data = await LoadAsync(library, cancellationToken);
            bool nameExists = data.Categories.Any(category =>
                string.Equals(category.Name, name, StringComparison.OrdinalIgnoreCase));
            if (nameExists)
            {
                throw new ArgumentException("Ya existe una categoría con ese nombre.");
            }

            data.Categories.Add(new MoviesCategory { Id = Guid.NewGuid(), Name = name });
            await SaveAsync(library, data, cancellationToken);
            return data.Categories;
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <summary>Crea una subcategoría con nombre único dentro de su categoría.</summary>
    public async Task<List<MoviesCategory>> CreateSubcategoryAsync(
        string libraryPath,
        Guid? categoryId,
        string name,
        CancellationToken cancellationToken = default)
    {
        string library = NormalizeLibrary(libraryPath);
        name = name?.Trim() ?? "";
        ValidateSubcategoryName(name);
        await _gate.WaitAsync(cancellationToken);
        try
        {
            MoviesCategoryLibrary data = await LoadAsync(library, cancellationToken);
            MoviesCategory? category = data.Categories.Find(item => item.Id == categoryId);
            if (category is null)
            {
                throw new ArgumentException("La categoría de destino no existe.");
            }
            if (category.MoviesSubcategories.Any(item =>
                string.Equals(item.Name, name, StringComparison.OrdinalIgnoreCase)))
            {
                throw new ArgumentException("Ya existe una subcategoría con ese nombre en esta categoría.");
            }

            MoviesSubcategory subcategory = new MoviesSubcategory { Id = Guid.NewGuid(), Name = name };
            if (category.MoviesSubcategories.Count == 0)
            {
                subcategory.MoviesPaths.AddRange(category.MoviesPaths);
                category.MoviesPaths.Clear();
            }
            category.MoviesSubcategories.Add(subcategory);
            await SaveAsync(library, data, cancellationToken);
            return data.Categories;
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <summary>Asigna una película a una categoría, a una subcategoría suya o la deja sin categoría.</summary>
    public async Task<List<MoviesCategory>> MoveMovieAsync(
        string libraryPath,
        string moviePath,
        Guid? categoryId,
        Guid? subcategoryId,
        CancellationToken cancellationToken = default)
    {
        string libraryPathN = NormalizeLibrary(libraryPath);
        string moviePathN = NormalizePath(moviePath);
        if (!IsChild(libraryPathN, moviePathN) || !File.Exists(moviePathN) ||
            !new[] { ".mp4", ".mkv", ".avi" }.Contains(Path.GetExtension(moviePathN), StringComparer.OrdinalIgnoreCase))
        {
            throw new ArgumentException("La película no pertenece a esta biblioteca, no existe o su formato no es válido.");
        }

        await _gate.WaitAsync(cancellationToken);
        try
        {
            MoviesCategoryLibrary data = await LoadAsync(libraryPathN, cancellationToken);
            MoviesCategory? destinationCategory = categoryId.HasValue
                ? data.Categories.Find(category => category.Id == categoryId.Value)
                : null;
            if (categoryId.HasValue && destinationCategory is null)
            {
                throw new ArgumentException("La categoría de destino no existe.");
            }

            MoviesSubcategory? destinationSubcategory = subcategoryId.HasValue
                ? destinationCategory?.MoviesSubcategories.Find(subcategory => subcategory.Id == subcategoryId.Value)
                : null;

            if (subcategoryId.HasValue && destinationSubcategory is null)
            {
                throw new ArgumentException("La subcategoría no pertenece a la categoría de destino.");
            }
            if (destinationCategory is not null && destinationCategory.MoviesSubcategories.Count > 0 && !subcategoryId.HasValue)
            {
                throw new ArgumentException("Selecciona una subcategoría de destino.");
            }

            // Una película tiene una única asignación, directa o dentro de una subcategoría.
            foreach (MoviesCategory category in data.Categories)
            {
                category.MoviesPaths.RemoveAll(path => string.Equals(path, moviePathN, StringComparison.OrdinalIgnoreCase));
                foreach (MoviesSubcategory subcategory in category.MoviesSubcategories)
                {
                    subcategory.MoviesPaths.RemoveAll(path => string.Equals(path, moviePathN, StringComparison.OrdinalIgnoreCase));
                }
            }

            if (destinationSubcategory is not null)
            {
                destinationSubcategory.MoviesPaths.Add(moviePathN);
            }
            else if (destinationCategory is not null)
            {
                destinationCategory.MoviesPaths.Add(moviePathN);
            }
            await SaveAsync(libraryPathN, data, cancellationToken);
            return data.Categories;
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <summary>Elimina una categoría sin borrar las carpetas ni el historial de sus Movies.</summary>
    public async Task<List<MoviesCategory>> DeleteAsync(
        string libraryPath,
        Guid categoryId,
        CancellationToken cancellationToken = default)
    {
        string library = NormalizeLibrary(libraryPath);
        await _gate.WaitAsync(cancellationToken);
        try
        {
            MoviesCategoryLibrary data = await LoadAsync(library, cancellationToken);
            if (categoryId == Guid.Empty || data.Categories.RemoveAll(category => category.Id == categoryId) == 0)
            {
                throw new ArgumentException("La categoría no existe o no se puede eliminar.");
            }

            // El cliente calcula «Sin categoría» a partir de las Movies sin asignación.
            // No hace falta crear otra categoría ni mover físicamente sus carpetas.
            await SaveAsync(library, data, cancellationToken);
            return data.Categories;
        }
        finally
        {
            _gate.Release();
        }
    }

    #endregion

    #region Validación y rutas

    /// <summary>Normaliza una ruta absoluta y retira el separador final sobrante.</summary>
    private static string NormalizePath(string path)
    {
        if (string.IsNullOrWhiteSpace(path) || !Path.IsPathFullyQualified(path))
        {
            throw new ArgumentException("La ruta de la biblioteca o de la serie no es válida.");
        }

        return Path.TrimEndingDirectorySeparator(Path.GetFullPath(path));
    }

    /// <summary>Normaliza la biblioteca y exige que su carpeta exista.</summary>
    private static string NormalizeLibrary(string path)
    {
        string library = NormalizePath(path);
        if (!Directory.Exists(library))
        {
            throw new ArgumentException("La carpeta de la biblioteca no existe.");
        }

        return library;
    }

    /// <summary>Comprueba que el archivo esté dentro de la biblioteca, también en subcarpetas.</summary>
    private static bool IsChild(string library, string movie)
    {
        string prefix = Path.EndsInDirectorySeparator(library) ? library : library + Path.DirectorySeparatorChar;
        return movie.StartsWith(prefix, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>Valida el nombre y su longitud; la unicidad se comprueba al crear.</summary>
    private static void ValidateName(string name)
    {
        if (string.IsNullOrWhiteSpace(name) || name.Length > MaximumCategoryNameLength)
        {
            throw new ArgumentException("El nombre de la categoría debe tener entre 1 y 80 caracteres.");
        }

        if (string.Equals(name, UncategorizedName, StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException("El nombre «Sin categoría» está reservado.");
        }
    }

    /// <summary>Valida la longitud y el nombre reservado de las subcategorías.</summary>
    private static void ValidateSubcategoryName(string name)
    {
        if (string.IsNullOrWhiteSpace(name) || name.Length > MaximumSubcategoryNameLength)
        {
            throw new ArgumentException("El nombre de la subcategoría debe tener entre 1 y 80 caracteres.");
        }
        if (string.Equals(name, UnsubcategorizedName, StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException("El nombre «Sin subcategoría» está reservado.");
        }
    }

    /// <summary>Identifica la ruta completa sin distinguir mayúsculas, como en Windows.</summary>
    private static string GetLibraryHash(string library)
    {
        string normalizedLibrary = library.ToUpperInvariant();
        byte[] libraryBytes = Encoding.UTF8.GetBytes(normalizedLibrary);
        byte[] hash = SHA256.HashData(libraryBytes);
        return Convert.ToHexString(hash);
    }

    /// <summary>Construye el nombre legible del JSON con ocho caracteres de su hash.</summary>
 

    #endregion

    #region Lectura y escritura

    /// <summary>Carga el JSON con nombre legible y valida su contenido.</summary>
    private async Task<MoviesCategoryLibrary> LoadAsync(string library, CancellationToken cancellationToken)
    {
        string filePath = Path.Combine(_dataDirectory, "MoviesCategoryData.json"); ;

        MoviesCategoryLibrary? data;
        try
        {
            data = await ReadLibraryAsync(filePath, cancellationToken);
        }
        catch (FileNotFoundException)
        {
            return new MoviesCategoryLibrary { LibraryPath = library };
        }
        catch (DirectoryNotFoundException)
        {
            return new MoviesCategoryLibrary { LibraryPath = library };
        }

        MoviesCategoryLibrary validatedData = ValidateLibraryData(library, data);
        bool updated = false;
        foreach (MoviesCategory category in validatedData.Categories)
        {
            // Conserva las películas directas de documentos anteriores dentro de la primera subcategoría.
            if (category.MoviesSubcategories.Count > 0 && category.MoviesPaths.Count > 0)
            {
                category.MoviesSubcategories[0].MoviesPaths.AddRange(category.MoviesPaths);
                category.MoviesPaths.Clear();
                updated = true;
            }
        }
        if (updated)
        {
            await SaveAsync(library, validatedData, cancellationToken);
        }
        return validatedData;
    }

    /// <summary>Deserializa el archivo y comunica un JSON dañado sin sustituirlo por datos vacíos.</summary>
    private static async Task<MoviesCategoryLibrary?> ReadLibraryAsync(string filePath, CancellationToken cancellationToken)
    {
        try
        {
            await using FileStream stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read);
            return await JsonSerializer.DeserializeAsync<MoviesCategoryLibrary>(stream, JsonOptions, cancellationToken);
        }
        catch (JsonException ex)
        {
            throw new InvalidDataException("El archivo de categorías no se puede leer. Se ha conservado sin modificar.", ex);
        }
    }

    /// <summary>Valida la cabecera, las categorías y la unicidad de sus asignaciones.</summary>
    private static MoviesCategoryLibrary ValidateLibraryData(string library, MoviesCategoryLibrary? data)
    {
        // El JSON debe contener un objeto, usar la versión 1, incluir su lista de
        // categorías y pertenecer a la biblioteca solicitada (sin distinguir mayúsculas).
        if (data is null || data.Version != 1 || data.Categories is null ||
            !string.Equals(data.LibraryPath, library, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidDataException("El archivo de categorías no es válido. Se ha conservado sin modificar.");
        }

        // HashSet.Add devuelve false si el valor ya estaba registrado.
        // Las rutas se comparten entre categorías para detectar asignaciones duplicadas.
        HashSet<Guid> categoryIds = new HashSet<Guid>();
        HashSet<Guid> subcategoryIds = new HashSet<Guid>();
        HashSet<string> names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        HashSet<string> assignedPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        try
        {
            foreach (MoviesCategory category in data.Categories)
            {
                // Cada categoría debe existir, tener un GUID no vacío y no repetido,
                // y contener un nombre y una lista de rutas distintos de null.
                if (category is null || category.Id == Guid.Empty || !categoryIds.Add(category.Id) ||
                    category.Name is null || category.MoviesPaths is null || category.MoviesSubcategories is null)
                {
                    throw new ArgumentException();
                }

                // El nombre debe tener entre 1 y 80 caracteres, no ser solo espacios
                // y no utilizar el nombre reservado «Sin categoría».
                ValidateName(category.Name);

                // No puede haber nombres repetidos, aunque cambien sus mayúsculas.
                if (!names.Add(category.Name))
                {
                    throw new ArgumentException();
                }

                foreach (string path in category.MoviesPaths)
                {
                    string movie = NormalizePath(path);
                    if (!IsChild(library, movie) || !assignedPaths.Add(movie))
                    {
                        throw new ArgumentException();
                    }
                }

                HashSet<string> subcategoryNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach(MoviesSubcategory subcategory in category.MoviesSubcategories)
                {
                    if (subcategory is null || subcategory.Id == Guid.Empty || !subcategoryIds.Add(subcategory.Id) ||
                   subcategory.Name is null || subcategory.MoviesPaths is null)
                    {
                        throw new ArgumentException();
                    }

                    ValidateSubcategoryName(subcategory.Name);
                    if (!subcategoryNames.Add(subcategory.Name))
                    {
                        throw new ArgumentException();
                    }

                    foreach (string path in subcategory.MoviesPaths)
                    {
                        // La ruta debe ser absoluta y no estar vacía; se normaliza antes
                        // de comprobar su pertenencia y compararla con las demás rutas.
                        string Movie = NormalizePath(path);

                        // Las asignaciones deben pertenecer a la biblioteca y ser únicas.
                        if (!IsChild(library, Movie) || !assignedPaths.Add(Movie))
                        {
                            throw new ArgumentException();
                        }
                    }
                }

               
            }
        }
        catch (ArgumentException ex)
        {
            // Devolver una lista vacía permitiría que un guardado posterior borrase datos.
            throw new InvalidDataException("El archivo de categorías contiene datos inválidos. Se ha conservado sin modificar.", ex);
        }

        return data;
    }

    /// <summary>Publica el JSON completo mediante un reemplazo en el mismo directorio y volumen.</summary>
    private async Task SaveAsync(string library, MoviesCategoryLibrary data, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(_dataDirectory);
        string destination = Path.Combine(_dataDirectory, "MoviesCategoryData.json"); ;
        string temporary = destination + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            await WriteTemporaryFileAsync(temporary, data, cancellationToken);
            cancellationToken.ThrowIfCancellationRequested();

            // El JSON publicado no se abre para escribir encima: se sustituye completo.
            if (File.Exists(destination))
            {
                File.Replace(temporary, destination, null);
            }
            else
            {
                File.Move(temporary, destination);
            }
        }
        finally
        {
            TryDeleteTemporaryFile(temporary);
        }
    }

    /// <summary>Escribe y vacía el temporal; el stream se cierra antes de publicar el archivo.</summary>
    private static async Task WriteTemporaryFileAsync(
        string temporary,
        MoviesCategoryLibrary data,
        CancellationToken cancellationToken)
    {
        await using FileStream stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write,
            FileShare.None, 4096, FileOptions.Asynchronous | FileOptions.WriteThrough);
        await JsonSerializer.SerializeAsync(stream, data, JsonOptions, cancellationToken);
        await stream.FlushAsync(cancellationToken);
        stream.Flush(flushToDisk: true);
    }

    /// <summary>Intenta borrar solo el temporal propio sin ocultar el error de la operación principal.</summary>
    private static void TryDeleteTemporaryFile(string temporary)
    {
        try
        {
            File.Delete(temporary);
        }
        catch (IOException)
        {
            // Un bloqueo puede impedir retirarlo; se conserva el error original del guardado.
        }
        catch (UnauthorizedAccessException)
        {
            // Un fallo de permisos en la limpieza tampoco sustituye el error principal.
        }
    }

    #endregion
}
