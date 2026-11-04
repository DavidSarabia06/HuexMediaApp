using HuexMediaApp.Server.Models.Categories;
using HuexMediaApp.Server.Models.Libraries;
using HuexMediaApp.Server.Models;
using HuexMediaApp.Server.Models.Libraries.Legacy;
using System.Text.Json.Nodes;

namespace HuexMediaApp.Server.Services;

/// <summary>Localiza las bibliotecas guardadas y permite consultar su contenido.</summary>
public sealed class LibraryService
{
    private readonly string _directory;

    // Carpeta general de datos donde permanecen los archivos antiguos.
    private readonly string _dataDirectory;
    private readonly JsonFileStoreService   _fileStore;


    // Este bloqueo se utilizará también al crear y modificar bibliotecas.
    private readonly SemaphoreSlim _gate = new SemaphoreSlim(1, 1);

    #region Construcción

    public LibraryService(
      AppStoragePaths storagePaths,
      JsonFileStoreService fileStore)
    {
        _dataDirectory = storagePaths.DataDirectory;
        _directory = Path.Combine(_dataDirectory, "Libraries");
        _fileStore = fileStore;
    }
    #endregion

    #region Consulta de bibliotecas

    /// <summary>Devuelve los datos del selector de bibliotecas del tipo solicitado.</summary>
    public async Task<List<LibrarySummary>> GetLibrariesAsync(
        MediaType mediaType,
        CancellationToken cancellationToken = default,
        bool cleanupMissingReferences = false)
    {
        ValidateMediaType(mediaType);

        await _gate.WaitAsync(cancellationToken);

        try
        {
            List<MediaLibrary> libraries = await ReadLibrariesAsync(
                cancellationToken);

            if (cleanupMissingReferences)
            {
                foreach (MediaLibrary library in libraries.Where(item => item.MediaType == mediaType))
                {
                    await CleanupMissingReferencesAsync(library, cancellationToken);
                }
            }

            return libraries
                .Where(library => library.MediaType == mediaType)
                .OrderBy(library => library.Name, StringComparer.OrdinalIgnoreCase)
                .Select(library => new LibrarySummary
                {
                    Id = library.Id,
                    Name = library.Name,
                    MediaType = library.MediaType,
                    LibraryPath = library.LibraryPath
                })
                .ToList();
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <summary>Obtiene el documento completo de la biblioteca seleccionada.</summary>
    public async Task<MediaLibrary> GetAsync(
        Guid libraryId,
        CancellationToken cancellationToken = default,
        bool cleanupMissingReferences = false)
    {
        if (libraryId == Guid.Empty)
        {
            throw new ArgumentException(
                "El identificador de la biblioteca no es válido.");
        }

        await _gate.WaitAsync(cancellationToken);

        try
        {
            List<MediaLibrary> libraries = await ReadLibrariesAsync(
                cancellationToken);

            MediaLibrary? library = libraries.Find(
                item => item.Id == libraryId);

            if (library is null)
            {
                throw new KeyNotFoundException(
                    "La biblioteca seleccionada no existe.");
            }

            if (cleanupMissingReferences)
            {
                await CleanupMissingReferencesAsync(library, cancellationToken);
            }
            return library;
        }
        finally
        {
            _gate.Release();
        }
    }

    #endregion

    #region Creación de bibliotecas

    /// <summary>Crea una biblioteca y guarda su JSON con las categorías inicialmente vacías.</summary>
    public async Task<MediaLibrary> CreateAsync(
        string name,
        MediaType mediaType,
        string libraryPath,
        CancellationToken cancellationToken = default)
    {
        name = name?.Trim() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(name) || name.Length > 80)
        {
            throw new ArgumentException(
                "El nombre de la biblioteca debe tener entre 1 y 80 caracteres.");
        }

        ValidateMediaType(mediaType);

        // Normaliza la carpeta antes de compararla con las bibliotecas existentes.
        if (string.IsNullOrWhiteSpace(libraryPath) ||
            !Path.IsPathFullyQualified(libraryPath))
        {
            throw new ArgumentException(
                "La ruta de la biblioteca debe ser absoluta.");
        }

        string normalizedPath = Path.TrimEndingDirectorySeparator(
            Path.GetFullPath(libraryPath));

        if (!Directory.Exists(normalizedPath))
        {
            throw new ArgumentException(
                "La carpeta de la biblioteca no existe o no está disponible.");
        }

        // El bloqueo cubre la comprobación de duplicados y el guardado.
        await _gate.WaitAsync(cancellationToken);

        try
        {
            List<MediaLibrary> libraries = await ReadLibrariesAsync(
                cancellationToken);

            // Una misma carpeta no se registra dos veces para el mismo tipo de contenido.
            bool pathExists = libraries.Any(library =>
                library.MediaType == mediaType &&
                string.Equals(
                    Path.TrimEndingDirectorySeparator(
                        Path.GetFullPath(library.LibraryPath)),
                    normalizedPath,
                    StringComparison.OrdinalIgnoreCase));

            if (pathExists)
            {
                throw new ArgumentException(
                    "Esa carpeta ya está registrada como biblioteca de este tipo.");
            }

            // Los nombres son únicos dentro de Series o dentro de Películas.
            bool nameExists = libraries.Any(library =>
                library.MediaType == mediaType &&
                string.Equals(
                    library.Name,
                    name,
                    StringComparison.OrdinalIgnoreCase));

            if (nameExists)
            {
                throw new ArgumentException(
                    "Ya existe una biblioteca de este tipo con ese nombre.");
            }

            MediaLibrary newLibrary = new MediaLibrary
            {
                Id = Guid.NewGuid(),
                Name = name,
                MediaType = mediaType,
                LibraryPath = normalizedPath,
                Categories = []
            };

            string filePath = GetNewLibraryFilePath(mediaType, name);
            newLibrary.FilePath = filePath;

            await _fileStore.WriteAsync(
                filePath,
                newLibrary,
                cancellationToken);

            return newLibrary;
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <summary>Construye un nombre legible y disponible para el nuevo JSON.</summary>
    private string GetNewLibraryFilePath(MediaType mediaType, string name)
    {
        string safeName = name;

        // El nombre visible se conserva; solo adaptamos la parte utilizada como archivo.
        foreach (char invalidCharacter in Path.GetInvalidFileNameChars())
        {
            safeName = safeName.Replace(invalidCharacter, '_');
        }

        safeName = safeName.TrimEnd(' ', '.');

        if (string.IsNullOrWhiteSpace(safeName))
        {
            safeName = "Biblioteca";
        }

        string baseName = $"{mediaType}-{safeName}";
        string filePath = Path.Combine(_directory, $"{baseName}.json");
        int suffix = 2;

        // Si el nombre de archivo ya está ocupado, busca otro sin sobrescribirlo.
        while (File.Exists(filePath) || Directory.Exists(filePath))
        {
            filePath = Path.Combine(
                _directory,
                $"{baseName}-{suffix}.json");

            suffix++;
        }

        return filePath;
    }
    #endregion

    #region Actualización de bibliotecas

    /// <summary>Lee una biblioteca, aplica un cambio y guarda su JSON bajo el mismo bloqueo.</summary>
    public async Task<MediaLibrary> UpdateAsync(
        Guid libraryId,
        Action<MediaLibrary> updateLibrary,
        CancellationToken cancellationToken = default)
    {
        if (libraryId == Guid.Empty)
        {
            throw new ArgumentException("El identificador de la biblioteca no es válido.");
        }

        ArgumentNullException.ThrowIfNull(updateLibrary);
        await _gate.WaitAsync(cancellationToken);

        try
        {
            List<MediaLibrary> libraries = await ReadLibrariesAsync(cancellationToken);
            MediaLibrary? library = libraries.Find(item => item.Id == libraryId);

            if (library is null)
            {
                throw new KeyNotFoundException("La biblioteca seleccionada no existe.");
            }

            // Conserva la ubicación original aunque la operación modifique otras propiedades.
            string filePath = library.FilePath;

            // La lógica del cambio pertenece al servicio que llama. Si falla, no se guarda.
            updateLibrary(library);
            cancellationToken.ThrowIfCancellationRequested();

            if (library.Id != libraryId)
            {
                throw new InvalidOperationException("No se puede cambiar el identificador de la biblioteca.");
            }

            library.FilePath = filePath;
            ValidateLibrary(library, filePath);
            await _fileStore.WriteAsync(library.FilePath, library, cancellationToken);

            return library;
        }
        finally
        {
            _gate.Release();
        }
    }

    #endregion

    #region Eliminación de bibliotecas

    /// <summary>Elimina el documento JSON de la biblioteca indicada.</summary>
    public async Task DeleteAsync(
        Guid libraryId,
        CancellationToken cancellationToken = default)
    {
        if (libraryId == Guid.Empty)
        {
            throw new ArgumentException(
                "El identificador de la biblioteca no es válido.");
        }

        await _gate.WaitAsync(cancellationToken);

        try
        {
            List<MediaLibrary> libraries =
                await ReadLibrariesAsync(cancellationToken);

            MediaLibrary? library = libraries.Find(
                item => item.Id == libraryId);

            if (library is null)
            {
                throw new KeyNotFoundException(
                    "La biblioteca seleccionada no existe.");
            }

            cancellationToken.ThrowIfCancellationRequested();

            // FilePath procede de la lectura de los documentos guardados.
            File.Delete(library.FilePath);
        }
        finally
        {
            _gate.Release();
        }
    }

    #endregion

    #region Lectura de los archivos

    /// <summary>Devuelve los datos de las bibliotecas para las consultas del servicio.</summary>
    private async Task<List<MediaLibrary>> ReadLibrariesAsync(
        CancellationToken cancellationToken)
    {
        List<MediaLibrary> libraries = new List<MediaLibrary>();

        if (!Directory.Exists(_directory))
        {
            return libraries;
        }

        string[] files = Directory.GetFiles(
            _directory,
            "*.json",
            SearchOption.TopDirectoryOnly);

        HashSet<Guid> identifiers = new HashSet<Guid>();

        foreach (string filePath in files)
        {
            cancellationToken.ThrowIfCancellationRequested();

            MediaLibrary? library = await _fileStore.ReadAsync<MediaLibrary>(
                filePath,
                cancellationToken);

            // Puede haberse eliminado después de obtener la lista de archivos.
            if (library is null)
            {
                continue;
            }

            ValidateLibrary(library, filePath);

            if (!identifiers.Add(library.Id))
            {
                throw new InvalidDataException(
                    $"El archivo '{Path.GetFileName(filePath)}' tiene un identificador de biblioteca repetido.");
            }

            // La ruta del documento se conserva en memoria, sin serializarla.
            library.FilePath = filePath;
            libraries.Add(library);
        }

        return libraries;
    }

    #endregion

    #region Limpieza de referencias al cargar

    /// <summary>Retira asignaciones inexistentes y guarda solo cuando hay cambios.</summary>
    private async Task CleanupMissingReferencesAsync(MediaLibrary library, CancellationToken cancellationToken)
    {
        LibraryContentSnapshot? snapshot = LibraryContentSnapshot.TryRead(
            library, cancellationToken, includeEpisodes: false);
        if (snapshot is null)
        {
            return;
        }
        if (RemoveMissingCategoryItems(library.Categories, snapshot, cancellationToken))
        {
            cancellationToken.ThrowIfCancellationRequested();
            await _fileStore.WriteAsync(library.FilePath, library, cancellationToken);
        }
    }

    /// <summary>Recorre todos los niveles y conserva los grupos aunque queden vacíos.</summary>
    private static bool RemoveMissingCategoryItems(List<MediaCategory> categories,
        LibraryContentSnapshot snapshot, CancellationToken cancellationToken)
    {
        bool changed = false;
        foreach (MediaCategory category in categories)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (category is null || category.ItemPaths is null || category.Subcategories is null)
            {
                throw new InvalidDataException("Un grupo de la biblioteca está incompleto.");
            }
            if (category.ItemPaths.RemoveAll(path => !snapshot.ContainsItem(path)) > 0)
            {
                changed = true;
            }
            if (RemoveMissingCategoryItems(category.Subcategories, snapshot, cancellationToken))
            {
                changed = true;
            }
        }
        return changed;
    }

    #endregion

    #region Cambio de nombre de bibliotecas

    /// <summary>Cambia el nombre visible de la biblioteca y guarda su documento.</summary>
    public async Task<MediaLibrary> RenameAsync(
        Guid libraryId,
        string name,
        CancellationToken cancellationToken = default)
    {
        if (libraryId == Guid.Empty)
        {
            throw new ArgumentException(
                "El identificador de la biblioteca no es válido.");
        }

        string libraryName = name?.Trim() ?? string.Empty;

        if (libraryName.Length == 0 || libraryName.Length > 80)
        {
            throw new ArgumentException(
                "El nombre de la biblioteca debe tener entre 1 y 80 caracteres.");
        }

        await _gate.WaitAsync(cancellationToken);

        try
        {
            List<MediaLibrary> libraries =
                await ReadLibrariesAsync(cancellationToken);

            MediaLibrary? library = libraries.Find(
                item => item.Id == libraryId);

            if (library is null)
            {
                throw new KeyNotFoundException(
                    "La biblioteca seleccionada no existe.");
            }

            // Comprueba los nombres de las otras bibliotecas del mismo tipo.
            bool nameExists = libraries.Any(other =>
                other.Id != libraryId &&
                other.MediaType == library.MediaType &&
                string.Equals(
                    other.Name,
                    libraryName,
                    StringComparison.OrdinalIgnoreCase));

            if (nameExists)
            {
                throw new ArgumentException(
                    "Ya existe una biblioteca de este tipo con ese nombre.");
            }

            library.Name = libraryName;

            cancellationToken.ThrowIfCancellationRequested();

            await _fileStore.WriteAsync(
                library.FilePath,
                library,
                cancellationToken);

            return library;
        }
        finally
        {
            _gate.Release();
        }
    }

    #endregion


    #region Validación

    /// <summary>Comprueba que el tipo sea uno de los admitidos por la aplicación.</summary>
    private static void ValidateMediaType(MediaType mediaType)
    {
        if (mediaType != MediaType.Series &&
            mediaType != MediaType.Movies)
        {
            throw new ArgumentException(
                "El tipo de biblioteca no es válido.");
        }
    }

    /// <summary>Comprueba la identidad, el tipo y la ruta del documento leído.</summary>
    private static void ValidateLibrary(
        MediaLibrary library,
        string filePath)
    {
        bool validType =
            library.MediaType == MediaType.Series ||
            library.MediaType == MediaType.Movies;

        if (library.Version != 2 ||
            library.Id == Guid.Empty ||
            string.IsNullOrWhiteSpace(library.Name) ||
            !validType ||
            string.IsNullOrWhiteSpace(library.LibraryPath) ||
            !Path.IsPathFullyQualified(library.LibraryPath) ||
            library.Categories is null)
        {
            throw new InvalidDataException(
                $"El archivo '{Path.GetFileName(filePath)}' no contiene una biblioteca válida.");
        }

        // La biblioteca sigue siendo válida aunque su disco esté desconectado.
        // La disponibilidad de su carpeta se comprobará al escanear su contenido.
    }

    #endregion

    #region Detección de bibliotecas antiguas

    /// <summary>Detecta el archivo de versión 1 del tipo solicitado sin modificarlo.</summary>
    public async Task<List<LegacyLibrarySummary>> GetLegacyLibrariesAsync(
        MediaType mediaType,
        CancellationToken cancellationToken = default)
    {
        ValidateMediaType(mediaType);

        string folderName = mediaType == MediaType.Series
            ? "SeriesCategories"
            : "MoviesCategories";

        string fileName = mediaType == MediaType.Series
            ? "SeriesCategoryData.json"
            : "MoviesCategoryData.json";

        string filePath = Path.Combine(
            _dataDirectory,
            folderName,
            fileName);

        await _gate.WaitAsync(cancellationToken);

        try
        {
            List<LegacyLibrarySummary> libraries =
                new List<LegacyLibrarySummary>();

            // Lee el JSON directamente para comprobar su versión real,
            // sin aplicar los valores predeterminados de los modelos antiguos.
            JsonObject? document = await _fileStore.ReadAsync<JsonObject>(
                filePath,
                cancellationToken);

            if (document is null)
            {
                return libraries;
            }

            // TryGetValue comprueba el tipo del dato antes de utilizarlo.
            if (document["version"] is not JsonValue versionNode ||
                !versionNode.TryGetValue<int>(out int version))
            {
                throw new InvalidDataException(
                    $"El archivo '{fileName}' no indica una versión válida.");
            }

            // Esta operación solo detecta documentos de versión 1.
            if (version != 1)
            {
                return libraries;
            }

            if (document["libraryPath"] is not JsonValue pathNode || !pathNode.TryGetValue<string>(out string? libraryPath) || string.IsNullOrWhiteSpace(libraryPath) || 
                !Path.IsPathFullyQualified(libraryPath) || document["categories"] is not JsonArray categories)
            {
                throw new InvalidDataException(
                    $"El archivo antiguo '{fileName}' no contiene una biblioteca válida.");
            }

            libraries.Add(new LegacyLibrarySummary
            {
                FileName = fileName,
                MediaType = mediaType,
                LibraryPath = libraryPath,
                CategoryCount = categories.Count
            });

            return libraries;
        }
        finally
        {
            _gate.Release();
        }
    }

    #endregion

    #region Conversión de bibliotecas antiguas

    /// <summary>Crea una biblioteca de versión 2 conservando el archivo antiguo.</summary>
    public async Task<MediaLibrary> MigrateLegacyAsync(
        string name,
        MediaType mediaType,
        CancellationToken cancellationToken = default)
    {
        name = name?.Trim() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(name) || name.Length > 80)
        {
            throw new ArgumentException(
                "El nombre de la biblioteca debe tener entre 1 y 80 caracteres.");
        }

        ValidateMediaType(mediaType);

        string folderName = mediaType == MediaType.Series
            ? "SeriesCategories"
            : "MoviesCategories";

        string fileName = mediaType == MediaType.Series
            ? "SeriesCategoryData.json"
            : "MoviesCategoryData.json";

        string sourcePath = Path.Combine(
            _dataDirectory,
            folderName,
            fileName);

        await _gate.WaitAsync(cancellationToken);

        try
        {
            JsonObject? document = await _fileStore.ReadAsync<JsonObject>(
                sourcePath,
                cancellationToken);

            if (document is null)
            {
                throw new KeyNotFoundException(
                    "No existe el archivo antiguo de esta biblioteca.");
            }

            // Lee los datos originales antes de preparar el documento nuevo.
            JsonNode? versionNode = GetLegacyProperty(document, "version");
            JsonNode? pathNode = GetLegacyProperty(document, "libraryPath");

            if (versionNode is not JsonValue versionValue ||
                !versionValue.TryGetValue<int>(out int version) ||
                version != 1 ||
                pathNode is not JsonValue pathValue ||
                !pathValue.TryGetValue<string>(out string? libraryPath) ||
                string.IsNullOrWhiteSpace(libraryPath) ||
                !Path.IsPathFullyQualified(libraryPath) ||
                GetLegacyProperty(document, "categories") is not JsonArray categories)
            {
                throw new InvalidDataException(
                    $"El archivo '{fileName}' no contiene una biblioteca válida de versión 1.");
            }

            string normalizedPath = Path.TrimEndingDirectorySeparator(
                Path.GetFullPath(libraryPath));

            List<MediaLibrary> libraries = await ReadLibrariesAsync(
                cancellationToken);

            // Evita crear dos bibliotecas para la misma carpeta y tipo.
            bool pathExists = libraries.Any(library =>
                library.MediaType == mediaType &&
                string.Equals(
                    Path.TrimEndingDirectorySeparator(
                        Path.GetFullPath(library.LibraryPath)),
                    normalizedPath,
                    StringComparison.OrdinalIgnoreCase));

            if (pathExists)
            {
                throw new ArgumentException(
                    "Esa carpeta ya está registrada en la versión 2. No se ha sobrescrito su biblioteca.");
            }

            bool nameExists = libraries.Any(library =>
                library.MediaType == mediaType &&
                string.Equals(
                    library.Name,
                    name,
                    StringComparison.OrdinalIgnoreCase));

            if (nameExists)
            {
                throw new ArgumentException(
                    "Ya existe una biblioteca de este tipo con ese nombre.");
            }

            HashSet<Guid> categoryIds = new HashSet<Guid>();
            HashSet<string> assignedPaths =
                new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            MediaLibrary convertedLibrary = new MediaLibrary
            {
                Version = 2,
                Id = Guid.NewGuid(),
                Name = name,
                MediaType = mediaType,
                LibraryPath = normalizedPath,
                Categories = ConvertLegacyCategories(
                    categories,
                    mediaType,
                    normalizedPath,
                    categoryIds,
                    assignedPaths,
                    cancellationToken)
            };

            string destination = GetNewLibraryFilePath(mediaType, name);
            convertedLibrary.FilePath = destination;

            // El guardado se realiza solo después de convertir toda la jerarquía.
            // El archivo de versión 1 permanece en su ubicación original.
            await _fileStore.WriteAsync(
                destination,
                convertedLibrary,
                cancellationToken);

            return convertedLibrary;
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <summary>Convierte cada categoría y sus hijos conservando identificadores, nombres y asignaciones.</summary>
    private static List<MediaCategory> ConvertLegacyCategories(
        JsonArray source,
        MediaType mediaType,
        string libraryPath,
        HashSet<Guid> categoryIds,
        HashSet<string> assignedPaths,
        CancellationToken cancellationToken)
    {
        List<MediaCategory> converted = new List<MediaCategory>();
        HashSet<string> names =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        string pathsProperty = mediaType == MediaType.Series
            ? "seriesPaths"
            : "moviesPaths";

        string libraryPrefix = Path.EndsInDirectorySeparator(libraryPath)
            ? libraryPath
            : libraryPath + Path.DirectorySeparatorChar;

        foreach (JsonNode? node in source)
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (node is not JsonObject category)
            {
                throw new InvalidDataException(
                    "El archivo antiguo contiene una categoría inválida.");
            }

            JsonNode? idNode = GetLegacyProperty(category, "id");
            JsonNode? nameNode = GetLegacyProperty(category, "name");

            if (idNode is not JsonValue idValue ||
                !idValue.TryGetValue<Guid>(out Guid id) ||
                id == Guid.Empty ||
                !categoryIds.Add(id) ||
                nameNode is not JsonValue nameValue ||
                !nameValue.TryGetValue<string>(out string? categoryName) ||
                string.IsNullOrWhiteSpace(categoryName) ||
                categoryName.Length > 80 ||
                !names.Add(categoryName) ||
                GetLegacyProperty(category, pathsProperty) is not JsonArray paths)
            {
                throw new InvalidDataException(
                    "Una categoría antigua tiene datos incompletos o repetidos.");
            }

            List<string> itemPaths = new List<string>();

            foreach (JsonNode? pathNode in paths)
            {
                if (pathNode is not JsonValue pathValue ||
                    !pathValue.TryGetValue<string>(out string? itemPath) ||
                    string.IsNullOrWhiteSpace(itemPath) ||
                    !Path.IsPathFullyQualified(itemPath))
                {
                    throw new InvalidDataException(
                        $"La categoría '{categoryName}' contiene una ruta inválida.");
                }

                string normalizedItemPath = Path.TrimEndingDirectorySeparator(
                    Path.GetFullPath(itemPath));

                if (!normalizedItemPath.StartsWith(
                        libraryPrefix,
                        StringComparison.OrdinalIgnoreCase) ||
                    !assignedPaths.Add(normalizedItemPath))
                {
                    throw new InvalidDataException(
                        $"La categoría '{categoryName}' contiene una ruta repetida o ajena a la biblioteca.");
                }

                // Conserva la ruta original; cambia únicamente el nombre de la propiedad.
                itemPaths.Add(itemPath);
            }

            // Reconoce los nombres utilizados en las distintas revisiones de la versión 1.
            JsonNode? childrenNode = GetLegacyProperty(
                category,
                "subcategories",
                "moviesSubcategories",
                "childSubcategories");

            if (childrenNode is not null && childrenNode is not JsonArray)
            {
                throw new InvalidDataException(
                    $"Las subcategorías de '{categoryName}' no son válidas.");
            }

            List<MediaCategory> children = childrenNode is JsonArray childArray
                ? ConvertLegacyCategories(
                    childArray,
                    mediaType,
                    libraryPath,
                    categoryIds,
                    assignedPaths,
                    cancellationToken)
                : new List<MediaCategory>();

            converted.Add(new MediaCategory
            {
                Id = id,
                Name = categoryName,
                ItemPaths = itemPaths,
                Subcategories = children
            });
        }

        return converted;
    }

    /// <summary>Busca una propiedad antigua sin distinguir mayúsculas y admite nombres anteriores.</summary>
    private static JsonNode? GetLegacyProperty(
        JsonObject document,
        params string[] propertyNames)
    {
        JsonNode? result = null;
        bool found = false;

        foreach (KeyValuePair<string, JsonNode?> property in document)
        {
            bool matches = propertyNames.Any(name =>
                string.Equals(
                    name,
                    property.Key,
                    StringComparison.OrdinalIgnoreCase));

            if (!matches)
            {
                continue;
            }

            // Evita elegir silenciosamente entre dos propiedades que representan lo mismo.
            if (found)
            {
                throw new InvalidDataException(
                    $"El documento antiguo contiene propiedades ambiguas: '{property.Key}'.");
            }

            found = true;
            result = property.Value;
        }

        return result;
    }

    #endregion

}
