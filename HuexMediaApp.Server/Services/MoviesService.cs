using HuexMediaApp.Server.Models.Libraries;
using System.Security;
using HuexMediaApp.Server.Models;

namespace HuexMediaApp.Server.Services;


/// <summary>Explora los vídeos de la biblioteca y localiza sus carátulas en disco.</summary>
public class MoviesService
{
    private const string DefaultMovieImage = "/default-episode-vertical.png";
    private static readonly string[] VideoExtensions = [".mp4", ".mkv", ".avi"];
    private static readonly string[] PosterExtensions = [".jpg", ".png", ".bmp"];
    private readonly ConfigurationService _configurationService;
    private readonly LibraryService _libraryService;
    private readonly ILogger<MoviesService> _logger;


    #region Construcción

    /// <summary>Recibe la configuración de biblioteca y el registro de las operaciones de disco.</summary>
    public MoviesService(ConfigurationService configurationService, ILogger<MoviesService> logger, LibraryService libraryService)
    {
        _configurationService = configurationService;
        _logger = logger;
        _libraryService = libraryService;

    }

    #endregion


    #region Exploración de la biblioteca

    /// <summary>Recorre la carpeta y sus descendientes y construye una tarjeta por archivo de vídeo.</summary>
    public async Task<List<MediaItem>> ScanMoviesAsync(
        Guid libraryId,
        CancellationToken cancellationToken)
    {
        MediaLibrary library = await GetMovieLibraryAsync(libraryId, cancellationToken);
        string path = library.LibraryPath;
        cancellationToken.ThrowIfCancellationRequested();
        ValidateDirectory(path, "La ruta de películas no es válida o no existe.");
        bool usePosters = _configurationService.Get<bool>("DownloadMoviePosters");
        List<MediaItem> movies = new List<MediaItem>();


        // AllDirectories entra también en las subcarpetas, por ejemplo las carpetas de sagas.
        // Después conservamos solo los archivos con alguna de las extensiones de vídeo admitidas.
        IEnumerable<string> videoFiles = Directory
            .EnumerateFiles(path, "*", SearchOption.AllDirectories)
            .Where(filePath => VideoExtensions.Contains(
                Path.GetExtension(filePath),
                StringComparer.OrdinalIgnoreCase));

        foreach (string file in videoFiles)
        {
            cancellationToken.ThrowIfCancellationRequested();
            string name = Path.GetFileNameWithoutExtension(file);
            string directory = Path.GetDirectoryName(file)!;
            // Buscamos junto al vídeo una imagen con su mismo nombre sin extensión.
            // Por ejemplo, Película.mkv puede utilizar Película.jpg como carátula.
            string? imagePath = usePosters ? FindImage(directory, name, PosterExtensions) : null;
            movies.Add(new MediaItem
            {
                Nombre = name,
                RutaCompleta = file,
                UrlImagen = DefaultMovieImage,
                ImagePath = imagePath
            });
        }

        _logger.LogInformation("Se han encontrado {Count} peliculas en '{Path}'.", movies.Count, path);
        return movies;
    }


    #endregion

    #region Imágenes locales

    /// <summary>Devuelve la ruta y el tipo de una imagen que pertenezca a la biblioteca indicada.</summary>
    public async Task<ImageFile?> GetImageAsync(
        Guid libraryId,
        string path,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            throw new ArgumentException("La ruta de imagen no es válida.");
        }

        MediaLibrary library = await GetMovieLibraryAsync(libraryId, cancellationToken);
        string fullPath = Path.GetFullPath(path);
        string rootPath = Path.GetFullPath(library.LibraryPath);
        ValidateImageLocation(rootPath, fullPath);
        cancellationToken.ThrowIfCancellationRequested();

        if (!File.Exists(fullPath))
        {
            return null;
        }

        return new ImageFile { FullPath = fullPath, ContentType = GetImageContentType(fullPath) };
    }

    /// <summary>Devuelve la primera imagen existente según el orden de extensiones indicado.</summary>
    private static string? FindImage(string directory, string name, string[] extensions)
    {
        foreach (string extension in extensions)
        {
            string imagePath = Path.Combine(directory, name + extension);
            if (File.Exists(imagePath))
            {
                return imagePath;
            }
        }

        return null;
    }

    /// <summary>Devuelve el tipo de contenido de la imagen para que el navegador pueda interpretarla.</summary>
    private static string GetImageContentType(string fullPath)
    {
        string extension = Path.GetExtension(fullPath).ToLowerInvariant();
        switch (extension)
        {
            case ".jpg":
            case ".jpeg":
                return "image/jpeg";
            case ".png":
                return "image/png";
            case ".bmp":
                return "image/bmp";
            default:
                throw new ArgumentException("El formato de imagen no está permitido.");
        }
    }

    #endregion

    #region Validación

    /// <summary>Obtiene la biblioteca guardada y comprueba que sea de películas.</summary>
    private async Task<MediaLibrary> GetMovieLibraryAsync(
        Guid libraryId,
        CancellationToken cancellationToken)
    {
        MediaLibrary library = await _libraryService.GetAsync(libraryId, cancellationToken);

        if (library.MediaType != MediaType.Movies)
        {
            throw new ArgumentException("La biblioteca seleccionada no es de películas.");
        }

        return library;
    }

    /// <summary>Comprueba que la ruta de exploración no esté vacía y sea una carpeta existente.</summary>
    private static void ValidateDirectory(string path, string errorMessage)
    {
        if (string.IsNullOrWhiteSpace(path) || !Directory.Exists(path))
        {
            throw new ArgumentException(errorMessage);
        }
    }

    /// <summary>Rechaza rutas fuera de la biblioteca, incluidas otras unidades y recorridos con ..</summary>
    private static void ValidateImageLocation(string rootPath, string fullPath)
    {
        string relativePath = Path.GetRelativePath(rootPath, fullPath);
        if (Path.IsPathRooted(relativePath) || relativePath == ".." ||
            relativePath.StartsWith($"..{Path.DirectorySeparatorChar}") ||
            relativePath.StartsWith($"..{Path.AltDirectorySeparatorChar}"))
        {
            throw new SecurityException("La imagen no pertenece a la biblioteca configurada.");
        }
    }

    #endregion
}


