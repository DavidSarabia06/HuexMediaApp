using System.Security;
using HuexMediaApp.Server.Models;
using HuexMediaApp.Server.Models.Libraries;

namespace HuexMediaApp.Server.Services;

/// <summary>Explora carpetas locales y valida las imágenes de la biblioteca.</summary>
public sealed class SeriesService
{
    private const string DefaultSeriesImage = "/default-episode-vertical.png";
    private const string DefaultEpisodeImage = "/default-episode-horizontal.png";
    private static readonly string[] VideoExtensions = [".mp4", ".mkv", ".avi"];
    private static readonly string[] PosterExtensions = [".jpg", ".png", ".bmp"];
    private static readonly string[] ThumbnailExtensions = [".jpg", ".png"];
    private readonly ConfigurationService _configurationService;
    private readonly LibraryService _libraryService;

    private readonly JsonFileStoreService _fileStore;
    private readonly ILogger<SeriesService> _logger;

    #region Construcción

    public SeriesService(ConfigurationService configurationService, ILogger<SeriesService> logger, LibraryService libraryService, JsonFileStoreService fileStore)
    {
        _configurationService = configurationService;
        _logger = logger;
        _libraryService = libraryService;
        _fileStore = fileStore;
    }

    #endregion

    #region Exploración de la biblioteca

    /// <summary>Convierte cada carpeta situada directamente dentro de la biblioteca en una serie con su carátula.</summary>
    public async Task<List<MediaItem>> ScanSeriesAsync(Guid libraryId, CancellationToken cancellationToken = default)
    {
        MediaLibrary library = await GetSeriesLibraryAsync(libraryId, cancellationToken);
        string path = library.LibraryPath;
        ValidateDirectory(path, "La ruta de series no es válida o no existe.");
        bool usePosters = _configurationService.Get<bool>("DownloadSeriesPosters");
        List<MediaItem> series = new List<MediaItem>();

        foreach (string directory in Directory.GetDirectories(path))
        {
            cancellationToken.ThrowIfCancellationRequested();
            string? imagePath = usePosters ? FindImage(directory, "icono", PosterExtensions) : null;
            series.Add(new MediaItem
            {
                Nombre = Path.GetFileName(directory),
                RutaCompleta = directory,
                UrlImagen = DefaultSeriesImage,
                ImagePath = imagePath
            });
        }

        _logger.LogInformation("Se han encontrado {Count} series en '{Path}'.", series.Count, path);
        return series;
    }

    /// <summary>Busca vídeos en la serie y sus subcarpetas y reúne los episodios en temporadas según el nombre de su carpeta.</summary>
    public async Task<SeriesEpisodesResponse> ScanEpisodesAsync(Guid libraryId, string path, CancellationToken cancellationToken = default)
    {
        MediaLibrary library = await GetSeriesLibraryAsync(libraryId, cancellationToken);
        path = Path.GetFullPath(path);
        string? parent = Path.GetDirectoryName(Path.TrimEndingDirectorySeparator(path));
        if (!string.Equals(parent, Path.TrimEndingDirectorySeparator(Path.GetFullPath(library.LibraryPath)), StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException("La serie no pertenece a esta biblioteca.");
        }
        ValidateDirectory(path, "La ruta de la serie no es válida o no existe.");
        bool useThumbnails = _configurationService.Get<bool>("DownloadEpisodeThumbnails");
        string seriesName = Path.GetFileName(Path.TrimEndingDirectorySeparator(path));


        // Busca el json de episodios clave si existe
        List<string>? KeyEpisodes = await _fileStore.ReadAsync<List<string>>(Path.Combine(path, "key_episodes.json"), cancellationToken);

        // Los episodios se agrupan usando el nombre de la carpeta que los contiene.
        // Dos carpetas con el mismo nombre forman parte de la misma temporada en esta agrupación.

        IEnumerable<IGrouping<string?, string>> groups = Directory
            .EnumerateFiles(path, "*", SearchOption.AllDirectories)
            .Where(IsVideoFile)
            .GroupBy(file => Path.GetFileName(Path.GetDirectoryName(file)));
        List<SeriesSeason> seasons = new List<SeriesSeason>();

        foreach (IGrouping<string?, string> group in groups)
        {
            List<MediaItem> episodes = new List<MediaItem>();
            foreach (string file in group)
            {
                cancellationToken.ThrowIfCancellationRequested();

                // Si el episodio está en la lista de episodios clave, se marca como tal
                string filenameExt = Path.GetFileName(file);
                string filenameNoExt = Path.GetFileNameWithoutExtension(file);

                if (KeyEpisodes != null && ( KeyEpisodes.Contains(filenameExt) || KeyEpisodes.Contains(filenameNoExt)))
                {
                    MediaItem episode = CreateEpisode(file, useThumbnails);
                    episode.isKey = true;
                    episodes.Add(episode);
                }
                else
                    episodes.Add(CreateEpisode(file, useThumbnails));
            }

            seasons.Add(new SeriesSeason
            {
                NombreTemporada = group.Key == seriesName ? "Otros" : group.Key!,
                Episodios = episodes.OrderBy(episode => episode.Nombre).ToList()
            });
        }

        List<SeriesSeason> orderedSeasons = seasons.OrderBy(season => season.NombreTemporada).ToList();
        _logger.LogInformation("Se han encontrado {Count} temporadas en '{Path}'.", orderedSeasons.Count, path);
        return new SeriesEpisodesResponse { Temporadas = orderedSeasons };
    }

    /// <summary>Construye un episodio y localiza su miniatura si la opción está activada.</summary>
    private static MediaItem CreateEpisode(string file, bool useThumbnails)
    {
        string name = Path.GetFileNameWithoutExtension(file);
        string directory = Path.GetDirectoryName(file)!;
        string? imagePath = useThumbnails ? FindImage(directory, name, ThumbnailExtensions) : null;
        return new MediaItem
        {
            Nombre = name,
            RutaCompleta = file,
            UrlImagen = DefaultEpisodeImage,
            ImagePath = imagePath
        };
    }

    #endregion

    #region Imágenes locales

    /// <summary>Valida ubicación y formato; devuelve null si el archivo de imagen no existe.</summary>
    public async Task<ImageFile?> GetImageAsync(Guid libraryId, string path, CancellationToken cancellationToken = default)
    {
        MediaLibrary library = await GetSeriesLibraryAsync(libraryId, cancellationToken);
        if (string.IsNullOrWhiteSpace(path))
        {
            throw new ArgumentException("La ruta de imagen no es válida.");
        }

        string libraryPath = library.LibraryPath;
        string fullPath = Path.GetFullPath(path);
        string rootPath = Path.GetFullPath(libraryPath);
        ValidateImageLocation(rootPath, fullPath);

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

    /// <summary>Devuelve el tipo de contenido de la imagen para que el navegador sepa si recibe JPEG, PNG o BMP.</summary>
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

    /// <summary>Obtiene la biblioteca y comprueba que contiene series.</summary>
    private async Task<MediaLibrary> GetSeriesLibraryAsync(Guid libraryId, CancellationToken cancellationToken)
    {
        MediaLibrary library = await _libraryService.GetAsync(libraryId, cancellationToken);
        if (library.MediaType != MediaType.Series)
        {
            throw new ArgumentException("Esta operación requiere una biblioteca de series.");
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

    /// <summary>Comprueba la extensión sin distinguir mayúsculas.</summary>
    private static bool IsVideoFile(string file)
    {
        return VideoExtensions.Contains(Path.GetExtension(file), StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>Rechaza rutas fuera de la biblioteca, incluidas otras unidades y recorridos con ..</summary>
    private static void ValidateImageLocation(string rootPath, string fullPath)
    {
        string relativePath = Path.GetRelativePath(rootPath, fullPath);
        if (Path.IsPathRooted(relativePath) || relativePath == ".." ||
            relativePath.StartsWith($"..{Path.DirectorySeparatorChar}") ||
            relativePath.StartsWith($"..{Path.AltDirectorySeparatorChar}"))
        {
            throw new SecurityException("La imagen no pertenece a la biblioteca seleccionada.");
        }
    }

    #endregion
}
